import { COMMAND_CATALOG } from './commandCatalog.js';
import { getProgressSummary } from './progress.js';
import { rankFromXp } from './ranks.js';

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

function localDayKey(){
  const d=new Date(),p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}
function hash(value){let h=2166136261;for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}

function setupLegendImages(){
  document.querySelectorAll('.legend-media img[data-fallback]').forEach(img=>{
    const fallback=()=>{
      if(img.dataset.failed==='1')return;
      img.dataset.failed='1';img.hidden=true;
      const mark=document.createElement('div');mark.className='legend-fallback';mark.setAttribute('aria-hidden','true');mark.textContent=img.dataset.fallback||'Linux';
      img.parentElement?.prepend(mark);
    };
    img.addEventListener('error',fallback,{once:true});
    if(img.complete&&!img.naturalWidth)fallback();
  });
}

function setupLegends(){
  const root=$('[data-legends-carousel]');if(!root)return;
  const track=root.querySelector('.legend-track'),slides=[...root.querySelectorAll('.legend-slide')],dots=[...root.querySelectorAll('.legend-dot')];
  const prev=root.querySelector('[data-legend-prev]'),next=root.querySelector('[data-legend-next]'),toggle=root.querySelector('[data-legend-toggle]');
  let index=0,timer=null,startX=null,userPaused=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const show=(nextIndex,{restart=true}={})=>{
    index=(nextIndex+slides.length)%slides.length;
    track.style.transform=`translateX(-${index*100}%)`;
    slides.forEach((slide,i)=>{const inactive=i!==index;slide.setAttribute('aria-hidden',String(inactive));slide.tabIndex=inactive?-1:0;slide.toggleAttribute('inert',inactive)});
    dots.forEach((dot,i)=>{dot.classList.toggle('active',i===index);dot.setAttribute('aria-current',i===index?'true':'false')});
    if(restart)play();
  };
  const stop=()=>{clearTimeout(timer);timer=null;root.classList.remove('is-playing')};
  const play=()=>{stop();if(reduced||document.hidden||userPaused)return;root.classList.add('is-playing');void root.offsetWidth;timer=setTimeout(()=>show(index+1),7000)};
  prev?.addEventListener('click',()=>show(index-1));
  next?.addEventListener('click',()=>show(index+1));
  toggle?.addEventListener('click',()=>{userPaused=!userPaused;toggle.setAttribute('aria-label',userPaused?'Play carousel':'Pause carousel');toggle.innerHTML=userPaused?'<i class="fas fa-play"></i>':'<i class="fas fa-pause"></i>';userPaused?stop():play()});
  dots.forEach((dot,i)=>dot.addEventListener('click',()=>show(i)));
  root.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||e.pointerType==='pen'){startX=e.clientX;stop()}},{passive:true});
  root.addEventListener('pointerup',e=>{if(startX===null)return;const delta=e.clientX-startX;startX=null;if(Math.abs(delta)>45)show(index+(delta<0?1:-1));else play()},{passive:true});
  root.addEventListener('mouseenter',stop);root.addEventListener('mouseleave',play);
  root.addEventListener('focusin',stop);root.addEventListener('focusout',e=>{if(!root.contains(e.relatedTarget))play()});
  document.addEventListener('visibilitychange',()=>document.hidden?stop():play());
  show(0);
}

function setupDailySpark(){
  const command=$('#sparkCommand'),description=$('#sparkDescription'),tryButton=$('#sparkTry'),askButton=$('#sparkAsk');
  if(!command||!COMMAND_CATALOG?.length)return;
  const safe=COMMAND_CATALOG.filter(item=>item.safety==='safe'||item.safety==='low');
  const pool=safe.length?safe:COMMAND_CATALOG;
  const item=pool[hash(localDayKey())%pool.length];
  const example=(item.examples?.[0]||item.syntax||item.name).trim();
  command.textContent=example;
  description.textContent=item.explanation||'Explore what this command does, then try it safely in LinuxAid.';
  if(tryButton)tryButton.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('linuxaid:open-terminal',{detail:{command:example}})));
  if(askButton)askButton.href=`dashboard.html?mode=explain&ask=${encodeURIComponent(`Explain this Linux command safely: ${example}`)}#assistant`;
}

function setupResume(){
  const root=$('#homeResume');if(!root)return;
  const progress=getProgressSummary();
  const hasProgress=(progress.xp||0)>0||(progress.learnedCommands?.length||0)>0||(progress.quizzesCompleted||0)>0||(progress.streakDays||0)>0;
  if(!hasProgress)return;
  const rank=rankFromXp(progress.xp||0);
  root.hidden=false;
  $('#homeResumeTitle').textContent=`Welcome back — ${rank.current.name}`;
  $('#homeResumeText').textContent=progress.streakDays>0
    ?`You are on a ${progress.streakDays}-day learning streak. Keep the momentum with one small activity.`
    :'Your LinuxAid progress is waiting. Pick up with a quick activity.';
  $('#homeResumeXp').textContent=`${progress.xp||0} XP`;
  $('#homeResumeCommands').textContent=`${progress.learnedCommands?.length||0} commands explored`;
  $('#homeResumeQuizzes').textContent=`${progress.quizzesCompleted||0} quiz rounds`;
}

function setupSurprise(){
  const button=$('#surpriseMe');if(!button)return;
  const choices=[
    ['play.html','Take a quick Linux challenge'],
    ['labs.html','Solve a practical Linux lab'],
    ['tools.html','Open a troubleshooting tool'],
    ['dashboard.html?mode=quiz&ask=Quiz%20me%20on%20a%20random%20Linux%20topic#assistant','Let the AI quiz you'],
    ['install.html','Explore a Linux installation path']
  ];
  button.addEventListener('click',()=>{
    const [href]=choices[Math.floor(Math.random()*choices.length)];
    location.href=href;
  });
}

setupLegendImages();setupLegends();setupDailySpark();setupResume();setupSurprise();
