import {
  initFirebase, onAuthStateChangedListener, loadUserProfile, saveUserProfile
} from '../firebase.js';
import { getProgressSummary, exportProgress, importProgress, resetProgress } from './progress.js';
import { COURSES, LABS, readLearningState } from './learningData.js';

const config = window.LINUXAID_CONFIG || {};
const firebaseReady = Boolean(config.firebase?.apiKey && config.firebase?.projectId && initFirebase(config.firebase));
let currentUser = null;

const $ = id => document.getElementById(id);

function localProfile() {
  try {
    return JSON.parse(localStorage.getItem('linuxaid-demo-profile') || '{}') || {};
  } catch { return {}; }
}

function saveLocalProfile(profile) {
  const current = localProfile();
  localStorage.setItem('linuxaid-demo-profile', JSON.stringify({ ...current, ...profile, updatedAt:new Date().toISOString() }));
}

function stat(value,label) {
  const el = document.createElement('div'); el.className='stat-card';
  const strong=document.createElement('strong'); strong.textContent=value;
  const span=document.createElement('span'); span.textContent=label;
  el.append(strong,span); return el;
}

function renderProgress() {
  const progress = getProgressSummary();
  const learning = readLearningState();
  const stats = $('profileStats');
  stats?.replaceChildren(
    stat(progress.xp,'XP earned'),
    stat(progress.learnedCommands.length,'Commands explored'),
    stat(progress.streakDays,'Day streak'),
    stat(progress.level,'Learner level')
  );

  const achievements = $('achievementGrid');
  if (achievements) {
    achievements.replaceChildren();
    const list = progress.achievements.length ? progress.achievements : ['Run 5 unique commands to unlock your first achievement'];
    list.forEach(name => {
      const badge=document.createElement('span'); badge.className='badge-pill';
      badge.innerHTML='<i class="fas fa-medal" aria-hidden="true"></i>';
      badge.append(document.createTextNode(` ${name}`)); achievements.appendChild(badge);
    });
  }

  const map = $('skillMap');
  if (map) {
    map.replaceChildren();
    const rows = [
      ['Beginner commands',progress.roadmap.beginner],
      ['Intermediate commands',progress.roadmap.intermediate],
      ['Advanced commands',progress.roadmap.advanced],
      ['Course lessons',Math.round((learning.completedLessons.length / Math.max(1,COURSES.reduce((sum,c)=>sum+c.lessons.length,0))) * 100)],
      ['Hands-on labs',Math.round((learning.completedLabs.length / Math.max(1,LABS.length)) * 100)]
    ];
    rows.forEach(([label,value]) => {
      const row=document.createElement('div'); row.style.marginBottom='18px';
      const head=document.createElement('div'); head.style.cssText='display:flex;justify-content:space-between;gap:14px;margin-bottom:7px';
      const name=document.createElement('span'); name.textContent=label;
      const percent=document.createElement('strong'); percent.textContent=`${value}%`;
      head.append(name,percent);
      const bar=document.createElement('div'); bar.className='course-progress';
      const fill=document.createElement('span'); fill.style.width=`${Math.min(100,value)}%`; bar.appendChild(fill);
      row.append(head,bar); map.appendChild(row);
    });
  }
}

function renderIdentity(profile={}) {
  const local = localProfile();
  const name = profile.displayName || currentUser?.displayName || local.displayName || 'LinuxAid Learner';
  const email = currentUser?.email || profile.email || '';
  $('profileName').textContent=name;
  $('profileIdentity').textContent = email || (firebaseReady ? 'Firebase profile' : 'Browser-only profile');
  $('profileAvatar').textContent=(name.trim()[0] || 'L').toUpperCase();
  $('profileDisplayName').value=name;
  $('profileDistro').value=profile.distro || local.distro || '';
  $('profileGoal').value=profile.learningGoal || local.learningGoal || '';
}

async function handleAuth(user) {
  currentUser = user || null;
  if (user) {
    const remote = await loadUserProfile(user.uid);
    renderIdentity(remote || {});
    $('accountAction').textContent='Account active';
  } else renderIdentity(localProfile());
}

$('profileForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const profile = {
    displayName:$('profileDisplayName').value.trim(),
    distro:$('profileDistro').value,
    learningGoal:$('profileGoal').value.trim()
  };
  saveLocalProfile(profile);
  if (firebaseReady && currentUser) {
    try { await saveUserProfile(currentUser.uid, profile); } catch (error) { console.error(error); }
  }
  renderIdentity(profile);
  const button=event.submitter; const old=button.textContent; button.textContent='Saved ✓'; setTimeout(()=>button.textContent=old,900);
});

$('exportProgress')?.addEventListener('click', () => {
  const payload = {
    ...exportProgress(),
    learning:readLearningState(),
    profile:localProfile()
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`linuxaid-progress-${new Date().toISOString().slice(0,10)}.json`; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});

$('importProgress')?.addEventListener('change', async event => {
  const file=event.target.files?.[0]; if (!file) return;
  try {
    const payload=JSON.parse(await file.text());
    importProgress(payload);
    if (payload.learning) localStorage.setItem('linuxaid-learning-v1', JSON.stringify(payload.learning));
    if (payload.profile) saveLocalProfile(payload.profile);
    location.reload();
  } catch (error) {
    alert(`Could not import LinuxAid progress: ${error.message}`);
  }
});

$('resetProgress')?.addEventListener('click', () => {
  if (!confirm('Reset local LinuxAid command progress, course progress and lab progress on this browser?')) return;
  resetProgress();
  localStorage.removeItem('linuxaid-learning-v1');
  renderProgress();
});

renderProgress();
renderIdentity(localProfile());
if (firebaseReady) onAuthStateChangedListener(handleAuth);
