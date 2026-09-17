const config = window.LINUXAID_CONFIG || {};

function ensureMobileViewport(){
  let meta=document.querySelector('meta[name="viewport"]');
  if(!meta){meta=document.createElement('meta');meta.name='viewport';document.head.appendChild(meta);}
  meta.content='width=device-width,initial-scale=1,viewport-fit=cover';
}

function ensureStyles(){
  if(!document.querySelector('link[data-linuxaid-mobile-v5]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href='mobile-v5.css';link.dataset.linuxaidMobileV5='1';document.head.appendChild(link);
  }
}

function removeCoursePromises(){
  document.querySelectorAll('a[href="courses.html"]').forEach(link=>{
    const card=link.closest('.feature-card,.product-card,.panel');
    if(card){
      const title=card.querySelector('h2,h3,h4');
      const body=card.querySelector('p');
      if(title) title.textContent='Command mastery & Linux challenges';
      if(body) body.textContent='Build confidence through commands, safe terminal practice, troubleshooting tools, ranks and hands-on Linux challenges.';
      link.href='rankings.html';link.textContent='View ranks';
    }else link.remove();
  });
  document.querySelectorAll('.nav-links a').forEach(link=>{if(/course/i.test(link.textContent||''))link.remove();});
  document.querySelectorAll('a').forEach(link=>{if(/certificate/i.test(link.textContent||''))link.remove();});
}

function polishBrand(){
  document.querySelectorAll('.brand').forEach(brand=>{
    const first=brand.firstElementChild;
    if(first && first.tagName!=='IMG' && !brand.querySelector('img[data-linuxaid-logo]')){
      const img=document.createElement('img');img.dataset.linuxaidLogo='';img.className='linuxaid-brand-logo';img.alt='LinuxAid';
      try{import('./brand.js').then(mod=>{img.src=mod.LINUXAID_LOGO_DATA_URI||'';});}catch{}
      first.replaceWith(img);
    }
  });
}

function addFounderBlock(){
  if(document.body.dataset.page!=='home'||document.querySelector('[data-linuxaid-founder]')) return;
  const anchor=document.querySelector('footer')?.closest('.section')||document.querySelector('footer');
  const section=document.createElement('section');section.className='section';section.dataset.linuxaidFounder='1';
  section.innerHTML=`<div class="founder-card"><div class="founder-mark"><img data-linuxaid-logo alt="LinuxAid"></div><div><div class="eyebrow">Built by Martech</div><h3>Martech — Founder & CEO, LinuxAid</h3><div class="founder-role">Creator • Product builder • Linux learning advocate</div><p>Martech created LinuxAid to make Linux less intimidating: a place where beginners can inspect commands, practise safely, understand errors, build rank through useful activity and learn without risking their own machine.</p></div><a class="button" href="https://github.com/MartechMods2/linuxaid">Project GitHub</a></div>`;
  (anchor?.parentNode||document.querySelector('main'))?.insertBefore(section,anchor||null);
  import('./brand.js').then(mod=>mod.applyLinuxAidBranding?.()).catch(()=>{});
}

function addMotionPolish(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const nodes=[...document.querySelectorAll('.feature-card,.panel,.command-card,.community-card,.product-card,.founder-card,.rank-step')].slice(0,80);
  nodes.forEach((node,index)=>{node.animate([{opacity:.001,transform:'translateY(14px) scale(.992)'},{opacity:1,transform:'none'}],{duration:430+Math.min(index%5,4)*45,easing:'cubic-bezier(.2,.8,.2,1)',fill:'both',delay:Math.min(index,10)*18});});
}

function normalizeNavigation(){
  document.querySelectorAll('.nav-links').forEach(nav=>{
    const desired=[['Home','index.html'],['Dashboard','dashboard.html'],['Labs','labs.html'],['Tools','tools.html'],['Community','community.html'],['Rankings','rankings.html']];
    const current=new Map([...nav.querySelectorAll('a')].map(a=>[(a.getAttribute('href')||'').split('#')[0],a]));
    desired.forEach(([label,href])=>{if(!current.has(href)){const a=document.createElement('a');a.href=href;a.textContent=label;nav.appendChild(a);}});
  });
}

function fixExternalOverflow(){
  document.querySelectorAll('table').forEach(table=>{if(!table.parentElement?.classList.contains('table-scroll')){const wrap=document.createElement('div');wrap.className='table-scroll';wrap.style.overflowX='auto';wrap.style.maxWidth='100%';table.replaceWith(wrap);wrap.appendChild(table);}});
}

function showBackendBadge(){
  const page=document.body.dataset.page;
  if(!['auth','dashboard','profile'].includes(page||''))return;
  if(document.querySelector('.backend-health-badge'))return;
  const badge=document.createElement('div');badge.className='backend-health-badge';
  const supa=config.backend?.supabase;
  badge.textContent=supa?.url&&supa?.publishableKey?'Backend: Supabase connected':'Backend: local/demo only';
  Object.assign(badge.style,{position:'fixed',top:'76px',right:'12px',zIndex:'250',fontSize:'.72rem',padding:'7px 10px',borderRadius:'999px',background:'rgba(5,15,12,.82)',color:'#9fffc3',border:'1px solid rgba(80,255,145,.16)',backdropFilter:'blur(10px)'});
  document.body.appendChild(badge);
  setTimeout(()=>badge.remove(),5000);
}

function start(){ensureMobileViewport();ensureStyles();removeCoursePromises();polishBrand();normalizeNavigation();addFounderBlock();fixExternalOverflow();showBackendBadge();requestAnimationFrame(addMotionPolish);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
