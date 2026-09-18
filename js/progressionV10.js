import { getProgressSummary } from './progress.js';
import { rankFromXp } from './ranks.js';

const SNAPSHOT='linuxaid-progression-ui-v10';

function readSnapshot(){
  try{return JSON.parse(localStorage.getItem(SNAPSHOT)||'null')}catch{return null}
}
function writeSnapshot(value){
  try{localStorage.setItem(SNAPSHOT,JSON.stringify(value))}catch{}
}
function currentSnapshot(){
  const p=getProgressSummary(),rank=rankFromXp(p.xp);
  return {xp:p.xp,rank:rank.current.name,achievements:[...(p.achievements||[])]};
}
function toast({icon='fa-sparkles',title,message,tone='accent'}){
  let stack=document.querySelector('.reward-toast-stack');
  if(!stack){
    stack=document.createElement('div');stack.className='reward-toast-stack';stack.setAttribute('aria-live','polite');document.body.appendChild(stack);
  }
  const el=document.createElement('div');el.className=`reward-toast ${tone}`;
  el.innerHTML=`<span class="reward-toast-icon"><i class="fas ${icon}"></i></span><span><strong></strong><small></small></span><button type="button" aria-label="Dismiss"><i class="fas fa-xmark"></i></button>`;
  el.querySelector('strong').textContent=title;
  el.querySelector('small').textContent=message;
  const close=()=>{el.classList.add('leaving');setTimeout(()=>el.remove(),180)};
  el.querySelector('button').onclick=close;
  stack.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('show'));
  setTimeout(close,4200);
}
function compare(){
  const previous=readSnapshot(),next=currentSnapshot();
  if(!previous){writeSnapshot(next);return}
  const newAchievements=next.achievements.filter(x=>!previous.achievements?.includes(x));
  if(next.rank!==previous.rank){
    toast({icon:'fa-ranking-star',title:'Rank up!',message:`You reached ${next.rank}.`,tone:'rank'});
  }
  if(newAchievements.length){
    toast({icon:'fa-medal',title:'Achievement unlocked',message:newAchievements[0],tone:'achievement'});
  }
  writeSnapshot(next);
}
function xpToast(event){
  const reward=Number(event.detail?.reward||0);
  if(reward>0)toast({icon:'fa-bolt',title:`+${reward} XP`,message:'Your LinuxAid practice moved forward.'});
}
function start(){
  compare();
  document.addEventListener('linuxaid:progress-changed',compare);
  document.addEventListener('linuxaid:state-synced',compare);
  document.addEventListener('linuxaid:game-result',xpToast);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
