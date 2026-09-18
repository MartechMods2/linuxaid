function ensureMobileViewport(){
  let meta=document.querySelector('meta[name="viewport"]');
  if(!meta){meta=document.createElement('meta');meta.name='viewport';document.head.appendChild(meta)}
  meta.content='width=device-width,initial-scale=1,viewport-fit=cover';
}

function ensureStyles(){
  if(document.querySelector('link[data-linuxaid-ui-v9]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='ui-v9.css?v=9.0';
  link.dataset.linuxaidUiV9='true';
  document.head.appendChild(link);
}

function removeCoursePromises(){
  document.querySelectorAll('a[href="courses.html"]').forEach(link=>{
    const card=link.closest('.feature-card,.product-card,.panel');
    if(card){
      const title=card.querySelector('h2,h3,h4'),body=card.querySelector('p');
      if(title)title.textContent='Command mastery & Linux challenges';
      if(body)body.textContent='Build confidence through safe terminal practice, troubleshooting tools, ranks and hands-on Linux challenges.';
      link.href='rankings.html';
      link.textContent='View ranks';
    }else link.remove();
  });
  document.querySelectorAll('.nav-links a').forEach(link=>{if(/course/i.test(link.textContent||''))link.remove()});
  document.querySelectorAll('a').forEach(link=>{if(/certificate/i.test(link.textContent||''))link.remove()});
}

function polishBrand(){
  document.querySelectorAll('.brand').forEach(brand=>{
    const first=brand.firstElementChild;
    if(first&&first.tagName!=='IMG'&&!brand.querySelector('img[data-linuxaid-logo]')){
      const img=document.createElement('img');
      img.dataset.linuxaidLogo='';
      img.className='linuxaid-brand-logo';
      img.alt='LinuxAid';
      import('./brand.js').then(mod=>{img.src=mod.LINUXAID_LOGO_DATA_URI||''}).catch(()=>{});
      first.replaceWith(img);
    }
  });
}

function addFounderBlock(){
  if(document.body.dataset.page!=='home'||document.querySelector('[data-linuxaid-founder]'))return;
  const anchor=document.querySelector('footer')?.closest('.section')||document.querySelector('footer');
  const section=document.createElement('section');
  section.className='section';
  section.dataset.linuxaidFounder='1';
  section.innerHTML=`<div class="founder-card"><div class="founder-mark"><img data-linuxaid-logo alt="LinuxAid"></div><div><div class="eyebrow">Built by Martech</div><h3>Martech — Founder & CEO, LinuxAid</h3><div class="founder-role">Creator • Product builder • Linux learning advocate</div><p>Martech created LinuxAid to make Linux less intimidating: inspect commands, practise safely, understand errors, build rank through useful activity and learn without risking your machine.</p></div><a class="button" href="support.html">Support LinuxAid</a></div>`;
  (anchor?.parentNode||document.querySelector('main'))?.insertBefore(section,anchor||null);
  import('./brand.js').then(mod=>mod.applyLinuxAidBranding?.()).catch(()=>{});
}

function addMotionPolish(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const nodes=[...document.querySelectorAll('.feature-card,.panel,.command-card,.community-card,.product-card,.founder-card,.rank-step')].slice(0,60);
  nodes.forEach((node,index)=>node.animate([{opacity:.001,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{
    duration:280+Math.min(index%4,3)*30,
    easing:'cubic-bezier(.2,.8,.2,1)',fill:'both',delay:Math.min(index,6)*12
  }));
}

function normalizeNavigation(){
  const page=document.body.dataset.page||'';
  const social=['community','people','messages'].includes(page);
  const desired=social
    ?[['Home','index.html'],['Dashboard','dashboard.html'],['Community','community.html'],['People','people.html'],['Messages','messages.html'],['Rankings','rankings.html']]
    :[['Home','index.html'],['Dashboard','dashboard.html'],['Labs','labs.html'],['Tools','tools.html'],['Community','community.html'],['Rankings','rankings.html']];
  document.querySelectorAll('.nav-links').forEach(nav=>{
    nav.replaceChildren();
    desired.forEach(([label,href])=>{
      const a=document.createElement('a');
      a.href=href;a.textContent=label;
      if(location.pathname.endsWith(href)||(!location.pathname.split('/').pop()&&href==='index.html'))a.classList.add('active-page');
      nav.appendChild(a);
    });
  });
}

function fixExternalOverflow(){
  document.querySelectorAll('table').forEach(table=>{
    if(!table.parentElement?.classList.contains('table-scroll')){
      const wrap=document.createElement('div');
      wrap.className='table-scroll';
      wrap.style.overflowX='auto';
      wrap.style.maxWidth='100%';
      table.replaceWith(wrap);
      wrap.appendChild(table);
    }
  });
}

function start(){
  ensureMobileViewport();
  ensureStyles();
  removeCoursePromises();
  polishBrand();
  normalizeNavigation();
  addFounderBlock();
  fixExternalOverflow();
  requestAnimationFrame(addMotionPolish);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
