const CONFIG=window.LINUXAID_CONFIG||{};

function ready(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});else fn()}

function ensureMeta(){
  if(!document.querySelector('meta[name="theme-color"]')){
    const theme=document.createElement('meta');theme.name='theme-color';theme.content='#ffffff';document.head.appendChild(theme);
  }
  if(!document.querySelector('link[rel="manifest"]')){
    const manifest=document.createElement('link');manifest.rel='manifest';manifest.href='manifest.webmanifest';document.head.appendChild(manifest);
  }
}

function addSkipLink(){
  if(document.querySelector('.skip-link'))return;
  const main=document.querySelector('main');
  if(main&&!main.id)main.id='main-content';
  const link=document.createElement('a');
  link.className='skip-link';link.href=`#${main?.id||'main-content'}`;link.textContent='Skip to content';
  document.body.prepend(link);
}

function upgradeNav(){
  const nav=document.querySelector('.navbar');
  const links=nav?.querySelector('.nav-links');
  if(!nav||!links)return;

  let button=nav.querySelector('.mobile-menu-button');
  if(!button){
    button=document.createElement('button');
    button.className='mobile-menu-button';
    button.type='button';
    button.setAttribute('aria-label','Open navigation');
    button.setAttribute('aria-expanded','false');
    button.innerHTML='<span class="menu-glyph" aria-hidden="true"><i></i><i></i><i></i></span>';
    nav.appendChild(button);
  }else{
    button.innerHTML='<span class="menu-glyph" aria-hidden="true"><i></i><i></i><i></i></span>';
  }

  let backdrop=document.querySelector('.nav-menu-backdrop');
  if(!backdrop){
    backdrop=document.createElement('div');
    backdrop.className='nav-menu-backdrop';
    backdrop.setAttribute('aria-hidden','true');
    nav.insertAdjacentElement('afterend',backdrop);
  }

  const close=()=>{
    nav.classList.remove('nav-open');
    backdrop.classList.remove('open');
    document.documentElement.classList.remove('nav-lock');
    button.setAttribute('aria-expanded','false');
    button.setAttribute('aria-label','Open navigation');
  };
  const toggle=()=>{
    const open=!nav.classList.contains('nav-open');
    nav.classList.toggle('nav-open',open);
    backdrop.classList.toggle('open',open);
    document.documentElement.classList.toggle('nav-lock',open);
    button.setAttribute('aria-expanded',String(open));
    button.setAttribute('aria-label',open?'Close navigation':'Open navigation');
  };

  let pointerToggleAt=0;
  button.addEventListener('pointerup',event=>{
    if(event.pointerType==='touch'||event.pointerType==='pen'){
      event.preventDefault();
      pointerToggleAt=performance.now();
      toggle();
    }
  },{passive:false});
  button.addEventListener('click',event=>{
    if(performance.now()-pointerToggleAt<450){event.preventDefault();return}
    toggle();
  });
  backdrop.addEventListener('click',close);
  links.addEventListener('click',event=>{if(event.target.closest('a,button'))close()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')close()});
  addEventListener('resize',()=>{if(innerWidth>980)close()},{passive:true});
}

function addScrollProgress(){
  if(document.getElementById('siteScrollProgress'))return;
  const bar=document.createElement('div');bar.id='siteScrollProgress';bar.setAttribute('aria-hidden','true');document.body.appendChild(bar);
  const update=()=>{
    const max=document.documentElement.scrollHeight-innerHeight;
    bar.style.transform=`scaleX(${max>0?Math.min(1,scrollY/max):0})`;
  };
  addEventListener('scroll',update,{passive:true});addEventListener('resize',update,{passive:true});update();
}

function setupRevealAnimations(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const candidates=document.querySelectorAll('main section,.feature-card,.panel,.command-card,.community-card,.product-card,.tool-panel');
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('revealed');observer.unobserve(entry.target)}});
  },{threshold:.06,rootMargin:'0px 0px -28px'});
  candidates.forEach((el,index)=>{
    el.classList.add('reveal-ready');
    el.style.transitionDelay=`${Math.min(index%4,3)*25}ms`;
    observer.observe(el);
  });
}

function buildPalette(){
  if(document.querySelector('.command-palette-backdrop'))return;
  const actions=[
    ['fa-house','Home','index.html'],['fa-gauge-high','Dashboard','dashboard.html'],['fa-flask','Labs','labs.html'],
    ['fa-screwdriver-wrench','Tools','tools.html'],['fa-users','Community','community.html'],['fa-user-group','People','people.html'],
    ['fa-message','Messages','messages.html'],['fa-ranking-star','Rankings','rankings.html'],['fa-user','Profile','profile.html']
  ];
  const wrap=document.createElement('div');wrap.className='command-palette-backdrop';
  wrap.innerHTML='<div class="command-palette" role="dialog" aria-modal="true" aria-label="LinuxAid quick navigation"><input type="search" placeholder="Search LinuxAid…" aria-label="Search LinuxAid actions"><div class="palette-list"></div></div>';
  document.body.appendChild(wrap);
  const input=wrap.querySelector('input'),list=wrap.querySelector('.palette-list');
  const close=()=>wrap.classList.remove('open');
  const render=(query='')=>{
    list.replaceChildren();
    actions.filter(([,label])=>label.toLowerCase().includes(query.toLowerCase())).forEach(([icon,label,href])=>{
      const b=document.createElement('button');b.className='palette-item';b.type='button';
      b.innerHTML=`<span class="palette-icon"><i class="fas ${icon}"></i></span><span><strong>${label}</strong><br><small>Open ${label}</small></span><span class="kbd">↵</span>`;
      b.onclick=()=>{location.href=href};list.appendChild(b);
    });
  };
  const open=()=>{wrap.classList.add('open');input.value='';render();requestAnimationFrame(()=>input.focus())};
  input.addEventListener('input',()=>render(input.value));
  input.addEventListener('keydown',e=>{if(e.key==='Enter')list.querySelector('.palette-item')?.click();if(e.key==='Escape')close()});
  wrap.addEventListener('click',e=>{if(e.target===wrap)close()});
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();open()}else if(e.key==='Escape')close()});
}

function addNetworkIndicator(){
  if(document.querySelector('.network-pill'))return;
  const pill=document.createElement('div');pill.className='network-pill';document.body.appendChild(pill);
  const update=()=>{
    const online=navigator.onLine;pill.classList.toggle('offline',!online);
    pill.innerHTML=`<i class="fas ${online?'fa-wifi':'fa-triangle-exclamation'}"></i> ${online?'Online':'Offline mode'}`;
  };
  addEventListener('online',update);addEventListener('offline',update);update();
}

function setupPWA(){
  if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){
    navigator.serviceWorker.register('./service-worker.js').catch(error=>console.warn('Service worker registration failed:',error));
  }
  let installPrompt=null,button=null;
  const place=()=>{
    if(!button)return;
    const mobile=matchMedia('(max-width:720px)').matches;
    const nav=document.querySelector('.nav-links');
    if(mobile&&nav){
      button.classList.add('install-app-nav');
      if(button.parentElement!==nav)nav.appendChild(button);
    }else{
      button.classList.remove('install-app-nav');
      if(button.parentElement!==document.body)document.body.appendChild(button);
    }
  };
  addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();installPrompt=event;
    if(!button){
      button=document.createElement('button');button.className='install-app-button';button.type='button';
      button.innerHTML='<i class="fas fa-download"></i><span>Install LinuxAid</span>';
      button.addEventListener('click',async()=>{
        if(!installPrompt)return;
        await installPrompt.prompt();installPrompt=null;button.remove();button=null;
      });
    }
    place();
  });
  addEventListener('resize',place,{passive:true});
}

function improveExistingContent(){
  document.querySelectorAll('a[href*="github.com/MartechMods2/linuxaid"],a[href="https://github.com/linuxaid"]').forEach(link=>{
    link.href='support.html';
    if(/github|repository|project/i.test(link.textContent||''))link.textContent='Support LinuxAid';
  });
  document.querySelectorAll('a[href^="mailto:support@linuxaid.example"]').forEach(a=>{a.href='mailto:support@linuxaid.dev';a.textContent='support@linuxaid.dev'});
  document.querySelectorAll('#closeAuth').forEach(button=>button.setAttribute('aria-label','Close sign-in dialog'));

  document.querySelectorAll('.footer .footer-row').forEach(row=>{
    if(row.querySelector('.footer-legal'))return;
    const legal=document.createElement('div');legal.className='footer-legal';
    legal.innerHTML='<span>© 2026 Martech. LinuxAid. All rights reserved.</span><span><a href="terms.html">Terms</a> · <a href="privacy.html">Privacy</a></span>';
    row.appendChild(legal);
  });
}

function setupInternalTransitions(){
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');
    if(!link||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target==='_blank')return;
    const url=new URL(link.href,location.href);
    if(url.origin!==location.origin||!url.pathname.endsWith('.html')||url.href===location.href)return;
    event.preventDefault();document.body.classList.add('page-transitioning');
    setTimeout(()=>{location.href=url.href},60);
  });
}

ensureMeta();
ready(()=>{
  document.body.classList.add('product-ready');
  addSkipLink();
  upgradeNav();
  addScrollProgress();
  improveExistingContent();
  buildPalette();
  addNetworkIndicator();
  setupPWA();
  setupInternalTransitions();
  requestAnimationFrame(setupRevealAnimations);
});
