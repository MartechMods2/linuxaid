const CONFIG = window.LINUXAID_CONFIG || {};
const SUPA = CONFIG.backend?.supabase || {};
const AUTH = CONFIG.auth || {};
const CAPTCHA = AUTH.captcha || {};
const $ = id => document.getElementById(id);

let client = null;
let mode = new URLSearchParams(location.search).get('mode') === 'recovery' ? 'recovery' : 'signin';
let busy = false;
let captchaToken = '';
let turnstileWidgetId = null;
const nextPage = (() => {
  const value = new URLSearchParams(location.search).get('next') || 'dashboard.html';
  return /^[a-z0-9_-]+\.html(?:[?#].*)?$/i.test(value) ? value : 'dashboard.html';
})();

const els = {
  heading:$('authHeading'), subheading:$('authSubheading'), message:$('authMessage'), form:$('authForm'),
  name:$('authName'), email:$('authPageEmail'), password:$('authPagePassword'), confirm:$('authConfirmPassword'),
  nameField:$('nameField'), confirmField:$('confirmField'), submit:$('authSubmit'), google:$('authGoogle'),
  forgot:$('forgotPassword'), demo:$('demoMode'), togglePassword:$('togglePassword'), captcha:$('authCaptcha')
};

function configured(){ return Boolean(SUPA.url && (SUPA.publishableKey || SUPA.anonKey)); }
function setMessage(text='', type='info'){
  if(!els.message) return;
  els.message.textContent=text;
  els.message.className=`auth-message ${text ? `show ${type}` : ''}`;
}
function friendly(error){
  const raw=String(error?.message || error || '');
  const lower=raw.toLowerCase();
  if(lower.includes('invalid login credentials')) return 'Email or password is incorrect.';
  if(lower.includes('email not confirmed')) return 'Confirm your email from the message Supabase sent you, then sign in.';
  if(lower.includes('user already registered')) return 'That email already has an account. Use Sign in instead.';
  if(lower.includes('captcha')) return 'Please complete the bot check and try again.';
  if(lower.includes('rate limit') || lower.includes('too many')) return 'Too many attempts. Wait a little before trying again.';
  if(lower.includes('provider is not enabled')) return 'This sign-in provider has not been enabled yet.';
  if(lower.includes('failed to fetch') || lower.includes('network')) return 'Could not reach the login service. Check your connection and try again.';
  return raw || 'Something went wrong. Please try again.';
}
function setBusy(value){
  busy=value;
  [els.submit,els.google,els.forgot,els.demo].forEach(node=>{ if(node) node.disabled=value; });
  if(els.submit) els.submit.textContent=value ? 'Please wait…' : (mode==='recovery'?'Update password':mode==='create'?'Create account':'Sign in');
}
function setMode(next){
  mode=next;
  const create=mode==='create';
  const recovery=mode==='recovery';
  if(els.heading) els.heading.textContent=recovery?'Choose a new password':create?'Create your free account':'Welcome back';
  if(els.subheading) els.subheading.textContent=recovery?'Set a new password for your LinuxAid account.':create?'Create an account to sync progress and rankings across devices.':'Sign in to sync your LinuxAid workspace.';
  if(els.nameField) els.nameField.hidden=!create;
  if(els.confirmField) els.confirmField.hidden=!(create||recovery);
  const emailLabel=els.email?.closest('label'); if(emailLabel) emailLabel.hidden=recovery;
  if(els.submit) els.submit.textContent=recovery?'Update password':create?'Create account':'Sign in';
  if(els.forgot) els.forgot.hidden=create||recovery;
  if(els.google) els.google.hidden=recovery || AUTH.googleEnabled !== true;
  if(els.demo) els.demo.hidden=recovery;
  document.querySelector('.auth-divider')?.toggleAttribute('hidden', recovery || AUTH.googleEnabled !== true);
  document.querySelector('.auth-tabs')?.toggleAttribute('hidden', recovery);
  document.querySelectorAll('[data-auth-tab]').forEach(btn=>{
    const active=btn.dataset.authTab===mode; btn.classList.toggle('active',active); btn.setAttribute('aria-selected',String(active));
  });
  setMessage('');
  resetCaptcha();
}
function validatePassword(){
  const p=els.password?.value || '', c=els.confirm?.value || '';
  if(p.length<8) return 'Use at least 8 characters for your password.';
  if(!/[A-Za-z]/.test(p)||!/[0-9]/.test(p)) return 'Use both letters and numbers in your password.';
  if((mode==='create'||mode==='recovery') && p!==c) return 'The passwords do not match.';
  return '';
}
function validateCreate(){
  const name=els.name?.value.trim()||'', email=els.email?.value.trim()||'';
  if(name.length<2) return 'Enter a display name with at least 2 characters.';
  if(!/^\S+@\S+\.\S+$/.test(email)) return 'Enter a valid email address.';
  return validatePassword();
}
function requireCaptcha(){
  return CAPTCHA.provider==='turnstile' && Boolean(CAPTCHA.siteKey);
}
function captchaOptions(){ return requireCaptcha() && captchaToken ? { captchaToken } : {}; }
function resetCaptcha(){
  captchaToken='';
  try{ if(window.turnstile && turnstileWidgetId!==null) window.turnstile.reset(turnstileWidgetId); }catch{}
}
async function loadTurnstile(){
  if(!els.captcha) return;
  if(!requireCaptcha()){
    els.captcha.innerHTML='<div class="auth-captcha-note">Bot protection slot is ready. Add your Cloudflare Turnstile site key in <code>config.js</code>, then enable Turnstile in Supabase Auth.</div>';
    return;
  }
  await new Promise((resolve,reject)=>{
    if(window.turnstile) return resolve();
    const old=document.querySelector('script[data-linuxaid-turnstile]'); if(old){ old.addEventListener('load',resolve,{once:true}); return; }
    const s=document.createElement('script'); s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async=true; s.defer=true; s.dataset.linuxaidTurnstile='1'; s.onload=resolve; s.onerror=reject; document.head.appendChild(s);
  });
  els.captcha.replaceChildren();
  turnstileWidgetId=window.turnstile.render(els.captcha,{sitekey:CAPTCHA.siteKey,theme:document.body.classList.contains('light-theme')?'light':'dark',callback:token=>{captchaToken=token;},'expired-callback':()=>{captchaToken='';},'error-callback':()=>{captchaToken='';setMessage('Bot check could not load. Refresh and try again.','error');}});
}
async function initClient(){
  if(!configured()) return false;
  try{
    const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    client=createClient(SUPA.url,SUPA.publishableKey||SUPA.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}});
    const {data,error}=await client.auth.getSession(); if(error) throw error;
    if(data?.session?.user && mode!=='recovery') setMessage(`Signed in as ${data.session.user.email || 'LinuxAid learner'}.`,'success');
    return true;
  }catch(error){ setMessage(`Login service could not start: ${friendly(error)}`,'error'); return false; }
}
function demo(name='LinuxAid Learner'){
  localStorage.setItem('linuxaid-auth','true');
  localStorage.setItem('linuxaid-demo-profile',JSON.stringify({displayName:name,createdAt:new Date().toISOString()}));
  setMessage('Demo mode enabled. This device will keep your local progress.','info');
  setTimeout(()=>location.href=nextPage,500);
}
async function submit(event){
  event.preventDefault(); if(busy) return;
  if(mode==='recovery'){
    const validation=validatePassword(); if(validation) return setMessage(validation,'error');
    if(!client) return setMessage('The Supabase login service is not available.','error');
    setBusy(true); try{ const {error}=await client.auth.updateUser({password:els.password.value}); if(error) throw error; setMessage('Password updated. Redirecting…','success'); setTimeout(()=>location.href=nextPage,600); }catch(error){setMessage(friendly(error),'error');}finally{setBusy(false);} return;
  }
  const email=els.email?.value.trim()||'', password=els.password?.value||'';
  if(!email||!password) return setMessage('Enter your email and password.','error');
  if(mode==='create'){ const validation=validateCreate(); if(validation) return setMessage(validation,'error'); }
  if(!client) return demo(els.name?.value.trim()||email.split('@')[0]||'LinuxAid Learner');
  if(requireCaptcha()&&!captchaToken) return setMessage('Complete the bot check first.','error');
  setBusy(true);
  try{
    if(mode==='create'){
      const redirect=new URL('auth.html?verified=1',location.href).href;
      const {data,error}=await client.auth.signUp({email,password,options:{data:{display_name:els.name.value.trim()},emailRedirectTo:redirect,...captchaOptions()}}); if(error) throw error;
      if(data.session){setMessage('Account created. Redirecting…','success');setTimeout(()=>location.href=nextPage,650);}else{setMessage('Account created. Check your email to confirm it, then sign in.','success');setMode('signin');els.email.value=email;}
    }else{
      const {data,error}=await client.auth.signInWithPassword({email,password,options:captchaOptions()}); if(error) throw error;
      if(!data.session) throw new Error('No login session was returned.');
      setMessage('Signed in successfully. Redirecting…','success'); setTimeout(()=>location.href=nextPage,500);
    }
  }catch(error){setMessage(friendly(error),'error');resetCaptcha();}finally{setBusy(false);}
}
async function google(){
  if(AUTH.googleEnabled!==true) return setMessage('Google login is not configured yet.','info');
  if(!client) return setMessage('The Supabase login service is not available.','error');
  setBusy(true); try{ const redirectTo=new URL(nextPage,location.href).href; const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo}}); if(error) throw error; }catch(error){setMessage(friendly(error),'error');setBusy(false);}
}
async function resetPassword(){
  const email=els.email?.value.trim()||''; if(!/^\S+@\S+\.\S+$/.test(email)) return setMessage('Enter your email first.','error');
  if(!client) return setMessage('The Supabase login service is not available.','error');
  if(requireCaptcha()&&!captchaToken) return setMessage('Complete the bot check first.','error');
  setBusy(true); try{ const redirectTo=new URL('auth.html?mode=recovery',location.href).href; const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo,captchaToken:captchaToken||undefined}); if(error) throw error; setMessage('Password reset email sent. Check your inbox and spam folder.','success'); resetCaptcha(); }catch(error){setMessage(friendly(error),'error');resetCaptcha();}finally{setBusy(false);}
}

document.querySelectorAll('[data-auth-tab]').forEach(btn=>btn.addEventListener('click',()=>setMode(btn.dataset.authTab)));
els.form?.addEventListener('submit',submit); els.google?.addEventListener('click',google); els.forgot?.addEventListener('click',resetPassword); els.demo?.addEventListener('click',()=>demo(els.name?.value.trim()||'LinuxAid Learner'));
els.togglePassword?.addEventListener('click',()=>{const show=els.password.type==='password';els.password.type=show?'text':'password';els.togglePassword.innerHTML=`<i class="fas ${show?'fa-eye-slash':'fa-eye'}"></i>`;els.togglePassword.setAttribute('aria-label',show?'Hide password':'Show password');});

const ready=await initClient();
if(!ready && !configured()) setMessage('Supabase is not configured. Demo mode is still available.','info');
if(new URLSearchParams(location.search).get('verified')==='1') setMessage('Email confirmation received. Sign in to continue.','success');
setMode(mode);
loadTurnstile().catch(()=>setMessage('Bot-check component could not load. Login still works while CAPTCHA is disabled in Supabase.','info'));
