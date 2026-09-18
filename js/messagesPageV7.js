import { getSessionUser } from './authClientV5.js';
import { listConversations,loadMessages,sendMessage } from './socialApi.js';

const $=s=>document.querySelector(s);
const esc=s=>String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
let user=await getSessionUser();
if(!user)location.href='auth.html?next=messages';
let conversations=[];
let activeId=new URLSearchParams(location.search).get('c')||'';
let poll=null,lastMessageKey='';
const layout=$('.chat-layout'),form=$('#messageForm');
const time=v=>new Date(v).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});

function avatar(c){
  return c.avatarUrl?`<img class="social-avatar" src="${esc(c.avatarUrl)}" alt="">`:`<div class="social-avatar">${esc((c.displayName||'L')[0])}</div>`;
}

function showList(){
  activeId='';
  layout?.classList.remove('has-active');
  if(form)form.hidden=true;
  history.replaceState(null,'','messages.html');
  $('#chatPeer').innerHTML='<strong>Select a conversation</strong><span>or find someone from People</span>';
  $('#liveMessages').innerHTML='<div class="social-empty">Choose a conversation to see messages.</div>';
  renderList($('#conversationSearch').value||'');
}

function renderList(filter=''){
  const root=$('#conversationList');
  const rows=conversations.filter(c=>`${c.displayName} ${c.last_message_preview||''}`.toLowerCase().includes(filter.toLowerCase()));
  root.innerHTML=rows.length
    ?rows.map(c=>`<button class="chat-row ${c.id===activeId?'active':''} ${c.unread?'unread':''}" data-id="${c.id}">${avatar(c)}<span class="chat-row-body"><strong>${esc(c.displayName)}</strong><span>${esc(c.last_message_preview||'No messages yet')}</span></span></button>`).join('')
    :'<div class="social-empty"><strong style="display:block;color:var(--text);margin-bottom:8px">No conversations yet</strong><span>Find another LinuxAid learner and start a private chat.</span><a class="button primary" href="people.html" style="margin-top:14px">Find people</a></div>';
  root.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>openConversation(b.dataset.id));
  $('#conversationCount').textContent=conversations.length;
  $('#unreadCount').textContent=conversations.filter(c=>c.unread).length;
}

async function refreshConversations(){
  try{
    conversations=await listConversations();
    if(activeId&&!conversations.some(c=>c.id===activeId))activeId='';
    renderList($('#conversationSearch').value||'');
    if(activeId)await openConversation(activeId,false);
    else if(innerWidth>720&&conversations.length)await openConversation(conversations[0].id,false);
    else showList();
  }catch(e){
    $('#conversationList').innerHTML=`<div class="social-empty"><strong>Chats could not load.</strong><br>${esc(e.message)}</div>`;
  }
}

async function openConversation(id,push=true){
  activeId=id;
  const c=conversations.find(x=>x.id===id);
  if(!c)return showList();
  if(push)history.replaceState(null,'',`messages.html?c=${encodeURIComponent(id)}`);
  layout?.classList.add('has-active');
  if(form)form.hidden=false;
  renderList($('#conversationSearch').value||'');
  $('#chatPeer').innerHTML=`<strong>${esc(c.displayName||'Conversation')}</strong><span>${c?.peers?.[0]?.rank?esc(c.peers[0].rank):'LinuxAid member'}</span>`;
  const input=$('#messageBody'),btn=$('#messageForm button');
  input.disabled=false;btn.disabled=false;
  await refreshMessages(true);startPoll();
}

async function refreshMessages(force=false){
  if(!activeId)return;
  try{
    const rows=await loadMessages(activeId,100),key=rows.map(r=>r.id).join('|');
    if(!force&&key===lastMessageKey)return;
    lastMessageKey=key;
    const root=$('#liveMessages');
    root.innerHTML=rows.length
      ?rows.map(m=>`<div class="chat-bubble ${m.mine?'mine':''}">${esc(m.body)}<time>${time(m.created_at)}${m.edited_at?' • edited':''}</time></div>`).join('')
      :'<div class="social-empty">No messages yet. Start the conversation with a clear Linux question.</div>';
    root.scrollTop=root.scrollHeight;
    const c=conversations.find(x=>x.id===activeId);if(c)c.unread=false;
    renderList($('#conversationSearch').value||'');
  }catch(e){
    $('#liveMessages').innerHTML=`<div class="social-empty">${esc(e.message)}</div>`;
  }
}

function startPoll(){
  clearInterval(poll);
  poll=setInterval(()=>{if(!document.hidden&&activeId)refreshMessages(false)},15000);
}

$('#messageForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!activeId)return;
  const input=$('#messageBody'),body=input.value.trim();if(!body)return;
  const btn=e.submitter;btn.disabled=true;
  try{await sendMessage(activeId,body);input.value='';await refreshMessages(true);await refreshConversations()}
  catch(err){alert(err.message)}
  finally{btn.disabled=false;input.focus()}
});

$('#messageBody').addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#messageForm').requestSubmit()}
});
$('#conversationSearch').addEventListener('input',e=>renderList(e.target.value));
$('#mobileChatBack')?.addEventListener('click',showList);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshConversations();if(activeId)refreshMessages(false)}});
addEventListener('resize',()=>{if(innerWidth>720&&!activeId&&conversations.length)openConversation(conversations[0].id,false)},{passive:true});
window.addEventListener('pagehide',()=>clearInterval(poll),{once:true});
await refreshConversations();
