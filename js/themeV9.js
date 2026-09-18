const STORAGE_MODE='linuxaid-theme-mode';
const STORAGE_ACCENT='linuxaid-accent-color';
const LEGACY_KEY='linuxaid-theme';
const DEFAULT_MODE='light';
const DEFAULT_ACCENT='#16a34a';
const MODES=new Set(['light','dark','system']);

function safeRead(key,fallback=''){try{return localStorage.getItem(key)||fallback}catch{return fallback}}
function safeWrite(key,value){try{localStorage.setItem(key,value)}catch{}}
function normalizeMode(value){return MODES.has(value)?value:DEFAULT_MODE}
function normalizeAccent(value){const v=String(value||'').trim();return /^#[0-9a-f]{6}$/i.test(v)?v.toLowerCase():DEFAULT_ACCENT}
function systemMode(){return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
function effectiveMode(mode){return mode==='system'?systemMode():mode}
function luminance(hex){const n=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4));return .2126*n[0]+.7152*n[1]+.0722*n[2]}
function contrastFor(hex){return luminance(hex)>.5?'#07120c':'#ffffff'}

let mode=normalizeMode(safeRead(STORAGE_MODE,safeRead(LEGACY_KEY,DEFAULT_MODE)));
let accent=normalizeAccent(safeRead(STORAGE_ACCENT,DEFAULT_ACCENT));
let remoteUser=null,remoteProfile=null,remoteSaveTimer=null;

function updateMeta(effective){
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=effective==='light'?'#ffffff':'#06100c';
}

function apply({emit=true}={}){
  const effective=effectiveMode(mode);
  const root=document.documentElement;
  root.dataset.theme=effective;
  root.dataset.themeMode=mode;
  root.style.setProperty('--user-accent',accent);
  root.style.setProperty('--user-accent-contrast',contrastFor(accent));
  if(document.body){
    document.body.classList.toggle('light-theme',effective==='light');
    document.body.classList.toggle('dark-theme',effective==='dark');
  }
  updateMeta(effective);
  document.querySelectorAll('#themeToggle').forEach(button=>{
    button.dataset.theme=effective;
    button.setAttribute('aria-label',effective==='light'?'Switch to dark theme':'Switch to light theme');
    button.setAttribute('title',effective==='light'?'Dark theme':'Light theme');
    const icon=button.querySelector('i');
    if(icon)icon.className=effective==='light'?'fas fa-moon':'fas fa-sun';
  });
  const select=document.getElementById('themeModeSelect');
  if(select)select.value=mode;
  const color=document.getElementById('themeAccentColor');
  if(color)color.value=accent;
  document.querySelectorAll('[data-accent-choice]').forEach(button=>button.classList.toggle('active',normalizeAccent(button.dataset.accentChoice)===accent));
  if(emit)document.dispatchEvent(new CustomEvent('linuxaid:theme-change',{detail:{mode,effective,accent}}));
}

function scheduleRemoteSave(){
  if(!remoteUser||!remoteProfile)return;
  clearTimeout(remoteSaveTimer);
  remoteSaveTimer=setTimeout(async()=>{
    try{
      const backend=await import('../backend.js');
      const next={...remoteProfile,themeMode:mode,accentColor:accent};
      await backend.saveUserProfile(remoteUser.uid,next);
      remoteProfile=next;
    }catch{}
  },650);
}
function setMode(next,{persist=true,emit=true,remote=true}={}){
  mode=normalizeMode(next);
  if(persist){safeWrite(STORAGE_MODE,mode);safeWrite(LEGACY_KEY,effectiveMode(mode));}
  apply({emit});
  if(remote)scheduleRemoteSave();
}
function setAccent(next,{persist=true,emit=true,remote=true}={}){
  accent=normalizeAccent(next);
  if(persist)safeWrite(STORAGE_ACCENT,accent);
  apply({emit});
  if(remote)scheduleRemoteSave();
}
function setPreferences(nextMode,nextAccent,options={}){
  mode=normalizeMode(nextMode||mode);
  accent=normalizeAccent(nextAccent||accent);
  if(options.persist!==false){safeWrite(STORAGE_MODE,mode);safeWrite(LEGACY_KEY,effectiveMode(mode));safeWrite(STORAGE_ACCENT,accent)}
  apply({emit:options.emit!==false});
  if(options.remote!==false)scheduleRemoteSave();
}
function getPreferences(){return{mode,accent,effective:effectiveMode(mode)}}

function bindThemeButtons(){
  document.querySelectorAll('#themeToggle').forEach(button=>{
    if(button.dataset.themeBound==='1')return;
    button.dataset.themeBound='1';
    button.addEventListener('click',()=>{
      const current=effectiveMode(mode);
      setMode(current==='light'?'dark':'light');
    });
  });
}
function bindAppearanceControls(){
  const select=document.getElementById('themeModeSelect');
  if(select&&!select.dataset.bound){select.dataset.bound='1';select.addEventListener('change',()=>setMode(select.value))}
  document.querySelectorAll('[data-accent-choice]').forEach(button=>{
    if(button.dataset.bound)return;
    button.dataset.bound='1';
    button.addEventListener('click',()=>setAccent(button.dataset.accentChoice));
  });
  const color=document.getElementById('themeAccentColor');
  if(color&&!color.dataset.bound){color.dataset.bound='1';color.addEventListener('input',()=>setAccent(color.value))}
  const reset=document.getElementById('themeReset');
  if(reset&&!reset.dataset.bound){reset.dataset.bound='1';reset.addEventListener('click',()=>setPreferences(DEFAULT_MODE,DEFAULT_ACCENT))}
}

async function syncRemoteAppearance(){
  try{
    const backend=await import('../backend.js');
    await backend.initBackend(window.LINUXAID_CONFIG||{});
    const applyUser=async user=>{
      remoteUser=user||null;remoteProfile=null;
      if(!user)return;
      const profile=await backend.loadUserProfile(user.uid).catch(()=>null);
      if(!profile)return;
      remoteProfile=profile;
      const remoteMode=normalizeMode(profile.themeMode||mode);
      const remoteAccent=normalizeAccent(profile.accentColor||accent);
      setPreferences(remoteMode,remoteAccent,{emit:false,remote:false});
    };
    backend.onAuthStateChangedListener(applyUser);
    const current=backend.getBackendStatus().user;
    if(current)await applyUser(current);
  }catch{}
}

function ready(){
  apply({emit:false});
  bindThemeButtons();
  bindAppearanceControls();
  const observer=new MutationObserver(()=>{bindThemeButtons();bindAppearanceControls();apply({emit:false})});
  observer.observe(document.body,{childList:true,subtree:true});
  syncRemoteAppearance();
}

window.LinuxAidTheme={setMode,setAccent,setPreferences,getPreferences,apply};
document.documentElement.dataset.theme=effectiveMode(mode);
document.documentElement.dataset.themeMode=mode;
document.documentElement.style.setProperty('--user-accent',accent);
document.documentElement.style.setProperty('--user-accent-contrast',contrastFor(accent));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if(mode==='system')apply()});
