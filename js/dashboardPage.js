import { initBackend, getBackendStatus, onAuthStateChangedListener, signOutClient, loadUserChatHistory, saveUserChatHistory, loadCommunityPosts } from '../backend.js';
import { queryAI, getAIStatus } from '../gemini.js';
import { COMMAND_CATALOG } from './commandCatalog.js';
import { renderSafeMarkdown, clampText } from './security.js';
import { getProgressSummary } from './progress.js';

const config = window.LINUXAID_CONFIG || {};
await initBackend(config);
let user = getBackendStatus().user || null;
let chat = [];
const $ = id => document.getElementById(id);

function setAuth(nextUser){
  user = nextUser || null;
  const button = $('authButton');
  if (button) {
    button.textContent = user ? 'Sign out' : 'Sign in';
    button.href = user ? '#' : 'auth.html';
    button.onclick = user ? async event => { event.preventDefault(); await signOutClient(); location.reload(); } : null;
  }
  if ($('authStatus')) $('authStatus').textContent = user ? `Signed in • ${user.displayName || user.email || 'LinuxAid learner'}` : 'Sign in to sync chat and use remote AI.';
}

function renderChat(){
  const root=$('chatMessages'); if(!root) return; root.replaceChildren();
  chat.forEach(item=>{
    const box=document.createElement('div'); box.className=`chat-message ${item.role==='user'?'user':'assistant'}`;
    const meta=document.createElement('div'); meta.className='meta'; meta.textContent=item.role==='user'?'You':'LinuxAid';
    const content=document.createElement('div'); content.innerHTML=renderSafeMarkdown(clampText(item.text||'',12000));
    box.append(meta,content); root.appendChild(box);
  });
  root.scrollTop=root.scrollHeight;
}

async function loadChat(){
  try {
    if(user?.uid){ const remote=await loadUserChatHistory(user.uid); if(remote?.length) chat=remote.slice(-60); }
  } catch(error){ console.warn('Chat sync unavailable',error); }
  if(!chat.length){
    try { chat=JSON.parse(localStorage.getItem('linuxaid-chat')||'[]'); } catch { chat=[]; }
  }
  if(!chat.length) chat=[{role:'assistant',text:'Welcome to LinuxAid. Ask about commands, permissions, services, networking, packages or troubleshooting.'}];
  renderChat();
}

async function saveChat(){
  chat=chat.slice(-60);
  localStorage.setItem('linuxaid-chat',JSON.stringify(chat));
  if(user?.uid){ try{ await saveUserChatHistory(user.uid,chat); }catch(error){ console.warn('Chat sync failed',error); } }
}

async function send(){
  const input=$('chatInput'); const text=input?.value.trim(); if(!text) return;
  if(!user){ location.href='auth.html?next=dashboard'; return; }
  chat.push({role:'user',text:clampText(text,6000)}); input.value=''; renderChat();
  const pending={role:'assistant',text:'LinuxAid is thinking…'}; chat.push(pending); renderChat();
  try { pending.text = getAIStatus(config).ready ? await queryAI(text,config,chat.slice(0,-1)) : 'Remote AI is not configured yet. Use the LinuxAid tools and terminal while the local tutor remains available.'; }
  catch(error){ pending.text=`Remote AI is unavailable right now. ${error.message || ''}`.trim(); }
  renderChat(); await saveChat();
}

function renderSuggestions(){
  const root=$('suggestionBar'); if(!root) return;
  ['Explain chmod safely','Fix permission denied','Inspect a Linux service','Diagnose DNS problems','What should I learn next?'].forEach(text=>{
    const b=document.createElement('button'); b.type='button'; b.className='suggestion-pill'; b.textContent=text;
    b.onclick=()=>{ $('chatInput').value=text; send(); }; root.appendChild(b);
  });
}

function renderCommands(){
  const root=$('commandGrid'); if(!root) return;
  const q=($('commandSearch')?.value||'').toLowerCase().trim(); const category=$('commandCategory')?.value||'all'; root.replaceChildren();
  COMMAND_CATALOG.filter(cmd=>{const hay=`${cmd.name} ${cmd.syntax} ${cmd.explanation} ${(cmd.related||[]).join(' ')}`.toLowerCase(); return (!q||hay.includes(q))&&(category==='all'||cmd.category===category);}).forEach(cmd=>{
    const card=document.createElement('article'); card.className='command-card glass';
    const head=document.createElement('div'); head.className='command-header'; const h=document.createElement('h4'); h.textContent=cmd.name; const badge=document.createElement('span'); badge.className=`badge ${cmd.safety}`; badge.textContent=cmd.safety; head.append(h,badge);
    const syntax=document.createElement('div'); syntax.className='syntax'; syntax.textContent=cmd.syntax; const p=document.createElement('p'); p.textContent=cmd.explanation;
    const action=document.createElement('button'); action.className='button'; action.type='button'; action.textContent='Try in terminal'; action.onclick=()=>document.dispatchEvent(new CustomEvent('linuxaid:open-terminal',{detail:{command:cmd.examples?.[0]||cmd.name}}));
    card.append(head,syntax,p,action); root.appendChild(card);
  });
}

async function renderCommunity(){
  const root=document.querySelector('.community-grid'); if(!root) return;
  try { const posts=await loadCommunityPosts(); if(!posts?.length) return; root.replaceChildren(); posts.slice(0,3).forEach(post=>{const card=document.createElement('article');card.className='community-card glass';const h=document.createElement('h3');h.textContent=post.title||'Community post';const p=document.createElement('p');p.textContent=post.body||'';card.append(h,p);root.appendChild(card);}); } catch(error){ console.warn('Community preview unavailable',error); }
}

$('sendChat')?.addEventListener('click',send);
$('chatInput')?.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send();}});
$('commandSearch')?.addEventListener('input',renderCommands);
$('commandCategory')?.addEventListener('change',renderCommands);
$('resetFilters')?.addEventListener('click',()=>{if($('commandSearch')) $('commandSearch').value='';if($('commandCategory')) $('commandCategory').value='all';renderCommands();});

setAuth(user); renderSuggestions(); renderCommands(); await loadChat(); renderCommunity();
onAuthStateChangedListener(async next=>{ const changed=next?.uid!==user?.uid; setAuth(next); if(changed) await loadChat(); });
const summary=getProgressSummary(); if($('learningStatus')) $('learningStatus').textContent=`${summary.xp} XP • ${summary.learnedCommands.length} commands • ${summary.streakDays} day streak`;
