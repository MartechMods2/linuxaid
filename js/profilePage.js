import {
  initBackend, getBackendStatus, onAuthStateChangedListener,
  loadUserProfile, saveUserProfile, uploadAvatar
} from '../backend.js';
import { getProgressSummary, exportProgress, importProgress, resetProgress } from './progress.js';
import { LABS, readLearningState } from './learningData.js';
import { identifyAnalyticsUser, setAnalyticsOptOut, isAnalyticsOptedOut } from './analytics.js';

const config=window.LINUXAID_CONFIG||{};
await initBackend(config);
const backend=getBackendStatus();
const backendReady=backend.ready;
let currentUser=backend.user||null;
let activeProfile={};
let appearanceTimer=null;
const $=id=>document.getElementById(id);

function localProfile(){try{return JSON.parse(localStorage.getItem('linuxaid-demo-profile')||'{}')||{}}catch{return{}}}
function saveLocalProfile(profile){
  const current=localProfile();
  localStorage.setItem('linuxaid-demo-profile',JSON.stringify({...current,...profile,updatedAt:new Date().toISOString()}));
}
function themePrefs(){
  return window.LinuxAidTheme?.getPreferences?.()||{
    mode:localStorage.getItem('linuxaid-theme-mode')||'light',
    accent:localStorage.getItem('linuxaid-accent-color')||'#16a34a'
  };
}
function stat(value,label){
  const el=document.createElement('div');el.className='stat-card';
  const strong=document.createElement('strong');strong.textContent=value;
  const span=document.createElement('span');span.textContent=label;
  el.append(strong,span);return el;
}

function renderProgress(){
  const progress=getProgressSummary(),learning=readLearningState();
  $('profileStats')?.replaceChildren(
    stat(progress.xp,'XP earned'),
    stat(progress.learnedCommands.length,'Commands explored'),
    stat(progress.streakDays,'Day streak'),
    stat(progress.quizzesCompleted||0,'Quiz rounds'),
    stat(progress.level,'Learner level')
  );
  const achievements=$('achievementGrid');
  if(achievements){
    achievements.replaceChildren();
    const list=progress.achievements.length?progress.achievements:['Run 5 unique commands to unlock your first achievement'];
    list.forEach(name=>{
      const badge=document.createElement('span');badge.className='badge-pill';
      badge.innerHTML='<i class="fas fa-medal" aria-hidden="true"></i>';
      badge.append(document.createTextNode(` ${name}`));achievements.appendChild(badge);
    });
  }
  const map=$('skillMap');
  if(map){
    map.replaceChildren();
    const rows=[
      ['Beginner commands',progress.roadmap.beginner],
      ['Intermediate commands',progress.roadmap.intermediate],
      ['Advanced commands',progress.roadmap.advanced],
      ['Hands-on labs',Math.round((learning.completedLabs.length/Math.max(1,LABS.length))*100)],
      ['Quiz accuracy',Math.round(((progress.gameStats?.correct||0)/Math.max(1,progress.gameStats?.questions||0))*100)]
    ];
    rows.forEach(([label,value])=>{
      const row=document.createElement('div');row.style.marginBottom='18px';
      const head=document.createElement('div');head.style.cssText='display:flex;justify-content:space-between;gap:14px;margin-bottom:7px';
      const name=document.createElement('span');name.textContent=label;
      const percent=document.createElement('strong');percent.textContent=`${value}%`;head.append(name,percent);
      const bar=document.createElement('div');bar.className='course-progress';
      const fill=document.createElement('span');fill.style.width=`${Math.min(100,value)}%`;bar.appendChild(fill);
      row.append(head,bar);map.appendChild(row);
    });
  }
}

function applyAppearance(profile={}){
  const local=localProfile();
  const current=themePrefs();
  const mode=profile.themeMode||local.themeMode||current.mode||'light';
  const accent=profile.accentColor||local.accentColor||current.accent||'#16a34a';
  window.LinuxAidTheme?.setPreferences?.(mode,accent,{emit:false});
  if($('themeModeSelect'))$('themeModeSelect').value=mode;
  if($('themeAccentColor'))$('themeAccentColor').value=accent;
  document.querySelectorAll('[data-accent-choice]').forEach(b=>b.classList.toggle('active',b.dataset.accentChoice.toLowerCase()===accent.toLowerCase()));
}

function renderIdentity(profile={}){
  const local=localProfile();
  activeProfile={...local,...profile};
  const name=profile.displayName||currentUser?.displayName||local.displayName||'LinuxAid Learner';
  const email=currentUser?.email||profile.email||'';
  const avatar=profile.avatarUrl||currentUser?.avatarUrl||local.avatarUrl||'';
  $('profileName').textContent=name;
  $('profileIdentity').textContent=email||(backendReady?'LinuxAid synced account':'Browser-only profile');
  const orb=$('profileAvatar');
  if(orb){
    orb.textContent=avatar?'':(name.trim()[0]||'L').toUpperCase();
    orb.style.backgroundImage=avatar?`url("${String(avatar).replaceAll('"','%22')}")`:'';
    orb.style.backgroundSize='cover';orb.style.backgroundPosition='center';
  }
  $('profileDisplayName').value=name;
  $('profileDistro').value=profile.distro||local.distro||'';
  $('profileGoal').value=profile.learningGoal||local.learningGoal||'';
  applyAppearance(profile);
  identifyAnalyticsUser(currentUser,profile);
}

async function handleAuth(user){
  currentUser=user||null;
  if(user){
    try{
      const remote=await loadUserProfile(user.uid);
      renderIdentity(remote||{});
      $('accountAction').textContent='Account active';$('accountAction').href='auth.html';
      const status=$('appearanceStatus');if(status)status.textContent='Synced';
    }catch(error){console.error(error);renderIdentity(localProfile())}
  }else{
    renderIdentity(localProfile());
    $('accountAction').textContent='Sign in to sync';$('accountAction').href='auth.html';
  }
}

$('profileForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const prefs=themePrefs();
  const profile={
    ...activeProfile,
    displayName:$('profileDisplayName').value.trim(),
    distro:$('profileDistro').value,
    learningGoal:$('profileGoal').value.trim(),
    avatarUrl:activeProfile.avatarUrl||localProfile().avatarUrl||'',
    themeMode:prefs.mode,
    accentColor:prefs.accent
  };
  activeProfile=profile;saveLocalProfile(profile);
  if(backendReady&&currentUser){try{await saveUserProfile(currentUser.uid,profile)}catch(error){console.error(error)}}
  renderIdentity(profile);
  const button=event.submitter,old=button.textContent;button.textContent='Saved ✓';setTimeout(()=>button.textContent=old,900);
});

async function persistAppearance(detail){
  const profile={
    ...activeProfile,
    ...localProfile(),
    displayName:activeProfile.displayName||$('profileDisplayName')?.value?.trim()||currentUser?.displayName||'LinuxAid Learner',
    distro:activeProfile.distro||$('profileDistro')?.value||'',
    learningGoal:activeProfile.learningGoal||$('profileGoal')?.value?.trim()||'',
    avatarUrl:activeProfile.avatarUrl||localProfile().avatarUrl||'',
    themeMode:detail.mode,
    accentColor:detail.accent
  };
  activeProfile=profile;saveLocalProfile(profile);
  const status=$('appearanceStatus');if(status)status.textContent=currentUser?'Syncing…':'Saved locally';
  if(backendReady&&currentUser){
    try{await saveUserProfile(currentUser.uid,profile);if(status)status.textContent='Synced ✓'}
    catch(error){console.error(error);if(status)status.textContent='Saved locally'}
  }
}

document.addEventListener('linuxaid:theme-change',event=>{
  clearTimeout(appearanceTimer);
  appearanceTimer=setTimeout(()=>persistAppearance(event.detail||themePrefs()),450);
});

$('avatarUpload')?.addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  const status=$('avatarStatus');
  if(!backendReady||!currentUser){if(status)status.textContent='Sign in to sync a profile picture.';return}
  if(file.size>2*1024*1024){if(status)status.textContent='That image is larger than 2 MB.';event.target.value='';return}
  if(status)status.textContent='Uploading image…';
  try{
    const url=await uploadAvatar(file);saveLocalProfile({avatarUrl:url});
    const profile=await loadUserProfile(currentUser.uid)||{...activeProfile,avatarUrl:url};
    renderIdentity(profile);if(status)status.textContent='Profile picture updated ✓';
  }catch(error){if(status)status.textContent=error.message||'Image upload failed.'}
  finally{event.target.value=''}
});

$('exportProgress')?.addEventListener('click',()=>{
  const payload={...exportProgress(),learning:readLearningState(),profile:localProfile()};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`linuxaid-progress-${new Date().toISOString().slice(0,10)}.json`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('importProgress')?.addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    const payload=JSON.parse(await file.text());importProgress(payload);
    if(payload.learning)localStorage.setItem('linuxaid-learning-v1',JSON.stringify(payload.learning));
    if(payload.profile)saveLocalProfile(payload.profile);location.reload();
  }catch(error){alert(`Could not import LinuxAid progress: ${error.message}`)}
});
$('resetProgress')?.addEventListener('click',()=>{
  if(!confirm('Reset local LinuxAid command, quiz and lab progress on this browser?'))return;
  resetProgress();localStorage.removeItem('linuxaid-learning-v1');renderProgress();
});

const analyticsToggle=$('analyticsOptOut');
if(analyticsToggle){analyticsToggle.checked=!isAnalyticsOptedOut();analyticsToggle.addEventListener('change',()=>setAnalyticsOptOut(!analyticsToggle.checked))}
const coffee=$('supportCoffee');
if(coffee&&config?.product?.supportUrl){coffee.href=config.product.supportUrl;coffee.target='_blank';coffee.rel='noopener noreferrer'}

document.addEventListener('linuxaid:state-synced',()=>{
  renderProgress();const status=$('syncStatus');if(status)status.textContent='Synced securely ✓';
});
document.addEventListener('linuxaid:sync-status',event=>{
  const status=$('syncStatus');if(!status)return;
  status.textContent=event.detail?.status==='synced'?'Synced securely ✓':`Sync issue: ${event.detail?.message||'try again later'}`;
});

renderProgress();renderIdentity(localProfile());
if(backendReady)onAuthStateChangedListener(handleAuth);else handleAuth(null);
