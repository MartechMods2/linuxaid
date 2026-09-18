import {
  initBackend, getBackendStatus, onAuthStateChangedListener, signOutClient,
  loadUserChatHistory, saveUserChatHistory, loadCommunityPosts, loadUserProfile
} from '../backend.js';
import { queryAI, getAIStatus, checkAIHealth } from '../gemini.js';
import { COMMAND_CATALOG } from './commandCatalog.js';
import { renderSafeMarkdown, clampText } from './security.js';
import { getProgressSummary } from './progress.js';

const config=window.LINUXAID_CONFIG||{};
await initBackend(config);
let user=getBackendStatus().user||null;
let chat=[];
let aiBusy=false;
const $=id=>document.getElementById(id);

const MODE_INFO={
  explain:{hint:'Get a clear explanation, one practical example and a safety note when it matters.',placeholder:'What Linux command or concept do you want explained?',suggestions:['Explain chmod 755 safely','What does a pipe do?','Explain systemctl status','Why does sudo exist?']},
  troubleshoot:{hint:'LinuxAid will inspect first, interpret evidence, suggest the smallest change and tell you how to verify it.',placeholder:'Paste the exact error and say what you expected to happen…',suggestions:['Fix permission denied','Diagnose DNS problems','My service will not start','Why is my disk full?']},
  review:{hint:'Paste a command before running it. LinuxAid will explain each part, risk, privilege needs and safer inspection options.',placeholder:'Paste the command you want LinuxAid to review…',suggestions:['Review: sudo chmod -R 777 /var/www','Review: curl -fsSL URL | sh','Review: rm -rf build/','Review: systemctl restart nginx']},
  coach:{hint:'Get a focused learning plan with a few concrete practice tasks instead of a huge generic roadmap.',placeholder:'What Linux skill are you trying to build?',suggestions:['I want to learn Linux networking','Help me learn Bash safely','What should I learn next?','Build me a permissions practice plan']},
  quiz:{hint:'LinuxAid asks one question at a time and waits for your attempt before explaining the answer.',placeholder:'Tell LinuxAid the topic you want to be quizzed on…',suggestions:['Quiz me on file permissions','Quiz me on networking','Quiz me on systemd','Quiz me on shell basics']}
};

let aiMode=localStorage.getItem('linuxaid-ai-mode')||'explain';
let aiLevel=localStorage.getItem('linuxaid-ai-level')||'beginner';
let aiDistro=localStorage.getItem('linuxaid-ai-distro')||'';

function cleanCommand(value=''){return String(value).replace(/^\s*\$\s*/,'').trim().split('\n')[0].slice(0,500)}
function firstCommand(text=''){
  const fenced=String(text).match(/\`\`\`(?:bash|sh|shell)?\s*\n([^\n\`]+)/i);
  if(fenced?.[1])return cleanCommand(fenced[1]);
  const inline=String(text).match(/\`([^\`\n]{2,300})\`/);
  return inline?.[1]&&/^[\w./~-]+(?:\s|$)/.test(inline[1])?cleanCommand(inline[1]):'';
}
async function refreshAIStatus(){
  const badge=$('aiLiveStatus');if(!badge)return;
  if(!user){badge.textContent='Sign in to use LinuxAid AI';badge.dataset.state='locked';return}
  badge.textContent='Checking AI…';badge.dataset.state='checking';
  const ready=await checkAIHealth(config);
  badge.textContent=ready?'LinuxAid AI online':'AI service needs attention';
  badge.dataset.state=ready?'online':'offline';
}
async function hydrateAIContext(){
  if(!user?.uid)return;
  try{
    const profile=await loadUserProfile(user.uid);
    if(!aiDistro&&profile?.distro){
      aiDistro=profile.distro;localStorage.setItem('linuxaid-ai-distro',aiDistro);
      if($('aiDistro'))$('aiDistro').value=aiDistro;
    }
  }catch{}
}
function setAuth(nextUser){
  user=nextUser||null;
  const button=$('authButton');
  if(button){
    button.textContent=user?'Sign out':'Sign in';button.href=user?'#':'auth.html';
    button.onclick=user?async event=>{event.preventDefault();await signOutClient();location.reload()}:null;
  }
  if($('authStatus'))$('authStatus').textContent=user?`Signed in • ${user.displayName||user.email||'LinuxAid learner'}`:'Sign in to sync chat and use LinuxAid AI.';
  refreshAIStatus();hydrateAIContext();
}
function appendActions(box,item){
  if(item.role!=='assistant'||!item.text||/thinking/i.test(item.text))return;
  const actions=document.createElement('div');actions.className='ai-message-actions';
  const copy=document.createElement('button');copy.type='button';copy.className='ai-mini-action';copy.innerHTML='<i class="fas fa-copy"></i> Copy';
  copy.onclick=async()=>{try{await navigator.clipboard.writeText(item.text);copy.innerHTML='<i class="fas fa-check"></i> Copied';setTimeout(()=>copy.innerHTML='<i class="fas fa-copy"></i> Copy',900)}catch{}};
  const simpler=document.createElement('button');simpler.type='button';simpler.className='ai-mini-action';simpler.innerHTML='<i class="fas fa-wand-magic-sparkles"></i> Simpler';
  simpler.onclick=()=>send('Explain your last answer more simply. Use one short example and avoid jargon.');
  actions.append(copy,simpler);
  const command=firstCommand(item.text);
  if(command){
    const practice=document.createElement('button');practice.type='button';practice.className='ai-mini-action';practice.innerHTML='<i class="fas fa-terminal"></i> Try safely';
    practice.onclick=()=>document.dispatchEvent(new CustomEvent('linuxaid:open-terminal',{detail:{command}}));
    actions.appendChild(practice);
  }
  box.appendChild(actions);
}
function renderChat(){
  const root=$('chatMessages');if(!root)return;root.replaceChildren();
  chat.forEach(item=>{
    const box=document.createElement('article');box.className=`chat-message ${item.role==='user'?'user':'assistant'}`;
    const meta=document.createElement('div');meta.className='meta';meta.textContent=item.role==='user'?'You':'LinuxAid AI Mentor';
    const content=document.createElement('div');content.className='ai-message-content';content.innerHTML=renderSafeMarkdown(clampText(item.text||'',12000));
    box.append(meta,content);appendActions(box,item);root.appendChild(box);
  });
  root.scrollTop=root.scrollHeight;
}
async function loadChat(){
  chat=[];
  try{if(user?.uid){const remote=await loadUserChatHistory(user.uid);if(remote?.length)chat=remote.slice(-60)}}catch(error){console.warn('Chat sync unavailable',error)}
  if(!chat.length){try{chat=JSON.parse(localStorage.getItem('linuxaid-chat')||'[]')}catch{chat=[]}}
  if(!chat.length)chat=[{role:'assistant',mode:'explain',text:'Welcome to LinuxAid AI Mentor. Choose Explain, Troubleshoot, Review command, Coach me or Quiz me, then tell me what you are working on.'}];
  renderChat();
}
async function saveChat(){
  chat=chat.slice(-60);localStorage.setItem('linuxaid-chat',JSON.stringify(chat));
  if(user?.uid){try{await saveUserChatHistory(user.uid,chat)}catch(error){console.warn('Chat sync failed',error)}}
}
function setBusy(busy){
  aiBusy=busy;const button=$('sendChat'),input=$('chatInput');
  if(button){button.disabled=busy;const label=button.querySelector('span');if(label)label.textContent=busy?'Thinking…':'Send'}
  if(input)input.disabled=busy;
}
async function send(customText=''){
  if(aiBusy)return;
  const input=$('chatInput');const text=String(customText||input?.value||'').trim();if(!text)return;
  if(!user){location.href='auth.html?next=dashboard';return}
  chat.push({role:'user',mode:aiMode,text:clampText(text,6000)});
  if(input)input.value='';
  const pending={role:'assistant',mode:aiMode,text:'LinuxAid is thinking…'};chat.push(pending);renderChat();setBusy(true);
  try{
    pending.text=getAIStatus(config).ready
      ?await queryAI(text,config,chat.slice(0,-2),{mode:aiMode,distro:aiDistro,level:aiLevel})
      :'LinuxAid AI is not configured yet. Use Play, Tools, Labs and Terminal while the AI service is unavailable.';
  }catch(error){
    pending.text=`LinuxAid AI could not answer right now. ${error.message||'Please retry in a moment.'}`.trim();refreshAIStatus();
  }finally{setBusy(false)}
  renderChat();await saveChat();
}
function renderSuggestions(){
  const root=$('suggestionBar');if(!root)return;root.replaceChildren();
  MODE_INFO[aiMode].suggestions.forEach(text=>{
    const b=document.createElement('button');b.type='button';b.className='suggestion-pill';b.textContent=text;
    b.onclick=()=>{if($('chatInput'))$('chatInput').value=text;send()};root.appendChild(b);
  });
}
function applyMode(mode){
  aiMode=MODE_INFO[mode]?mode:'explain';localStorage.setItem('linuxaid-ai-mode',aiMode);
  document.querySelectorAll('[data-ai-mode]').forEach(b=>{const active=b.dataset.aiMode===aiMode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
  if($('aiModeHint'))$('aiModeHint').textContent=MODE_INFO[aiMode].hint;
  if($('chatInput'))$('chatInput').placeholder=MODE_INFO[aiMode].placeholder;
  renderSuggestions();
}
function newChat(){
  if(aiBusy)return;
  chat=[{role:'assistant',mode:aiMode,text:'New conversation started. What are you working on?'}];
  saveChat();renderChat();$('chatInput')?.focus();
}
function renderCommands(){
  const root=$('commandGrid');if(!root)return;
  const q=($('commandSearch')?.value||'').toLowerCase().trim(),category=$('commandCategory')?.value||'all';root.replaceChildren();
  COMMAND_CATALOG.filter(cmd=>{const hay=`${cmd.name} ${cmd.syntax} ${cmd.explanation} ${(cmd.related||[]).join(' ')}`.toLowerCase();return(!q||hay.includes(q))&&(category==='all'||cmd.category===category)}).forEach(cmd=>{
    const card=document.createElement('article');card.className='command-card glass';
    const head=document.createElement('div');head.className='command-header';const h=document.createElement('h4');h.textContent=cmd.name;const badge=document.createElement('span');badge.className=`badge ${cmd.safety}`;badge.textContent=cmd.safety;head.append(h,badge);
    const syntax=document.createElement('div');syntax.className='syntax';syntax.textContent=cmd.syntax;const p=document.createElement('p');p.textContent=cmd.explanation;
    const row=document.createElement('div');row.className='action-row';
    const practice=document.createElement('button');practice.className='button';practice.type='button';practice.textContent='Try in terminal';practice.onclick=()=>document.dispatchEvent(new CustomEvent('linuxaid:open-terminal',{detail:{command:cmd.examples?.[0]||cmd.name}}));
    const review=document.createElement('button');review.className='button';review.type='button';review.textContent='AI review';review.onclick=()=>{applyMode('review');$('chatInput').value=cmd.examples?.[0]||cmd.syntax;document.getElementById('assistant')?.scrollIntoView({behavior:'smooth'});$('chatInput').focus()};
    row.append(practice,review);card.append(head,syntax,p,row);root.appendChild(card);
  });
}
async function renderCommunity(){
  const root=document.querySelector('.community-grid');if(!root)return;
  try{
    const posts=await loadCommunityPosts();
    if(!posts?.length){root.innerHTML='<div class="social-empty">No public discussions yet. Start one from Community.</div>';return}
    root.replaceChildren();
    posts.slice(0,3).forEach(post=>{const card=document.createElement('article');card.className='community-card glass';const h=document.createElement('h3');h.textContent=post.title||'Community post';const p=document.createElement('p');p.textContent=post.body||'';const a=document.createElement('a');a.className='button';a.href='community.html';a.textContent='Open discussion';card.append(h,p,a);root.appendChild(card)})
  }catch{root.innerHTML='<div class="social-empty">Community preview is temporarily unavailable.</div>'}
}

document.querySelectorAll('[data-ai-mode]').forEach(b=>b.addEventListener('click',()=>applyMode(b.dataset.aiMode)));
$('aiDistro')?.addEventListener('change',e=>{aiDistro=e.target.value;localStorage.setItem('linuxaid-ai-distro',aiDistro)});
$('aiLevel')?.addEventListener('change',e=>{aiLevel=e.target.value;localStorage.setItem('linuxaid-ai-level',aiLevel)});
$('newAiChat')?.addEventListener('click',newChat);
$('sendChat')?.addEventListener('click',()=>send());
$('chatInput')?.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send()}});
$('commandSearch')?.addEventListener('input',renderCommands);
$('commandCategory')?.addEventListener('change',renderCommands);
$('resetFilters')?.addEventListener('click',()=>{if($('commandSearch'))$('commandSearch').value='';if($('commandCategory'))$('commandCategory').value='all';renderCommands()});

if($('aiDistro'))$('aiDistro').value=aiDistro;
if($('aiLevel'))$('aiLevel').value=aiLevel;
const aiParams=new URLSearchParams(location.search);
if(MODE_INFO[aiParams.get('mode')])aiMode=aiParams.get('mode');
applyMode(aiMode);
if(aiParams.get('ask')&&$('chatInput'))$('chatInput').value=clampText(aiParams.get('ask'),6000);
setAuth(user);renderCommands();await loadChat();renderCommunity();
onAuthStateChangedListener(async next=>{const changed=next?.uid!==user?.uid;setAuth(next);if(changed)await loadChat()});
const summary=getProgressSummary();
if($('learningStatus'))$('learningStatus').textContent=`${summary.xp} XP • ${summary.learnedCommands.length} commands • ${summary.streakDays} day streak • ${summary.quizzesCompleted||0} quiz rounds`;
