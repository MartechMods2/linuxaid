const CONFIG = window.LINUXAID_CONFIG || {};

function ready(fn){
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',fn,{once:true});
  else fn();
}

function ensureMeta(){
  if(!document.querySelector('meta[name="theme-color"]')){
    const meta=document.createElement('meta'); meta.name='theme-color'; meta.content='#061018'; document.head.appendChild(meta);
  }
  if(!document.querySelector('link[rel="manifest"]')){
    const link=document.createElement('link'); link.rel='manifest'; link.href='manifest.webmanifest'; document.head.appendChild(link);
  }
}

function addSkipLink(){
  if(document.querySelector('.skip-link')) return;
  const main=document.querySelector('main'); if(main&&!main.id) main.id='main-content';
  const link=document.createElement('a'); link.className='skip-link'; link.href=`#${main?.id||'main-content'}`; link.textContent='Skip to content';
  document.body.prepend(link);
}

function upgradeNav(){
  const nav=document.querySelector('.navbar'); const links=nav?.querySelector('.nav-links');
  if(!nav||!links) return;

  // LinuxAid is a practice platform, not a certification/course promise.
  links.querySelectorAll('a[href="courses.html"]').forEach(node=>node.remove());
  const additions=[['Labs','labs.html'],['Tools','tools.html'],['Community','community.html'],['Rankings','rankings.html']];
  additions.forEach(([label,href])=>{
    if([...links.querySelectorAll('a')].some(a=>a.getAttribute('href')===href)) return;
    const a=document.createElement('a'); a.href=href; a.textContent=label; links.appendChild(a);
  });

  const path=location.pathname.split('/').pop()||'index.html';
  links.querySelectorAll('a').forEach(a=>{
    const href=(a.getAttribute('href')||'').split('#')[0]||path;
    a.classList.toggle('active-page',href===path||(path===''&&href==='index.html'));
  });

  if(!nav.querySelector('.mobile-menu-button')){
    const button=document.createElement('button');
    button.className='mobile-menu-button'; button.type='button'; button.setAttribute('aria-label','Toggle navigation'); button.setAttribute('aria-expanded','false');
    button.innerHTML='<i class="fas fa-bars" aria-hidden="true"></i>';
    nav.insertBefore(button,nav.querySelector('.cta-group')||null);
    const setOpen=open=>{
      nav.classList.toggle('nav-open',open); button.setAttribute('aria-expanded',String(open));
      button.innerHTML=open?'<i class="fas fa-times" aria-hidden="true"></i>':'<i class="fas fa-bars" aria-hidden="true"></i>';
    };
    button.addEventListener('click',()=>setOpen(!nav.classList.contains('nav-open')));
    links.addEventListener('click',e=>{if(e.target.closest('a')) setOpen(false);});
    document.addEventListener('keydown',e=>{if(e.key==='Escape') setOpen(false);});
  }

  const cta=nav.querySelector('.cta-group');
  if(cta&&!cta.querySelector('a[href="profile.html"]')){
    const profile=document.createElement('a'); profile.className='button'; profile.href='profile.html'; profile.textContent='Profile'; cta.prepend(profile);
  }

  const scroll=()=>nav.classList.toggle('nav-scrolled',scrollY>22);
  addEventListener('scroll',scroll,{passive:true}); scroll();
}

function addScrollProgress(){
  if(document.getElementById('siteScrollProgress')) return;
  const bar=document.createElement('div'); bar.id='siteScrollProgress'; bar.setAttribute('aria-hidden','true'); document.body.appendChild(bar);
  const update=()=>{const max=document.documentElement.scrollHeight-innerHeight;bar.style.transform=`scaleX(${max>0?Math.min(1,scrollY/max):0})`;};
  addEventListener('scroll',update,{passive:true}); addEventListener('resize',update,{passive:true}); update();
}

function setupRevealAnimations(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const nodes=document.querySelectorAll('main section,.feature-card,.panel,.command-card,.roadmap-card,.community-card,.product-card,.tool-panel,.founder-card');
  nodes.forEach((node,index)=>{node.classList.add('reveal-ready');node.style.transitionDelay=`${Math.min(index%4,3)*38}ms`;});
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){entry.target.classList.add('revealed');observer.unobserve(entry.target);}
  }),{threshold:.06,rootMargin:'0px 0px -24px'});
  nodes.forEach(node=>observer.observe(node));
}

function buildPalette(){
  if(document.querySelector('.command-palette-backdrop')) return;
  const actions=[
    ['fa-house','Home','Landing page',()=>location.href='index.html'],
    ['fa-gauge-high','Dashboard','AI, commands and progress',()=>location.href='dashboard.html'],
    ['fa-terminal','Terminal','Open the floating safe terminal',()=>document.dispatchEvent(new CustomEvent('linuxaid:open-terminal'))],
    ['fa-flask','Labs','Hands-on Linux challenges',()=>location.href='labs.html'],
    ['fa-screwdriver-wrench','Tools','Analyze commands and errors',()=>location.href='tools.html'],
    ['fa-ranking-star','Rankings','XP ranks and milestones',()=>location.href='rankings.html'],
    ['fa-users','Community','LinuxAid discussions',()=>location.href='community.html'],
    ['fa-user','Profile','Progress and preferences',()=>location.href='profile.html'],
    ['fa-circle-half-stroke','Toggle theme','Light / dark',()=>document.getElementById('themeToggle')?.click()]
  ];
  const wrap=document.createElement('div'); wrap.className='command-palette-backdrop';
  wrap.innerHTML='<div class="command-palette" role="dialog" aria-modal="true" aria-label="LinuxAid command palette"><input type="search" placeholder="Where do you want to go?" aria-label="Search actions"><div class="palette-list"></div></div>';
  document.body.appendChild(wrap);
  const input=wrap.querySelector('input'), list=wrap.querySelector('.palette-list');
  const close=()=>wrap.classList.remove('open');
  const render=(q='')=>{
    list.replaceChildren();
    actions.filter(([,label,hint])=>`${label} ${hint}`.toLowerCase().includes(q.toLowerCase())).forEach(([icon,label,hint,action])=>{
      const b=document.createElement('button'); b.className='palette-item'; b.type='button';
      b.innerHTML=`<span class="palette-icon"><i class="fas ${icon}"></i></span><span><strong>${label}</strong><br><small>${hint}</small></span><span class="kbd">↵</span>`;
      b.onclick=()=>{close();action();}; list.appendChild(b);
    });
  };
  const open=()=>{wrap.classList.add('open');input.value='';render();setTimeout(()=>input.focus(),20);};
  input.addEventListener('input',()=>render(input.value)); input.addEventListener('keydown',e=>{if(e.key==='Enter')list.querySelector('.palette-item')?.click();if(e.key==='Escape')close();});
  wrap.addEventListener('click',e=>{if(e.target===wrap)close();});
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();open();}if(e.key==='Escape')close();});
}

function addNetworkIndicator(){
  if(document.querySelector('.network-pill')) return;
  const pill=document.createElement('div'); pill.className='network-pill'; document.body.appendChild(pill);
  const update=()=>{const online=navigator.onLine;pill.classList.toggle('offline',!online);pill.innerHTML=`<i class="fas ${online?'fa-wifi':'fa-triangle-exclamation'}"></i> ${online?'Online':'Offline mode'}`;};
  addEventListener('online',update); addEventListener('offline',update); update();
}

function setupPWA(){
  if('serviceWorker'in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){
    navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'}).then(reg=>reg.update()).catch(error=>console.warn('Service worker registration failed:',error));
  }
  let prompt=null;
  addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();prompt=event;if(document.querySelector('.install-app-button'))return;
    const button=document.createElement('button');button.className='install-app-button';button.type='button';button.innerHTML='<i class="fas fa-download"></i> Install LinuxAid';document.body.appendChild(button);
    button.onclick=async()=>{if(!prompt)return;await prompt.prompt();prompt=null;button.remove();};
  });
}

function improveExistingContent(){
  document.querySelectorAll('a[href="courses.html"]').forEach(a=>{a.href='rankings.html';if(/course/i.test(a.textContent||''))a.textContent='Rankings';});
  document.querySelectorAll('a[href="https://github.com/linuxaid"]').forEach(a=>a.href='https://github.com/MartechMods2/linuxaid');
  document.querySelectorAll('#themeToggle').forEach(b=>b.setAttribute('aria-label','Toggle light and dark theme'));
  const meta=document.querySelector('meta[name="author"]'); if(meta) meta.content='Martech, Founder & CEO of LinuxAid';
}

function setupInternalTransitions(){
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');if(!link||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const url=new URL(link.href,location.href);if(url.origin!==location.origin||!url.pathname.endsWith('.html')||url.href===location.href)return;
    event.preventDefault();document.body.classList.add('page-transitioning');setTimeout(()=>{location.href=url.href;},100);
  });
}

ensureMeta();
ready(()=>{
  document.body.classList.add('product-ready');
  addSkipLink();upgradeNav();addScrollProgress();improveExistingContent();buildPalette();addNetworkIndicator();setupPWA();setupInternalTransitions();
  requestAnimationFrame(setupRevealAnimations);
});

export{upgradeNav,setupRevealAnimations};
