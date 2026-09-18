function ready(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});else fn()}

function ensureUiStyles(){
  if(document.querySelector('link[data-linuxaid-ui-v81]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='ui-v8.1.css?v=8.1';
  link.dataset.linuxaidUiV81='true';
  document.head.appendChild(link);
}

function cleanImplementationText(root=document){
  const selectors=['.social-stat','.lead','#syncStatus','#authStatus','.auth-message','[data-provider-label]','.provider-implementation-label'];
  root.querySelectorAll?.(selectors.join(',')).forEach(node=>{
    if(node.closest('.social-card-body,.reply-item,.chat-bubble'))return;
    const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);
    const textNodes=[];
    while(walker.nextNode())textNodes.push(walker.currentNode);
    textNodes.forEach(text=>{
      let value=text.nodeValue||'';
      value=value
        .replace(/Supabase\s+row-level\s+security/gi,'member access controls')
        .replace(/row-level\s+security/gi,'member access controls')
        .replace(/Supabase\s+Auth/gi,'LinuxAid Account')
        .replace(/Supabase\s+data/gi,'live community data')
        .replace(/Synced\s+with\s+Supabase/gi,'Synced securely')
        .replace(/\bSupabase\b/gi,'LinuxAid')
        .replace(/\bRLS\b/gi,'Access');
      if(value!==text.nodeValue)text.nodeValue=value;
    });
  });
}

function upgradeLegacyAvatarUpload(){
  const input=document.getElementById('avatarUpload');
  if(!input||input.closest('.upload-zone'))return;
  const parent=input.parentElement;
  if(!parent)return;
  const zone=document.createElement('label');
  zone.className='upload-zone';
  zone.htmlFor='avatarUpload';
  const icon=document.createElement('span');
  icon.className='upload-zone-icon';
  icon.innerHTML='<i class="fas fa-image" aria-hidden="true"></i>';
  const copy=document.createElement('span');
  copy.className='upload-zone-copy';
  copy.innerHTML='<strong>Change profile picture</strong><small id="avatarStatus">PNG, JPG, WEBP or GIF • max 2 MB</small>';
  const button=document.createElement('span');
  button.className='upload-zone-button';
  button.textContent='Browse image';
  parent.insertBefore(zone,input);
  zone.append(icon,copy,button,input);
}

function polishEmptyCommunity(){
  const feed=document.getElementById('communityFeed');
  if(!feed)return;
  const improve=()=>{
    const empty=feed.querySelector('.social-empty');
    if(!empty||empty.dataset.polished)return;
    const text=empty.textContent.trim();
    if(!/No discussions|Loading/.test(text))return;
    empty.dataset.polished='1';
    if(/No discussions/.test(text)){
      empty.innerHTML='<div><i class="fas fa-comments" aria-hidden="true" style="font-size:1.35rem;color:var(--green)"></i><strong style="display:block;margin:10px 0 5px;color:var(--text)">No discussions yet</strong><span>Start the first useful Linux thread. Clear questions make better answers.</span></div>';
    }
  };
  improve();
  new MutationObserver(improve).observe(feed,{childList:true,subtree:true});
}

ensureUiStyles();
ready(()=>{
  document.documentElement.classList.add('linuxaid-ui-v81');
  cleanImplementationText(document);
  upgradeLegacyAvatarUpload();
  polishEmptyCommunity();

  const observer=new MutationObserver(mutations=>{
    for(const mutation of mutations){
      const target=mutation.target?.nodeType===1?mutation.target:mutation.target?.parentElement;
      if(target?.closest?.('.social-stat,.lead,#syncStatus,#authStatus,.auth-message,[data-provider-label],.provider-implementation-label')){
        cleanImplementationText(target.closest('.social-stat,.lead,#syncStatus,#authStatus,.auth-message,[data-provider-label],.provider-implementation-label')?.parentElement||document);
      }
    }
  });
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
});
