// LinuxAid legacy compatibility adapter.
// The dashboard originally imported firebase.js directly. LinuxAid now uses Supabase,
// so this module preserves the old function names while routing them to Supabase.
let client = null;
let currentUser = null;
let authListeners = new Set();

function normalizeUser(user) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  return {
    uid:user.id,
    id:user.id,
    email:user.email || '',
    displayName:meta.display_name || meta.full_name || meta.name || '',
    photoURL:meta.avatar_url || '',
    emailVerified:Boolean(user.email_confirmed_at),
    raw:user
  };
}

function emit(user) {
  currentUser = normalizeUser(user);
  authListeners.forEach(cb => { try { cb(currentUser); } catch (error) { console.error(error); } });
}

export function initFirebase(config) {
  const url = config?.supabaseUrl || window.LINUXAID_CONFIG?.backend?.supabase?.url;
  const key = config?.supabaseKey || window.LINUXAID_CONFIG?.backend?.supabase?.publishableKey || window.LINUXAID_CONFIG?.backend?.supabase?.anonKey;
  if (!url || !key) {
    console.warn('LinuxAid Supabase compatibility configuration is missing.');
    return false;
  }
  import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(({ createClient }) => {
    client = createClient(url, key, {
      auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, flowType:'pkce' },
      global:{ headers:{ 'X-Client-Info':'linuxaid-dashboard' } }
    });
    client.auth.getSession().then(({ data }) => emit(data?.session?.user || null));
    client.auth.onAuthStateChange((_event, session) => emit(session?.user || null));
  }).catch(error => console.error('LinuxAid Supabase adapter failed:', error));
  return true;
}

export function getCurrentUser() { return currentUser; }
export function onAuthStateChangedListener(callback) {
  if (typeof callback !== 'function') return () => {};
  authListeners.add(callback);
  queueMicrotask(() => callback(currentUser));
  return () => authListeners.delete(callback);
}

function requireClient() {
  if (!client) throw new Error('LinuxAid account system is still initializing. Please try again in a moment.');
  return client;
}

export async function signInWithGoogleClient() {
  const supabase = requireClient();
  const redirectTo = new URL('dashboard.html', location.href).href;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider:'google', options:{ redirectTo, queryParams:{ prompt:'select_account' } }
  });
  if (error) throw error;
  return data;
}

export async function signInWithEmailClient(email, password) {
  const supabase = requireClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  emit(data.user);
  return currentUser;
}

export async function createAccountWithEmailClient(email, password, displayName='LinuxAid Learner') {
  const supabase = requireClient();
  const emailRedirectTo = new URL('auth.html?verified=1', location.href).href;
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options:{ data:{ display_name:String(displayName).slice(0,80) }, emailRedirectTo }
  });
  if (error) throw error;
  emit(data.session?.user || null);
  return normalizeUser(data.user);
}

export async function sendPasswordResetClient(email) {
  const supabase = requireClient();
  const redirectTo = new URL('auth.html?mode=recovery', location.href).href;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function sendEmailVerificationClient() {
  const supabase = requireClient();
  if (!currentUser?.email) throw new Error('No signed-in email account.');
  const emailRedirectTo = new URL('auth.html?verified=1', location.href).href;
  const { error } = await supabase.auth.resend({ type:'signup', email:currentUser.email, options:{ emailRedirectTo } });
  if (error) throw error;
}

export async function updateUserProfileClient({ displayName, photoURL } = {}) {
  const supabase = requireClient();
  const data = {};
  if (typeof displayName === 'string') data.display_name = displayName.trim().slice(0,80);
  if (typeof photoURL === 'string') data.avatar_url = photoURL.trim().slice(0,1000);
  const { data:result, error } = await supabase.auth.updateUser({ data });
  if (error) throw error;
  emit(result.user);
  if (currentUser?.uid) await saveUserProfile(currentUser.uid, { displayName, photoURL });
  return currentUser;
}

export async function signOutClient() {
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw error;
  emit(null);
}

export async function ensureUserProfile(user, extras={}) {
  const uid = user?.uid || user?.id;
  if (!client || !uid) return;
  await client.from('profiles').upsert({
    id:uid,
    display_name:String(extras.displayName || user.displayName || '').slice(0,80),
    avatar_url:String(user.photoURL || '').slice(0,1000),
    updated_at:new Date().toISOString()
  }, { onConflict:'id' });
}

export async function loadUserProfile(uid) {
  if (!client || !uid) return null;
  const { data, error } = await client.from('profiles').select('*').eq('id', uid).maybeSingle();
  if (error) { console.error('Failed to load profile:', error); return null; }
  return data;
}

export async function saveUserProfile(uid, profile={}) {
  if (!client || !uid) return;
  const { error } = await client.from('profiles').upsert({
    id:uid,
    display_name:String(profile.displayName || '').slice(0,80),
    avatar_url:String(profile.photoURL || '').slice(0,1000),
    distro:String(profile.distro || '').slice(0,40),
    learning_goal:String(profile.learningGoal || '').slice(0,160),
    updated_at:new Date().toISOString()
  }, { onConflict:'id' });
  if (error) throw error;
}

export async function loadUserChatHistory(uid) {
  if (!client || !uid) return [];
  const { data, error } = await client.from('learner_state').select('chat_history').eq('user_id', uid).maybeSingle();
  if (error) { console.error('Failed to load chat history:', error); return []; }
  return Array.isArray(data?.chat_history) ? data.chat_history : [];
}

export async function saveUserChatHistory(uid, messages) {
  if (!client || !uid) return;
  const safe = (Array.isArray(messages) ? messages : []).slice(-60);
  const { error } = await client.from('learner_state').upsert({ user_id:uid, chat_history:safe, updated_at:new Date().toISOString() }, { onConflict:'user_id' });
  if (error) console.error('Failed to save chat history:', error);
}

export async function saveLearningProgress(uid, progress={}) {
  if (!client || !uid) return;
  const { data:existing } = await client.from('learner_state').select('progress').eq('user_id', uid).maybeSingle();
  const { error } = await client.from('learner_state').upsert({ user_id:uid, progress:{ ...(existing?.progress || {}), ...progress }, updated_at:new Date().toISOString() }, { onConflict:'user_id' });
  if (error) console.error('Failed to save progress:', error);
}

export async function loadLearningProgress(uid) {
  if (!client || !uid) return null;
  const { data, error } = await client.from('learner_state').select('progress').eq('user_id', uid).maybeSingle();
  if (error) { console.error('Failed to load progress:', error); return null; }
  return data?.progress || null;
}

export async function loadCommunityPosts() {
  if (!client) return [];
  const { data, error } = await client.from('community_posts').select('*').order('created_at', { ascending:false }).limit(50);
  if (error) { console.error('Failed to load community posts:', error); return []; }
  return (data || []).map(post => ({
    ...post,
    title:post.title,
    body:post.body,
    meta:post.author_name || 'LinuxAid community',
    replies:post.reply_count || 0,
    upvotes:post.vote_count || 0
  }));
}

export async function saveCommunityPost(post={}) {
  const supabase = requireClient();
  if (!currentUser?.uid) throw new Error('Sign in to publish a community post.');
  const { error } = await supabase.from('community_posts').insert({
    title:String(post.title || '').slice(0,140),
    body:String(post.body || '').slice(0,5000),
    author_id:currentUser.uid,
    author_name:String(currentUser.displayName || currentUser.email || 'LinuxAid learner').slice(0,80)
  });
  if (error) throw error;
}
