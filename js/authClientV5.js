const config=window.LINUXAID_CONFIG||{};
const source=config.backend?.supabase||{};
let clientPromise=null;

export function isSupabaseAuthReady(){return Boolean(source.url&&(source.publishableKey||source.anonKey));}

export async function getAuthClient(){
  if(!isSupabaseAuthReady()) throw new Error('Supabase Auth is not configured.');
  if(!clientPromise){
    // Pin the browser SDK so a future CDN release cannot silently change production behavior.
    clientPromise=import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm').then(({createClient})=>createClient(source.url,source.publishableKey||source.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'},global:{headers:{'X-Client-Info':'linuxaid-auth-v8'}}}));
  }
  return clientPromise;
}

function site(path=''){
  const base=String(config.product?.website||location.origin+'/').replace(/\/?$/,'/');
  return new URL(path,base).href;
}

export async function getSessionUser(){const c=await getAuthClient();const {data,error}=await c.auth.getUser();if(error&&error.status!==401)throw error;return data?.user||null;}
export async function signInEmail(email,password,captchaToken=''){const c=await getAuthClient();const options=captchaToken?{captchaToken}:undefined;const {data,error}=await c.auth.signInWithPassword({email,password,options});if(error)throw error;return data;}
export async function signUpEmail(email,password,displayName,captchaToken=''){const c=await getAuthClient();const options={data:{display_name:displayName},emailRedirectTo:site('auth.html?verified=1')};if(captchaToken)options.captchaToken=captchaToken;const {data,error}=await c.auth.signUp({email,password,options});if(error)throw error;return data;}
export async function signInMagicLink(email,captchaToken=''){const c=await getAuthClient();const options={emailRedirectTo:site('dashboard.html'),shouldCreateUser:false};if(captchaToken)options.captchaToken=captchaToken;const {data,error}=await c.auth.signInWithOtp({email,options});if(error)throw error;return data;}
export async function resetPassword(email,captchaToken=''){const c=await getAuthClient();const options={redirectTo:site('auth.html?mode=recovery')};if(captchaToken)options.captchaToken=captchaToken;const {data,error}=await c.auth.resetPasswordForEmail(email,options});if(error)throw error;return data;}
export async function updatePassword(password){const c=await getAuthClient();const {data,error}=await c.auth.updateUser({password});if(error)throw error;return data;}
export async function signInGoogle(){const c=await getAuthClient();const {data,error}=await c.auth.signInWithOAuth({provider:'google',options:{redirectTo:site('dashboard.html'),queryParams:{prompt:'select_account'}}});if(error)throw error;return data;}
export async function signOut(){const c=await getAuthClient();const {error}=await c.auth.signOut();if(error)throw error;}
export async function exchangeCodeIfPresent(){const code=new URLSearchParams(location.search).get('code');if(!code)return null;const c=await getAuthClient();const {data,error}=await c.auth.exchangeCodeForSession(code);if(error)throw error;return data;}
