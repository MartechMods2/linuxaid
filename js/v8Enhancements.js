function ready(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});else fn()}

function ensureV8Styles(){
  if(document.querySelector('link[href="product-v8.css"]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='product-v8.css';
  document.head.appendChild(link);
}

function cleanImplementationLabels(){
  const replacements=[
    [/Supabase Auth/gi,'LinuxAid Account'],
    [/Supabase data/gi,'live data'],
    [/Supabase row-level security/gi,'member access controls'],
    [/Synced with Supabase/gi,'Synced securely'],
    [/Supabase profile/gi,'LinuxAid profile']
  ];
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(node=>{
    let next=node.nodeValue;
    replacements.forEach(([pattern,value])=>{next=next.replace(pattern,value)});
    if(next!==node.nodeValue)node.nodeValue=next;
  });
}

function strengthenMobileNav(){
  const nav=document.querySelector('.navbar');
  const button=nav?.querySelector('.mobile-menu-button');
  if(!nav||!button)return;
  const close=()=>{
    nav.classList.remove('nav-open');
    button.setAttribute('aria-expanded','false');
    button.innerHTML='<i class="fas fa-bars" aria-hidden="true"></i>';
    document.documentElement.classList.remove('nav-lock');
  };
  button.addEventListener('click',()=>{
    requestAnimationFrame(()=>document.documentElement.classList.toggle('nav-lock',nav.classList.contains('nav-open')));
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')close()});
  document.addEventListener('click',event=>{
    if(!nav.classList.contains('nav-open'))return;
    if(nav.contains(event.target))return;
    close();
  });
  addEventListener('resize',()=>{if(innerWidth>900)close()},{passive:true});
}

function improveExternalLinks(){
  document.querySelectorAll('a[target="_blank"]').forEach(link=>{
    const rel=new Set(String(link.rel||'').split(/\s+/).filter(Boolean));
    rel.add('noopener');rel.add('noreferrer');
    link.rel=[...rel].join(' ');
  });
}

function supportShortcut(){
  if(document.querySelector('[data-support-shortcut]'))return;
  const footer=document.querySelector('footer');
  if(!footer)return;
  const link=document.createElement('a');
  link.href='support.html';
  link.textContent='Support LinuxAid';
  link.dataset.supportShortcut='true';
  link.style.marginLeft='12px';
  footer.appendChild(link);
}

ensureV8Styles();
ready(()=>{
  cleanImplementationLabels();
  strengthenMobileNav();
  improveExternalLinks();
  supportShortcut();
  document.documentElement.style.setProperty('--app-height',`${innerHeight}px`);
  addEventListener('resize',()=>document.documentElement.style.setProperty('--app-height',`${innerHeight}px`),{passive:true});
});
