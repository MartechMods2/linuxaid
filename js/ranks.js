import { getProgressSummary } from './progress.js';

export const RANKS = Object.freeze([
  { name:'Kernel Seed', min:0, icon:'🌱' },
  { name:'Shell Scout', min:120, icon:'🧭' },
  { name:'Terminal Tinkerer', min:300, icon:'🛠️' },
  { name:'Command Crafter', min:600, icon:'⌨️' },
  { name:'System Solver', min:1000, icon:'🧩' },
  { name:'Linux Operator', min:1600, icon:'⚙️' },
  { name:'Kernel Navigator', min:2400, icon:'🧠' },
  { name:'Linux Legend', min:3600, icon:'👑' }
]);

export function rankFromXp(xp=0) {
  const safeXp = Math.max(0, Number(xp) || 0);
  let index = 0;
  for (let i=0;i<RANKS.length;i+=1) if (safeXp >= RANKS[i].min) index = i;
  const current = RANKS[index];
  const next = RANKS[index+1] || null;
  const span = next ? Math.max(1,next.min-current.min) : 1;
  const progress = next ? Math.min(100, Math.round(((safeXp-current.min)/span)*100)) : 100;
  return { current, next, xp:safeXp, progress, index };
}

export function renderRankPanel(root, summary=getProgressSummary()) {
  if (!root) return;
  const rank = rankFromXp(summary.xp);
  const commands = summary.learnedCommands?.length || 0;
  root.replaceChildren();
  const top = document.createElement('div'); top.className='rank-top';
  const left = document.createElement('div');
  left.innerHTML = `<div class="eyebrow">Current rank</div><div class="rank-name">${rank.current.icon} ${rank.current.name}</div>`;
  const badge = document.createElement('span'); badge.className='rank-badge'; badge.textContent=`${rank.xp} XP`;
  top.append(left,badge);
  const track=document.createElement('div'); track.className='rank-track';
  const fill=document.createElement('span'); fill.style.width=`${rank.progress}%`; track.appendChild(fill);
  const meta=document.createElement('div'); meta.className='rank-meta';
  const target=rank.next ? `${Math.max(0,rank.next.min-rank.xp)} XP to ${rank.next.name}` : 'Top rank reached';
  meta.innerHTML=`<span>${commands} commands explored • ${summary.streakDays || 0} day streak</span><span>${target}</span>`;
  root.append(top,track,meta);
}

export function renderRankLadder(root, summary=getProgressSummary()) {
  if (!root) return;
  const active=rankFromXp(summary.xp).index;
  root.replaceChildren();
  RANKS.forEach((rank,index)=>{
    const card=document.createElement('article'); card.className='feature-card glass';
    if(index===active) card.style.borderColor='rgba(32,232,122,.5)';
    const icon=document.createElement('div'); icon.className='feature-icon'; icon.textContent=rank.icon;
    const h=document.createElement('h3'); h.textContent=rank.name;
    const p=document.createElement('p'); p.textContent=index===0?'Starting rank':`${rank.min.toLocaleString()} XP milestone`;
    card.append(icon,h,p); root.appendChild(card);
  });
}
