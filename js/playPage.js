import { QUIZ_BANK } from './quizBank.js';
import { getProgressSummary, recordGameResult } from './progress.js';

const $=id=>document.getElementById(id);
let round=null;
let index=0;
let score=0;
let combo=0;
let bestCombo=0;
let answered=false;
let misses=[];

function hashString(value){
  let h=2166136261;
  for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
  return h>>>0;
}
function mulberry32(seed){return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function shuffled(list,seed=Math.floor(Math.random()*2**31)){
  const rnd=mulberry32(seed),arr=[...list];
  for(let i=arr.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}
  return arr;
}
function dateKey(){
  const d=new Date(),pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function randomizeOptions(question,seed){
  const choices=shuffled(question.options.map((label,index)=>({label,index})),seed);
  return {...question,options:choices.map(x=>x.label),answer:choices.findIndex(x=>x.index===question.answer)};
}
function buildRound(mode){
  if(mode==='daily'){
    const key=dateKey(),seed=hashString(key);
    const questions=shuffled(QUIZ_BANK,seed).slice(0,5).map((q,i)=>randomizeOptions(q,seed+i*7919));
    return {mode,title:'Daily Mission',dailyKey:key,questions};
  }
  if(mode==='safety'){
    const seed=Math.floor(Math.random()*2**31);
    const questions=shuffled(QUIZ_BANK.filter(q=>q.category==='Safety'||q.category==='Permissions'),seed).slice(0,7).map((q,i)=>randomizeOptions(q,seed+i*6151));
    return {mode,title:'Safety Check',dailyKey:'',questions};
  }
  const seed=Math.floor(Math.random()*2**31);
  return {mode:'quick',title:'Quick Fire',dailyKey:'',questions:shuffled(QUIZ_BANK,seed).slice(0,10).map((q,i)=>randomizeOptions(q,seed+i*3571))};
}
function updateStats(){
  const p=getProgressSummary();
  const game=p.gameStats||{};
  $('playXp').textContent=p.xp.toLocaleString();
  $('playStreak').textContent=String(p.streakDays||0);
  $('playBest').textContent=`${game.bestPercent||0}%`;
  $('playRounds').textContent=String(game.plays||0);
  const dailyDone=(p.dailyRewardKeys||[]).includes(dateKey());
  $('dailyState').textContent=dailyDone?'Completed today ✓':'Available now';
  $('dailyState').dataset.done=String(dailyDone);
}
function setScreen(name){
  $('playModes').hidden=name!=='modes';
  $('quizArena').hidden=name!=='quiz';
  $('quizResult').hidden=name!=='result';
}
function start(mode){
  round=buildRound(mode);index=0;score=0;combo=0;bestCombo=0;answered=false;misses=[];
  $('roundTitle').textContent=round.title;
  setScreen('quiz');
  renderQuestion();
  $('quizArena').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderQuestion(){
  const q=round.questions[index];
  answered=false;
  $('quizCounter').textContent=`${index+1} / ${round.questions.length}`;
  $('quizCategory').textContent=`${q.category} • ${q.difficulty}`;
  $('quizPrompt').textContent=q.prompt;
  $('quizProgressFill').style.width=`${Math.round((index/round.questions.length)*100)}%`;
  $('quizFeedback').hidden=true;
  $('quizNext').hidden=true;
  const root=$('quizChoices');root.replaceChildren();
  q.options.forEach((label,optionIndex)=>{
    const button=document.createElement('button');
    button.type='button';button.className='quiz-choice';
    button.innerHTML=`<span>${optionIndex+1}</span><strong>${label}</strong>`;
    button.addEventListener('click',()=>choose(optionIndex,button));
    root.appendChild(button);
  });
}
function choose(optionIndex,button){
  if(answered)return;
  answered=true;
  const q=round.questions[index],correct=optionIndex===q.answer;
  if(correct){score+=1;combo+=1;bestCombo=Math.max(bestCombo,combo);navigator.vibrate?.(18)}else{combo=0;misses.push(q);navigator.vibrate?.([18,35,18])}
  [...$('quizChoices').children].forEach((node,i)=>{
    node.disabled=true;
    if(i===q.answer)node.classList.add('correct');
    else if(i===optionIndex)node.classList.add('wrong');
  });
  $('quizFeedback').hidden=false;
  $('quizFeedback').className=`quiz-feedback ${correct?'good':'learn'}`;
  $('quizFeedback').innerHTML=`<strong>${correct?'Nice! + combo':'Good attempt — learn this one.'}</strong><span>${q.explanation}</span>`;
  $('comboValue').textContent=`${combo}×`;
  $('quizNext').hidden=false;
  $('quizNext').textContent=index===round.questions.length-1?'See results':'Next question';
}
function next(){
  if(!answered)return;
  index+=1;
  if(index>=round.questions.length)return finish();
  renderQuestion();
}
function celebrate(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const colors=['#22c55e','#38bdf8','#a78bfa','#f59e0b','#fb7185'];
  for(let i=0;i<30;i++){
    const p=document.createElement('i');p.className='quiz-confetti';
    p.style.left=`${10+Math.random()*80}%`;p.style.setProperty('--c',colors[i%colors.length]);p.style.setProperty('--d',`${.6+Math.random()*.7}s`);
    document.body.appendChild(p);setTimeout(()=>p.remove(),1600);
  }
}
function finish(){
  const result=recordGameResult({score,total:round.questions.length,mode:round.mode,dailyKey:round.dailyKey,reason:`${round.title}: ${score}/${round.questions.length}`});
  setScreen('result');
  $('resultScore').textContent=`${score}/${round.questions.length}`;
  $('resultPercent').textContent=`${result.percent}%`;
  $('resultXp').textContent=`+${result.reward} XP`;
  $('resultCombo').textContent=`${bestCombo}× best combo`;
  const message=result.percent===100?'Perfect round. That was clean.':result.percent>=80?'Strong run. You are building real command instincts.':result.percent>=60?'Good base. Review the misses and go again.':'Keep going. Linux gets easier through repetition.';
  $('resultMessage').textContent=message;
  const review=$('resultReview');review.replaceChildren();
  if(misses.length){
    const h=document.createElement('strong');h.textContent='Review your misses';review.appendChild(h);
    misses.slice(0,4).forEach(q=>{const p=document.createElement('p');p.textContent=\`• \${q.explanation}\`;review.appendChild(p)});
  }else{review.innerHTML='<strong>No misses this round.</strong><p>Perfect recall. Try another mode or a harder lab.</p>'}
  if(result.percent===100)celebrate();
  updateStats();
}
function keyboard(event){
  if($('quizArena').hidden)return;
  if(['1','2','3','4'].includes(event.key)&&!answered){
    const i=Number(event.key)-1;
    $('quizChoices').children[i]?.click();
  }else if(event.key==='Enter'&&answered)$('quizNext').click();
}
document.querySelectorAll('[data-play-mode]').forEach(button=>button.addEventListener('click',()=>start(button.dataset.playMode)));
$('quizNext').addEventListener('click',next);
$('quitQuiz').addEventListener('click',()=>{setScreen('modes');updateStats()});
$('playAgain').addEventListener('click',()=>start(round?.mode||'quick'));
$('backToModes').addEventListener('click',()=>setScreen('modes'));
$('shareResult').addEventListener('click',async()=>{
  const text=`I scored ${score}/${round?.questions.length||0} in LinuxAid ${round?.title||'Play'} 🐧 Can you beat it? ${location.origin+location.pathname.replace(/play\.html$/,'play.html')}`;
  try{
    if(navigator.share)await navigator.share({title:'LinuxAid Play',text});
    else{await navigator.clipboard.writeText(text);$('shareResult').textContent='Copied challenge ✓';setTimeout(()=>$('shareResult').innerHTML='<i class="fas fa-share-nodes"></i> Share result',1200)}
  }catch{}
});
document.addEventListener('keydown',keyboard);
document.addEventListener('linuxaid:state-synced',updateStats);
updateStats();
