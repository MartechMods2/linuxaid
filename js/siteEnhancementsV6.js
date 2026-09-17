import { initBackend, getBackendStatus, loadNotifications, subscribeToTable } from '../backend.js';

const config=window.LINUXAID_CONFIG||{};
const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();

function standardizeNav(){
  document.querySelectorAll('.navbar').forEach(nav=>{
    const links=nav.querySelector('.nav-links'); if(!links)return;
    const items=[['Home','index.html'],['Dashboard','dashboard.html'],['Community','community.html'],['People','people.html'],['Messages','messages.html'],['Labs','labs.html'],['Tools','tools.html'],['Rankings','rankings.html']];
    links.replaceChildren();
    const path=location.pathname.split('/').pop()||'index.html';
    items.forEach(([label,href])=>{const a=document.createElement('a');a.href=href;a.textContent=label;if(path===href)a.classList.add('active-page');links.appendChild(a);});
    let menu=nav.querySelector('.mobile-menu-button');
    if(!menu){menu=document.createElement('button');menu.className='button icon-button mobile-menu-button';menu.type='button';menu.setAttribute('aria-label','Open navigation');nav.insertBefore(menu,nav.querySelector('.cta-group')||null);}
    const draw=()=>{const open=nav.classList.contains('nav-open');menu.innerHTML=`<i class="fas ${open?'fa-xmark':'fa-bars'}"></i>`;menu.setAttribute('aria-expanded',String(open));};
    menu.onclick=()=>{nav.classList.toggle('nav-open');draw();};draw();
    links.addEventListener('click',()=>{nav.classList.remove('nav-open');draw();});
    document.addEventListener('click',e=>{if(innerWidth<=900&&nav.classList.contains('nav-open')&&!nav.contains(e.target)){nav.classList.remove('nav-open');draw();}});
  });
}

async function addAccountControls(){
  await initBackend(config);
  const status=getBackendStatus();
  document.querySelectorAll('.cta-group').forEach(group=>{
    group.querySelectorAll('[data-v6-account],[data-v6-notifications]').forEach(n=>n.remove());
    const bell=document.createElement('a');bell.href='notifications.html';bell.className='button icon-button';bell.dataset.v6Notifications='1';bell.setAttribute('aria-label','Notifications');bell.innerHTML='<i class="fas fa-bell"></i>';group.prepend(bell);
    const account=document.createElement('a');account.dataset.v6Account='1';account.className='button';account.href=status.user?'profile.html':'auth.html';account.textContent=status.user?'Profile':'Sign in';group.prepend(account);
    const refresh=async()=>{if(!getBackendStatus().user){bell.querySelector('.notification-dot')?.remove();return;}try{const items=await loadNotifications(20);const unread=items.some(n=>!n.read_at);if(unread&&!bell.querySelector('.notification-dot')){const dot=document.createElement('span');dot.className='notification-dot';bell.appendChild(dot);}if(!unread)bell.querySelector('.notification-dot')?.remove();}catch{}};
    refresh();
    if(status.user){const stop=subscribeToTable('notifications',refresh,`user_id=eq.${status.user.uid}`);addEventListener('pagehide',stop,{once:true});}
  });
}

function addSkipLink(){if(document.querySelector('.skip-link'))return;const main=document.querySelector('main');if(main&&!main.id)main.id='main-content';const a=document.createElement('a');a.className='skip-link';a.href='#main-content';a.textContent='Skip to content';document.body.prepend(a);}

function reveal(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const nodes=[...document.querySelectorAll('main section,.feature-card,.panel,.community-card,.social-card,.tool-panel,.command-card,.stat-card')].slice(0,120);const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('revealed');io.unobserve(e.target);}}),{threshold:.07,rootMargin:'0px 0px -30px'});nodes.forEach((n,i)=>{n.classList.add('reveal-ready');n.style.transitionDelay=`${Math.min(i%4,3)*35}ms`;io.observe(n);});}

function commandPalette(){if(document.querySelector('.command-palette-backdrop'))return;const actions=[['fa-house','Home','index.html'],['fa-gauge-high','Dashboard','dashboard.html'],['fa-comments','Community','community.html'],['fa-users','People','people.html'],['fa-message','Messages','messages.html'],['fa-flask','Labs','labs.html'],['fa-screwdriver-wrench','Tools','tools.html'],['fa-ranking-star','Rankings','rankings.html'],['fa-user','Profile','profile.html']];const wrap=document.createElement('div');wrap.className='command-palette-backdrop';wrap.innerHTML='<div class="command-palette" role="dialog" aria-modal="true"><input type="search" placeholder="Search LinuxAid…" aria-label="Search LinuxAid"><div class="palette-list"></div></div>';document.body.appendChild(wrap);const input=wrap.querySelector('input'),list=wrap.querySelector('.palette-list');const render=()=>{const q=input.value.toLowerCase();list.replaceChildren();actions.filter(x=>x[1].toLowerCase().includes(q)).forEach(([icon,label,href])=>{const b=document.createElement('button');b.className='palette-item';b.type='button';b.innerHTML=`<span class="palette-icon"><i class="fas ${icon}"></i></span><span><strong>${label}</strong><br><small>Open ${label.toLowerCase()}</small></span><span class="kbd">↵</span>`;b.onclick=()=>location.href=href;list.appendChild(b);});};const open=()=>{wrap.classList.add('open');input.value='';render();setTimeout(()=>input.focus(),20);},close=()=>wrap.classList.remove('open');document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();open();}if(e.key==='Escape')close();});input.oninput=render;input.onkeydown=e=>{if(e.key==='Enter')list.querySelector('button')?.click();};wrap.onclick=e=>{if(e.target===wrap)close();};}

function networkIndicator(){if(document.querySelector('.network-pill'))return;const p=document.createElement('div');p.className='network-pill';document.body.appendChild(p);const update=()=>p.innerHTML=`<i class="fas ${navigator.onLine?'fa-wifi':'fa-triangle-exclamation'}"></i> ${navigator.onLine?'Online':'Offline'}`;addEventListener('online',update);addEventListener('offline',update);update();}

function setupPWA(){if('serviceWorker'in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))navigator.serviceWorker.register('./service-worker.js').catch(()=>{});let prompt=null;addEventListener('beforeinstallprompt',e=>{e.preventDefault();prompt=e;if(document.querySelector('.install-app-button'))return;const b=document.createElement('button');b.className='install-app-button';b.innerHTML='<i class="fas fa-download"></i> Install LinuxAid';document.body.appendChild(b);b.onclick=async()=>{if(prompt){await prompt.prompt();prompt=null;}b.remove();};});}

function subtleIntro(){if(sessionStorage.getItem('linuxaid-v6-intro')||matchMedia('(prefers-reduced-motion: reduce)').matches)return;sessionStorage.setItem('linuxaid-v6-intro','1');const veil=document.createElement('div');veil.style.cssText='position:fixed;inset:0;z-index:5000;display:grid;place-items:center;background:var(--la-bg);transition:opacity .55s ease';veil.innerHTML='<div style="text-align:center"><div style="font-family:Fira Code,monospace;color:var(--la-green);font-size:.78rem;letter-spacing:.18em;text-transform:uppercase">LinuxAid</div><div style="font-size:clamp(2rem,7vw,4.6rem);font-weight:900;letter-spacing:-.06em;margin-top:8px">Learn. Connect. Build.</div></div>';document.body.appendChild(veil);setTimeout(()=>{veil.style.opacity='0';setTimeout(()=>veil.remove(),560);},650);}

function footerCleanup(){document.querySelectorAll('a[href="courses.html"]').forEach(a=>{a.href='rankings.html';a.textContent=/course/i.test(a.textContent||'')?'Rankings':a.textContent;});document.querySelectorAll('a').forEach(a=>{if(/certificate/i.test(a.textContent||''))a.remove();});}

ready(()=>{addSkipLink();standardizeNav();footerCleanup();commandPalette();networkIndicator();setupPWA();subtleIntro();requestAnimationFrame(reveal);addAccountControls();});
