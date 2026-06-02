import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, collection, query, getDocs, orderBy, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js';

let firebaseApp = null;
let auth = null;
let db = null;

export function initFirebase(config) {
  if (!config || !config.apiKey || !config.projectId) {
    console.warn('Firebase configuration is missing. Firebase integration disabled.');
    return false;
  }
  if (getApps().length > 0) {
    return true;
  }
  firebaseApp = initializeApp(config);
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
  return true;
}

export function onAuthStateChangedListener(callback) {
  if (!auth) return;
  onAuthStateChanged(auth, callback);
}

export async function signInWithGoogleClient() {
  if (!auth) throw new Error('Firebase Auth is not initialized.');
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signInWithEmailClient(email, password) {
  if (!auth) throw new Error('Firebase Auth is not initialized.');
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signOutClient() {
  if (!auth) return;
  await signOut(auth);
}

export async function loadUserChatHistory(uid) {
  if (!db) return [];
  try {
    const docRef = doc(db, 'chatHistory', uid);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? snapshot.data().messages || [] : [];
  } catch (error) {
    console.error('Failed to load chat history:', error);
    return [];
  }
}

export async function saveUserChatHistory(uid, messages) {
  if (!db) return;
  try {
    await setDoc(doc(db, 'chatHistory', uid), {
      messages,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Failed to save chat history:', error);
  }
}

export async function loadCommunityPosts() {
  if (!db) return [];
  try {
    const postsRef = collection(db, 'communityPosts');
    const postsQuery = query(postsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(postsQuery);
    return snapshot.docs.map(docItem => ({ id: docItem.id, ...docItem.data() }));
  } catch (error) {
    console.error('Failed to load community posts:', error);
    return [];
  }
}

export async function saveCommunityPost(post) {
  if (!db) throw new Error('Firestore is not initialized.');
  try {
    await setDoc(doc(collection(db, 'communityPosts'), post.id), {
      ...post,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Failed to save community post:', error);
  }
}
