import { getSessionUser, signOut } from './authClientV5.js';

const config=window.LINUXAID_CONFIG||{};
const warningMs=Math.max(60_000,Number(config.security?.idleWarningMs||25*60*1000));
const signOutMs=Math.max(warningMs+60_000,Number(config.security?.idleSignOutMs||30*60*1000));
let user=null,warningTimer=null,signOutTimer=null,lastActivity=Date.now();

function clearTimers(){clearTimeout(warningTimer);clearTimeout(signOutTimer);warningTimer=signOutTimer=null}
function hideWarning(){document.querySelector('.session-security-toast')?.remove()}
function showWarning(){
  if(!user||document.querySelector('.session-security-toast'))return;
  const toast=document.createElement('div');toast.className='session-security-toast';toast.setAttribute('role','status');
  toast.innerHTML='<strong>Still there?</strong><br>Your LinuxAid session will sign out after extended inactivity. Use the page to keep working.';
  document.body.appendChild(toast);
}
function schedule(){
  clearTimers();hideWarning();if(!user)return;
  const elapsed=Date.now()-lastActivity;
  warningTimer=setTimeout(showWarning,Math.max(0,warningMs-elapsed));
  signOutTimer=setTimeout(async()=>{
    try{await signOut()}catch{}
    try{sessionStorage.setItem('linuxaid-session-message','Signed out after inactivity for account security.')}catch{}
    location.href='auth.html?reason=idle';
  },Math.max(1000,signOutMs-elapsed));
}
function activity(){
  const now=Date.now();
  if(now-lastActivity<1000)return;
  lastActivity=now;schedule();
}

async function start(){
  try{user=await getSessionUser()}catch{return}
  if(!user)return;
  ['pointerdown','keydown','touchstart'].forEach(name=>addEventListener(name,activity,{passive:true}));
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden){lastActivity=Date.now();schedule()}
  });
  schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
