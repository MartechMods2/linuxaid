const state = {
  provider:'none',
  ready:false,
  client:null,
  config:null,
  initPromise:null,
  authSubscriptions:new Set(),
  lastUser:null
};

const normalizeUser = user => {
  if (!user) return null;
  const metadata = user.user_metadata || {};
  return {
    uid:user.id,
    id:user.id,
    email:user.email || '',
    displayName:metadata.full_name || metadata.name || metadata.display_name || '',
    emailVerified:Boolean(user.email_confirmed_at),
    avatarUrl:metadata.avatar_url || '',
    raw:user
  };
};

function backendConfig(config = {}) { return config.backend || config; }
function supabaseConfig(config = {}) { return backendConfig(config).supabase || config.supabase || {}; }
function hasSupabase(config = {}) {
  const source = supabaseConfig(config);
  return Boolean(source.url && (source.publishableKey || source.anonKey));
}

function notifyAuth(user) {
  state.lastUser = normalizeUser(user);
  state.authSubscriptions.forEach(callback => {
    try { callback(state.lastUser); }
    catch (error) { console.error('LinuxAid auth listener failed:', error); }
  });
}

function timeoutFetch(timeoutMs = 20000) {
  return async (input, init = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal:init.signal || controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
}

async function initSupabase(config) {
  const source = supabaseConfig(config);
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const timeoutMs = Math.max(8000, Math.min(45000, Number(config.security?.requestTimeoutMs || 20000)));
  state.client = createClient(source.url, source.publishableKey || source.anonKey, {
    auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, flowType:'pkce' },
    global:{
      fetch:timeoutFetch(timeoutMs),
      headers:{ 'X-Client-Info':'linuxaid-web' }
    }
  });
  state.provider = 'supabase';
  state.ready = true;

  const { data, error } = await state.client.auth.getSession();
  if (error) console.warn('LinuxAid session restore failed:', error);
  notifyAuth(data?.session?.user || null);
  state.client.auth.onAuthStateChange((_event, session) => notifyAuth(session?.user || null));
  return true;
}

export async function initBackend(config = window.LINUXAID_CONFIG || {}) {
  if (state.ready) return state.provider;
  if (state.initPromise) return state.initPromise;
  state.config = config;
  state.initPromise = (async () => {
    try {
      if (!hasSupabase(config)) return 'none';
      await initSupabase(config);
      return state.provider;
    } catch (error) {
      console.error('LinuxAid backend initialization failed:', error);
      state.provider = 'none';
      state.ready = false;
      state.client = null;
      return 'none';
    }
  })();
  try { return await state.initPromise; }
  finally { state.initPromise = null; }
}

export function getBackendStatus() {
  return { provider:state.provider, ready:state.ready, user:state.lastUser };
}

export function onAuthStateChangedListener(callback) {
  if (typeof callback !== 'function') return () => {};
  state.authSubscriptions.add(callback);
  queueMicrotask(() => callback(state.lastUser));
  return () => state.authSubscriptions.delete(callback);
}

export async function getCurrentUser() {
  if (!state.ready || !state.client) return null;
  const { data, error } = await state.client.auth.getUser();
  if (error && error.status !== 401) throw error;
  notifyAuth(data?.user || null);
  return state.lastUser;
}

export async function signInWithGoogleClient() {
  if (!state.ready) throw new Error('LinuxAid backend is not configured.');
  const redirectTo = new URL('dashboard.html', location.href).href;
  const { data, error } = await state.client.auth.signInWithOAuth({
    provider:'google',
    options:{ redirectTo, queryParams:{ access_type:'offline', prompt:'consent' } }
  });
  if (error) throw error;
  return data;
}

export async function signInWithEmailClient(email, password, captchaToken = '') {
  if (!state.ready) throw new Error('LinuxAid backend is not configured.');
  const payload = { email, password };
  if (captchaToken) payload.options = { captchaToken };
  const { data, error } = await state.client.auth.signInWithPassword(payload);
  if (error) throw error;
  notifyAuth(data.user);
  return state.lastUser;
}

export async function createAccountWithEmailClient(email, password, displayName='LinuxAid Learner', captchaToken = '') {
  if (!state.ready) throw new Error('LinuxAid backend is not configured.');
  const emailRedirectTo = new URL('auth.html?verified=1', location.href).href;
  const options = { data:{ display_name:displayName }, emailRedirectTo };
  if (captchaToken) options.captchaToken = captchaToken;
  const { data, error } = await state.client.auth.signUp({ email, password, options });
  if (error) throw error;
  notifyAuth(data.session?.user || null);
  return normalizeUser(data.user);
}

export async function sendPasswordResetClient(email, captchaToken = '') {
  if (!state.ready) throw new Error('LinuxAid backend is not configured.');
  const redirectTo = new URL('auth.html?mode=recovery', location.href).href;
  const options = { redirectTo };
  if (captchaToken) options.captchaToken = captchaToken;
  const { error } = await state.client.auth.resetPasswordForEmail(email, options);
  if (error) throw error;
  return true;
}

export async function updatePasswordClient(password) {
  if (!state.ready) throw new Error('LinuxAid backend is not configured.');
  const { data, error } = await state.client.auth.updateUser({ password });
  if (error) throw error;
  notifyAuth(data.user);
  return state.lastUser;
}

export async function sendEmailVerificationClient() {
  if (!state.ready) throw new Error('LinuxAid backend is not configured.');
  const user = await getCurrentUser();
  if (!user?.email) throw new Error('No signed-in email account.');
  const emailRedirectTo = new URL('auth.html?verified=1', location.href).href;
  const { error } = await state.client.auth.resend({ type:'signup', email:user.email, options:{ emailRedirectTo } });
  if (error) throw error;
  return true;
}

export async function signOutClient() {
  if (!state.ready) return;
  const { error } = await state.client.auth.signOut();
  if (error) throw error;
  notifyAuth(null);
}

export async function getAuthHeaders() {
  if (!state.ready) return {};
  const { data } = await state.client.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization:`Bearer ${token}` } : {};
}

function requireUserId() {
  const id = state.lastUser?.uid;
  if (!id) throw new Error('Sign in to use this synced feature.');
  return id;
}

export async function loadUserChatHistory(uid = state.lastUser?.uid) {
  if (!state.ready || !uid) return [];
  const { data, error } = await state.client.from('learner_state').select('chat_history').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return Array.isArray(data?.chat_history) ? data.chat_history : [];
}

export async function saveUserChatHistory(uid = state.lastUser?.uid, messages = []) {
  if (!state.ready || !uid) return;
  const safeMessages = (Array.isArray(messages) ? messages : []).slice(-60).map(item => ({
    role:item.role === 'user' ? 'user' : 'assistant',
    text:String(item.text || '').slice(0,12000)
  }));
  const { error } = await state.client.from('learner_state').upsert({
    user_id:uid,
    chat_history:safeMessages,
    updated_at:new Date().toISOString()
  }, { onConflict:'user_id' });
  if (error) throw error;
}

export async function loadUserProfile(uid = state.lastUser?.uid) {
  if (!state.ready || !uid) return null;
  const { data, error } = await state.client.from('profiles').select('*').eq('id', uid).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    displayName:data.display_name || '',
    email:state.lastUser?.email || '',
    distro:data.distro || '',
    learningGoal:data.learning_goal || '',
    avatarUrl:data.avatar_url || '',
    role:data.role || 'learner',
    themeMode:data.theme_mode || 'light',
    accentColor:data.accent_color || '#16a34a'
  };
}

export async function saveUserProfile(uid = state.lastUser?.uid, profile = {}) {
  if (!state.ready || !uid) return;
  const payload = {
    id:uid,
    display_name:String(profile.displayName || '').slice(0,80),
    distro:String(profile.distro || '').slice(0,40),
    learning_goal:String(profile.learningGoal || '').slice(0,500),
    avatar_url:String(profile.avatarUrl || profile.photoURL || '').slice(0,500),
    theme_mode:['light','dark','system'].includes(profile.themeMode) ? profile.themeMode : 'light',
    accent_color:/^#[0-9a-f]{6}$/i.test(String(profile.accentColor || '')) ? String(profile.accentColor).toLowerCase() : '#16a34a',
    updated_at:new Date().toISOString()
  };
  const { error } = await state.client.from('profiles').upsert(payload, { onConflict:'id' });
  if (error) throw error;
}

export async function loadSyncedProgress(uid = state.lastUser?.uid) {
  if (!state.ready || !uid) return null;
  const { data, error } = await state.client.from('learner_state').select('progress,learning').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return data ? { progress:data.progress || null, learning:data.learning || null } : null;
}

export async function saveSyncedProgress(progress, learning, uid = state.lastUser?.uid) {
  if (!state.ready || !uid) return;
  const { error } = await state.client.from('learner_state').upsert({
    user_id:uid,
    progress:progress || {},
    learning:learning || {},
    updated_at:new Date().toISOString()
  }, { onConflict:'user_id' });
  if (error) throw error;
}

export async function loadCommunityPosts() {
  if (!state.ready) return [];
  const { data, error } = await state.client
    .from('community_posts')
    .select('id,title,body,author_name,upvotes_count,reply_count,created_at')
    .order('created_at', { ascending:false })
    .limit(30);
  if (error) throw error;
  return (data || []).map(post => ({
    id:post.id,
    title:post.title,
    body:post.body,
    replies:post.reply_count || 0,
    upvotes:post.upvotes_count || 0,
    meta:`${post.author_name || 'LinuxAid learner'} • ${new Date(post.created_at).toLocaleString()}`
  }));
}

export async function saveCommunityPost(post) {
  if (!state.ready) throw new Error('LinuxAid backend is not configured.');
  const authorId = requireUserId();
  const { data, error } = await state.client.from('community_posts').insert({
    id:post.id || crypto.randomUUID(),
    author_id:authorId,
    title:String(post.title || '').slice(0,160),
    body:String(post.body || '').slice(0,8000)
  }).select('id').single();
  if (error) throw error;
  return data;
}

export async function toggleCommunityVote(postId) {
  if (!state.ready) throw new Error('Voting requires the LinuxAid account service.');
  const userId = requireUserId();
  const { data:existing, error:lookupError } = await state.client.from('community_votes').select('post_id').eq('post_id',postId).eq('user_id',userId).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) {
    const { error } = await state.client.from('community_votes').delete().eq('post_id',postId).eq('user_id',userId);
    if (error) throw error;
    return false;
  }
  const { error } = await state.client.from('community_votes').insert({ post_id:postId, user_id:userId });
  if (error) throw error;
  return true;
}

export async function loadCommunityReplies(postId) {
  if (!state.ready) return [];
  const { data, error } = await state.client
    .from('community_replies')
    .select('id,body,author_name,created_at')
    .eq('post_id',postId)
    .order('created_at', { ascending:true })
    .limit(60);
  if (error) throw error;
  return (data || []).map(reply => ({
    id:reply.id,
    body:reply.body,
    displayName:reply.author_name || 'LinuxAid learner',
    createdAt:reply.created_at
  }));
}

export async function saveCommunityReply(postId, body) {
  if (!state.ready) throw new Error('Replies require the LinuxAid account service.');
  const authorId = requireUserId();
  const { data, error } = await state.client.from('community_replies').insert({
    post_id:postId,
    author_id:authorId,
    body:String(body || '').slice(0,5000)
  }).select('id').single();
  if (error) throw error;
  return data;
}

export async function loadNotifications(limit = 30) {
  if (!state.ready || !state.lastUser?.uid) return [];
  const { data, error } = await state.client.from('notifications').select('*').eq('user_id',state.lastUser.uid).order('created_at',{ ascending:false }).limit(Math.min(50,Math.max(1,limit)));
  if (error) throw error;
  return data || [];
}

export async function markNotificationRead(id) {
  if (!state.ready || !state.lastUser?.uid) return;
  const { error } = await state.client.from('notifications').update({ read_at:new Date().toISOString() }).eq('id',id).eq('user_id',state.lastUser.uid);
  if (error) throw error;
}

export async function uploadAvatar(file) {
  if (!state.ready) throw new Error('Avatar uploads require the LinuxAid account service.');
  const userId = requireUserId();
  if (!file || !String(file.type || '').startsWith('image/')) throw new Error('Choose an image file.');
  if (file.size > 2 * 1024 * 1024) throw new Error('Avatar images must be 2 MB or smaller.');
  const extension = String(file.name || 'avatar.png').split('.').pop().replace(/[^a-z0-9]/gi,'').toLowerCase() || 'png';
  const path = `${userId}/avatar.${extension}`;
  const { error } = await state.client.storage.from('avatars').upload(path, file, { upsert:true, contentType:file.type, cacheControl:'3600' });
  if (error) throw error;
  const { data } = state.client.storage.from('avatars').getPublicUrl(path);
  const current = await loadUserProfile(userId) || {};
  await saveUserProfile(userId, { ...current, avatarUrl:data.publicUrl });
  return data.publicUrl;
}

export async function invokeBackendFunction(name, body = {}) {
  if (!state.ready) throw new Error('LinuxAid server functions are not configured.');
  const { data, error } = await state.client.functions.invoke(name, { body });
  if (error) throw error;
  return data;
}
