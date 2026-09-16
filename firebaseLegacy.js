import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js';
import {
  getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification,
  updateProfile, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js';
import {
  getFirestore, doc, setDoc, getDoc, collection, query, getDocs,
  orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js';

let firebaseApp = null;
let auth = null;
let db = null;

export function initFirebase(config) {
  if (!config || !config.apiKey || !config.projectId) {
    console.warn('Firebase configuration is missing. Firebase integration disabled.');
    return false;
  }
  try {
    firebaseApp = getApps()[0] || initializeApp(config);
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);
    setPersistence(auth, browserLocalPersistence).catch(error => console.warn('Firebase persistence unavailable:', error));
    return true;
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    return false;
  }
}

export function getCurrentUser() { return auth?.currentUser || null; }
export function onAuthStateChangedListener(callback) { return auth ? onAuthStateChanged(auth, callback) : () => {}; }

export async function signInWithGoogleClient() {
  if (!auth) throw new Error('Firebase Auth is not initialized.');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt:'select_account' });
  const result = await signInWithPopup(auth, provider);
  await ensureUserProfile(result.user);
  return result.user;
}

export async function signInWithEmailClient(email, password) {
  if (!auth) throw new Error('Firebase Auth is not initialized.');
  const result = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserProfile(result.user);
  return result.user;
}

export async function createAccountWithEmailClient(email, password, displayName='LinuxAid Learner') {
  if (!auth) throw new Error('Firebase Auth is not initialized.');
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName.trim()) await updateProfile(credential.user, { displayName:displayName.trim().slice(0,80) });
  await ensureUserProfile(credential.user, { displayName:displayName.trim() });
  try { await sendEmailVerification(credential.user); } catch (error) { console.warn('Email verification could not be sent:', error); }
  return credential.user;
}

export async function sendPasswordResetClient(email) {
  if (!auth) throw new Error('Firebase Auth is not initialized.');
  await sendPasswordResetEmail(auth, email);
}

export async function sendEmailVerificationClient() {
  if (!auth?.currentUser) throw new Error('No signed-in user.');
  await sendEmailVerification(auth.currentUser);
}

export async function updateUserProfileClient({ displayName, photoURL } = {}) {
  if (!auth?.currentUser) throw new Error('No signed-in user.');
  const payload = {};
  if (typeof displayName === 'string') payload.displayName = displayName.trim().slice(0,80);
  if (typeof photoURL === 'string') payload.photoURL = photoURL.trim().slice(0,1000);
  await updateProfile(auth.currentUser, payload);
  await saveUserProfile(auth.currentUser.uid, payload);
  return auth.currentUser;
}

export async function signOutClient() { if (auth) await signOut(auth); }

export async function ensureUserProfile(user, extras={}) {
  if (!db || !user?.uid) return;
  const ref = doc(db, 'profiles', user.uid);
  const existing = await getDoc(ref);
  const data = {
    displayName:extras.displayName || user.displayName || '',
    email:user.email || '',
    photoURL:user.photoURL || '',
    lastSeenAt:serverTimestamp()
  };
  if (!existing.exists()) data.createdAt = serverTimestamp();
  await setDoc(ref, data, { merge:true });
}

export async function loadUserProfile(uid) {
  if (!db || !uid) return null;
  try {
    const snapshot = await getDoc(doc(db, 'profiles', uid));
    return snapshot.exists() ? { id:snapshot.id, ...snapshot.data() } : null;
  } catch (error) { console.error('Failed to load profile:', error); return null; }
}

export async function saveUserProfile(uid, profile) {
  if (!db || !uid) return;
  const safe = {
    displayName:String(profile?.displayName || '').slice(0,80),
    photoURL:String(profile?.photoURL || '').slice(0,1000),
    distro:String(profile?.distro || '').slice(0,40),
    learningGoal:String(profile?.learningGoal || '').slice(0,160),
    updatedAt:serverTimestamp()
  };
  await setDoc(doc(db, 'profiles', uid), safe, { merge:true });
}

export async function loadUserChatHistory(uid) {
  if (!db) return [];
  try {
    const snapshot = await getDoc(doc(db, 'chatHistory', uid));
    return snapshot.exists() ? snapshot.data().messages || [] : [];
  } catch (error) { console.error('Failed to load chat history:', error); return []; }
}

export async function saveUserChatHistory(uid, messages) {
  if (!db) return;
  try {
    await setDoc(doc(db, 'chatHistory', uid), {
      messages:Array.isArray(messages) ? messages.slice(-60) : [],
      updatedAt:serverTimestamp()
    }, { merge:true });
  } catch (error) { console.error('Failed to save chat history:', error); }
}

export async function saveLearningProgress(uid, progress) {
  if (!db || !uid) return;
  try { await setDoc(doc(db, 'progress', uid), { ...progress, updatedAt:serverTimestamp() }, { merge:true }); }
  catch (error) { console.error('Failed to save progress:', error); }
}

export async function loadLearningProgress(uid) {
  if (!db || !uid) return null;
  try {
    const snapshot = await getDoc(doc(db, 'progress', uid));
    return snapshot.exists() ? snapshot.data() : null;
  } catch (error) { console.error('Failed to load progress:', error); return null; }
}

export async function loadCommunityPosts() {
  if (!db) return [];
  try {
    const postsRef = collection(db, 'communityPosts');
    const postsQuery = query(postsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(postsQuery);
    return snapshot.docs.map(docItem => ({ id:docItem.id, ...docItem.data() }));
  } catch (error) { console.error('Failed to load community posts:', error); return []; }
}

export async function saveCommunityPost(post) {
  if (!db) throw new Error('Firestore is not initialized.');
  const id = String(post?.id || crypto.randomUUID());
  await setDoc(doc(collection(db, 'communityPosts'), id), {
    title:String(post?.title || '').slice(0,140),
    body:String(post?.body || '').slice(0,5000),
    meta:String(post?.meta || '').slice(0,160),
    authorId:auth?.currentUser?.uid || '',
    createdAt:serverTimestamp()
  });
}
