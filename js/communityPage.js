import {
  initFirebase, onAuthStateChangedListener, loadCommunityPosts, saveCommunityPost
} from '../firebase.js';

const config = window.LINUXAID_CONFIG || {};
const firebaseReady = Boolean(config.firebase?.apiKey && config.firebase?.projectId && initFirebase(config.firebase));
let currentUser = null;

const $ = id => document.getElementById(id);

const SAMPLE_POSTS = [
  { id:'sample-1', title:'How should I investigate “Permission denied” safely?', body:'I learned to start with ls -l, id and the target path instead of immediately using sudo. What other checks do you use?', meta:'LinuxAid starter discussion', replies:0, upvotes:0 },
  { id:'sample-2', title:'Best command sequence for basic network troubleshooting?', body:'My current order is ip addr → ip route → ping an IP → test DNS. I want to understand why this order works.', meta:'Networking discussion', replies:0, upvotes:0 },
  { id:'sample-3', title:'What should a beginner learn after files and permissions?', body:'I am comfortable with pwd, ls, cd, cp, mv, grep and chmod. Should I learn processes, networking or Bash next?', meta:'Learning roadmap', replies:0, upvotes:0 }
];

function cardForPost(post) {
  const card=document.createElement('article');
  card.className='community-card glass';
  const title=document.createElement('h3'); title.textContent=String(post.title || 'Community post').slice(0,140);
  const meta=document.createElement('div'); meta.className='meta'; meta.textContent=String(post.meta || 'LinuxAid Community').slice(0,160);
  const body=document.createElement('p'); body.textContent=String(post.body || '').slice(0,5000);
  const actions=document.createElement('div'); actions.className='community-actions';
  const reply=document.createElement('span'); reply.className='community-pill'; reply.textContent=`${Number(post.replies || 0)} replies`;
  const upvote=document.createElement('span'); upvote.className='community-pill'; upvote.textContent=`${Number(post.upvotes || 0)} upvotes`;
  actions.append(reply,upvote); card.append(title,meta,body,actions); return card;
}

async function renderFeed() {
  const feed=$('communityFeed'); const empty=$('communityEmpty');
  if (!feed) return;
  feed.replaceChildren();
  let posts=SAMPLE_POSTS;
  if (firebaseReady) {
    try {
      const remote=await loadCommunityPosts();
      if (remote.length) posts=remote.slice(0,30);
    } catch (error) { console.warn(error); }
  }
  posts.forEach(post => feed.appendChild(cardForPost(post)));
  if (empty) empty.hidden=posts.length > 0;
}

function updateAuthNotice() {
  const notice=$('communityAuthNotice');
  if (!notice) return;
  if (!firebaseReady) {
    notice.textContent='Firebase is not configured yet. Community is currently in read-only preview mode.';
    notice.className='auth-message info show';
    return;
  }
  if (!currentUser) {
    notice.textContent='Sign in to publish a discussion.';
    notice.className='auth-message info show';
    return;
  }
  notice.textContent=`Publishing as ${currentUser.displayName || currentUser.email || 'LinuxAid learner'}.`;
  notice.className='auth-message success show';
}

$('communityForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const title=$('communityTitle').value.trim();
  const body=$('communityBody').value.trim();
  if (title.length < 8 || body.length < 20) {
    const notice=$('communityAuthNotice');
    notice.textContent='Use a clear title and include enough detail for someone to understand the problem.';
    notice.className='auth-message error show';
    return;
  }
  if (!firebaseReady || !currentUser) {
    location.href='auth.html';
    return;
  }
  const button=event.submitter; button.disabled=true; button.textContent='Publishing…';
  try {
    await saveCommunityPost({
      id:crypto.randomUUID(),
      title, body,
      meta:`${currentUser.displayName || currentUser.email || 'LinuxAid learner'} • just now`
    });
    $('communityTitle').value=''; $('communityBody').value='';
    await renderFeed();
    const notice=$('communityAuthNotice'); notice.textContent='Discussion published successfully.'; notice.className='auth-message success show';
  } catch (error) {
    console.error(error);
    const notice=$('communityAuthNotice'); notice.textContent='Could not publish. Check Firebase rules and your sign-in status.'; notice.className='auth-message error show';
  } finally {
    button.disabled=false; button.textContent='Publish discussion';
  }
});

if (firebaseReady) onAuthStateChangedListener(user => { currentUser=user || null; updateAuthNotice(); });
updateAuthNotice();
renderFeed();
