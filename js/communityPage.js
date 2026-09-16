import {
  initBackend, getBackendStatus, onAuthStateChangedListener, loadCommunityPosts,
  saveCommunityPost, toggleCommunityVote, loadCommunityReplies, saveCommunityReply
} from '../backend.js';

const config = window.LINUXAID_CONFIG || {};
await initBackend(config);
const backend = getBackendStatus();
const backendReady = backend.ready;
let currentUser = backend.user || null;

const $ = id => document.getElementById(id);
const SAMPLE_POSTS = [
  { id:'sample-1', title:'How should I investigate “Permission denied” safely?', body:'I learned to start with ls -l, id and the target path instead of immediately using sudo. What other checks do you use?', meta:'LinuxAid starter discussion', replies:0, upvotes:0, sample:true },
  { id:'sample-2', title:'Best command sequence for basic network troubleshooting?', body:'My current order is ip addr → ip route → ping an IP → test DNS. I want to understand why this order works.', meta:'Networking discussion', replies:0, upvotes:0, sample:true },
  { id:'sample-3', title:'What should a beginner learn after files and permissions?', body:'I am comfortable with pwd, ls, cd, cp, mv, grep and chmod. Should I learn processes, networking or Bash next?', meta:'Learning roadmap', replies:0, upvotes:0, sample:true }
];

function setNotice(text, type='info') {
  const notice=$('communityAuthNotice');
  if (!notice) return;
  notice.textContent=text;
  notice.className=`auth-message ${type} show`;
}

async function openReplies(post) {
  if (post.sample || backend.provider !== 'supabase') return setNotice('Replies become interactive when the Supabase backend is configured.', 'info');
  let dialog=document.getElementById('communityReplyDialog');
  if (!dialog) {
    dialog=document.createElement('dialog');
    dialog.id='communityReplyDialog';
    dialog.className='auth-card';
    dialog.style.cssText='width:min(680px,calc(100% - 30px));max-height:82vh;overflow:auto;border:1px solid var(--hairline);background:var(--surface-1);color:var(--text)';
    document.body.appendChild(dialog);
  }
  dialog.replaceChildren();
  const close=document.createElement('button'); close.className='button'; close.type='button'; close.textContent='Close'; close.addEventListener('click',()=>dialog.close());
  const h=document.createElement('h2'); h.textContent=post.title;
  const list=document.createElement('div'); list.style.cssText='display:grid;gap:10px;margin:18px 0';
  list.textContent='Loading replies…';
  const form=document.createElement('form'); form.className='auth-form-grid';
  const input=document.createElement('textarea'); input.className='form-control'; input.rows=4; input.maxLength=5000; input.placeholder='Add a helpful reply…';
  const submit=document.createElement('button'); submit.className='button primary'; submit.type='submit'; submit.textContent='Reply';
  form.append(input,submit);
  dialog.append(close,h,list,form);
  dialog.showModal();

  async function renderReplies() {
    const replies=await loadCommunityReplies(post.id);
    list.replaceChildren();
    if (!replies.length) {
      const empty=document.createElement('p'); empty.style.color='var(--muted)'; empty.textContent='No replies yet. Be the first to help.'; list.appendChild(empty); return;
    }
    replies.forEach(reply=>{
      const item=document.createElement('div'); item.className='panel glass'; item.style.padding='14px';
      const meta=document.createElement('small'); meta.style.color='var(--muted)'; meta.textContent=`${reply.displayName} • ${new Date(reply.createdAt).toLocaleString()}`;
      const body=document.createElement('p'); body.style.margin='8px 0 0'; body.textContent=reply.body;
      item.append(meta,body); list.appendChild(item);
    });
  }

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const body=input.value.trim();
    if (body.length < 2) return;
    if (!currentUser) { dialog.close(); location.href='auth.html'; return; }
    submit.disabled=true; submit.textContent='Posting…';
    try { await saveCommunityReply(post.id,body); input.value=''; await renderReplies(); await renderFeed(); }
    catch(error){ setNotice(error.message || 'Could not add reply.','error'); }
    finally{ submit.disabled=false; submit.textContent='Reply'; }
  });

  try { await renderReplies(); }
  catch(error){ list.textContent=error.message || 'Could not load replies.'; }
}

function cardForPost(post) {
  const card=document.createElement('article');
  card.className='community-card glass';
  const title=document.createElement('h3'); title.textContent=String(post.title || 'Community post').slice(0,160);
  const meta=document.createElement('div'); meta.className='meta'; meta.textContent=String(post.meta || 'LinuxAid Community').slice(0,180);
  const body=document.createElement('p'); body.textContent=String(post.body || '').slice(0,8000);
  const actions=document.createElement('div'); actions.className='community-actions';

  const reply=document.createElement('button'); reply.className='community-pill'; reply.type='button'; reply.textContent=`${Number(post.replies || 0)} replies`;
  reply.addEventListener('click',()=>openReplies(post));

  const upvote=document.createElement('button'); upvote.className='community-pill'; upvote.type='button'; upvote.textContent=`▲ ${Number(post.upvotes || 0)}`;
  upvote.disabled=Boolean(post.sample);
  upvote.addEventListener('click',async()=>{
    if (!currentUser) { location.href='auth.html'; return; }
    upvote.disabled=true;
    try { await toggleCommunityVote(post.id); await renderFeed(); }
    catch(error){ setNotice(error.message || 'Could not update vote.','error'); }
    finally{ upvote.disabled=false; }
  });

  actions.append(reply,upvote); card.append(title,meta,body,actions); return card;
}

async function renderFeed() {
  const feed=$('communityFeed'); const empty=$('communityEmpty');
  if (!feed) return;
  feed.replaceChildren();
  let posts=SAMPLE_POSTS;
  if (backendReady) {
    try {
      const remote=await loadCommunityPosts();
      if (remote.length) posts=remote.slice(0,50);
    } catch (error) { console.warn(error); setNotice('Community backend is connected but the feed could not be loaded yet.','error'); }
  }
  posts.forEach(post => feed.appendChild(cardForPost(post)));
  if (empty) empty.hidden=posts.length > 0;
}

function updateAuthNotice() {
  if (!backendReady) return setNotice('Backend is not configured yet. Community is in read-only preview mode.','info');
  if (!currentUser) return setNotice(`Community is live on ${backend.provider}. Sign in to publish, vote and reply.`,'info');
  setNotice(`Publishing as ${currentUser.displayName || currentUser.email || 'LinuxAid learner'} • ${backend.provider}`,'success');
}

$('communityForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const title=$('communityTitle').value.trim();
  const body=$('communityBody').value.trim();
  if (title.length < 8 || body.length < 20) return setNotice('Use a clear title and include enough detail for someone to understand the problem.','error');
  if (!backendReady || !currentUser) { location.href='auth.html'; return; }
  const button=event.submitter; button.disabled=true; button.textContent='Publishing…';
  try {
    await saveCommunityPost({ id:crypto.randomUUID(), title, body });
    $('communityTitle').value=''; $('communityBody').value='';
    await renderFeed();
    setNotice('Discussion published successfully.','success');
    document.dispatchEvent(new CustomEvent('linuxaid:community-post',{ detail:{ source:'community' } }));
  } catch (error) {
    console.error(error); setNotice(error.message || 'Could not publish. Check your backend and sign-in status.','error');
  } finally { button.disabled=false; button.textContent='Publish discussion'; }
});

if (backendReady) onAuthStateChangedListener(user => { currentUser=user || null; updateAuthNotice(); });
updateAuthNotice();
renderFeed();
