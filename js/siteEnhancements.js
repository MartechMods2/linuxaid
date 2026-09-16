const CONFIG = window.LINUXAID_CONFIG || {};

function ready(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once:true });
  else fn();
}

function ensureStyles() {
  if (document.querySelector('link[data-linuxaid-product]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'product.css';
  link.dataset.linuxaidProduct = 'true';
  document.head.appendChild(link);
}

function ensureMeta() {
  if (!document.querySelector('meta[name="theme-color"]')) {
    const theme = document.createElement('meta');
    theme.name = 'theme-color';
    theme.content = '#061018';
    document.head.appendChild(theme);
  }
  if (!document.querySelector('link[rel="manifest"]')) {
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = 'manifest.webmanifest';
    document.head.appendChild(manifest);
  }
}

function addSkipLink() {
  if (document.querySelector('.skip-link')) return;
  const main = document.querySelector('main');
  if (main && !main.id) main.id = 'main-content';
  const link = document.createElement('a');
  link.className = 'skip-link';
  link.href = `#${main?.id || 'main-content'}`;
  link.textContent = 'Skip to content';
  document.body.prepend(link);
}

function upgradeNav() {
  const nav = document.querySelector('.navbar');
  const links = nav?.querySelector('.nav-links');
  if (!nav || !links) return;

  const additions = [
    ['Courses','courses.html'],
    ['Labs','labs.html'],
    ['Tools','tools.html']
  ];
  additions.forEach(([label, href]) => {
    if ([...links.querySelectorAll('a')].some(a => a.getAttribute('href') === href)) return;
    const a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    links.appendChild(a);
  });

  const path = location.pathname.split('/').pop() || 'index.html';
  [...links.querySelectorAll('a')].forEach(a => {
    const href = (a.getAttribute('href') || '').split('#')[0] || path;
    if (href === path || (path === '' && href === 'index.html')) a.classList.add('active-page');
  });

  if (!nav.querySelector('.mobile-menu-button')) {
    const button = document.createElement('button');
    button.className = 'mobile-menu-button';
    button.type = 'button';
    button.setAttribute('aria-label','Toggle navigation');
    button.setAttribute('aria-expanded','false');
    button.innerHTML = '<i class="fas fa-bars" aria-hidden="true"></i>';
    const cta = nav.querySelector('.cta-group');
    nav.insertBefore(button, cta || null);
    button.addEventListener('click', () => {
      const open = nav.classList.toggle('nav-open');
      button.setAttribute('aria-expanded', String(open));
      button.innerHTML = open ? '<i class="fas fa-times" aria-hidden="true"></i>' : '<i class="fas fa-bars" aria-hidden="true"></i>';
    });
    links.addEventListener('click', event => {
      if (event.target.closest('a')) {
        nav.classList.remove('nav-open');
        button.setAttribute('aria-expanded','false');
        button.innerHTML = '<i class="fas fa-bars" aria-hidden="true"></i>';
      }
    });
  }

  const cta = nav.querySelector('.cta-group');
  if (cta && !cta.querySelector('a[href="profile.html"]')) {
    const profile = document.createElement('a');
    profile.className = 'button';
    profile.href = 'profile.html';
    profile.textContent = 'Profile';
    cta.insertBefore(profile, cta.firstChild);
  }

  window.addEventListener('scroll', () => nav.classList.toggle('nav-scrolled', window.scrollY > 22), { passive:true });
  nav.classList.toggle('nav-scrolled', window.scrollY > 22);
}

function addScrollProgress() {
  const bar = document.createElement('div');
  bar.id = 'siteScrollProgress';
  bar.setAttribute('aria-hidden','true');
  document.body.appendChild(bar);
  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
  };
  addEventListener('scroll', update, { passive:true });
  addEventListener('resize', update, { passive:true });
  update();
}

function setupRevealAnimations() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const candidates = document.querySelectorAll('main section, .feature-card, .panel, .command-card, .roadmap-card, .community-card, .product-card, .tool-panel');
  candidates.forEach((el, index) => {
    el.classList.add('reveal-ready');
    el.style.transitionDelay = `${Math.min(index % 5, 4) * 45}ms`;
  });
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold:.08, rootMargin:'0px 0px -40px' });
  candidates.forEach(el => observer.observe(el));
}

function showIntroOnce() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (sessionStorage.getItem('linuxaid-intro-seen') === '1') return;
  sessionStorage.setItem('linuxaid-intro-seen','1');

  const intro = document.createElement('div');
  intro.className = 'site-intro';
  intro.innerHTML = `
    <div class="intro-terminal" role="status" aria-live="polite">
      <div class="intro-terminal-head"><span></span><span></span><span></span></div>
      <div class="intro-terminal-body">
        <div class="intro-logo">LinuxAid</div>
        <div id="introLine">$ boot linuxaid --safe-learning<span class="intro-cursor"></span></div>
      </div>
    </div>`;
  document.body.appendChild(intro);
  const line = intro.querySelector('#introLine');
  const messages = [
    '$ boot linuxaid --safe-learning',
    'Loading terminal sandbox...',
    'Loading AI tutor...',
    'Restoring learner workspace...',
    'Ready. Learn Linux without fear.'
  ];
  let index = 0;
  const timer = setInterval(() => {
    index += 1;
    if (index < messages.length) line.innerHTML += `<br>${messages[index]}`;
    if (index >= messages.length - 1) {
      clearInterval(timer);
      setTimeout(() => {
        intro.classList.add('done');
        setTimeout(() => intro.remove(), 650);
      }, 450);
    }
  }, 260);
}

function buildPalette() {
  const actions = [
    { icon:'fa-house', label:'Home', hint:'Landing page', action:() => location.href='index.html' },
    { icon:'fa-gauge-high', label:'Dashboard', hint:'AI, commands and terminal', action:() => location.href='dashboard.html' },
    { icon:'fa-graduation-cap', label:'Courses', hint:'Structured learning tracks', action:() => location.href='courses.html' },
    { icon:'fa-flask', label:'Labs', hint:'Hands-on Linux challenges', action:() => location.href='labs.html' },
    { icon:'fa-screwdriver-wrench', label:'Tools', hint:'Analyze commands and errors', action:() => location.href='tools.html' },
    { icon:'fa-user', label:'Profile', hint:'Progress and preferences', action:() => location.href='profile.html' },
    { icon:'fa-terminal', label:'Open terminal', hint:'Dashboard simulator', action:() => location.href='dashboard.html#terminal' },
    { icon:'fa-robot', label:'Ask LinuxAid', hint:'AI tutor', action:() => location.href='dashboard.html#assistant' },
    { icon:'fa-circle-half-stroke', label:'Toggle theme', hint:'Light / dark', action:() => document.getElementById('themeToggle')?.click() }
  ];
  const wrap = document.createElement('div');
  wrap.className = 'command-palette-backdrop';
  wrap.innerHTML = `<div class="command-palette" role="dialog" aria-modal="true" aria-label="LinuxAid command palette">
    <input type="search" placeholder="Where do you want to go?" aria-label="Search actions">
    <div class="palette-list"></div>
  </div>`;
  document.body.appendChild(wrap);
  const input = wrap.querySelector('input');
  const list = wrap.querySelector('.palette-list');

  const render = (query='') => {
    list.replaceChildren();
    actions.filter(item => `${item.label} ${item.hint}`.toLowerCase().includes(query.toLowerCase())).forEach(item => {
      const button = document.createElement('button');
      button.className = 'palette-item';
      button.type = 'button';
      button.innerHTML = `<span class="palette-icon"><i class="fas ${item.icon}"></i></span><span><strong>${item.label}</strong><br><small>${item.hint}</small></span><span class="kbd">↵</span>`;
      button.addEventListener('click', () => { close(); item.action(); });
      list.appendChild(button);
    });
  };
  const open = () => { wrap.classList.add('open'); render(input.value=''); setTimeout(() => input.focus(),20); };
  const close = () => wrap.classList.remove('open');
  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') list.querySelector('.palette-item')?.click();
    if (event.key === 'Escape') close();
  });
  wrap.addEventListener('click', event => { if (event.target === wrap) close(); });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); open(); }
    if (event.key === 'Escape') close();
  });
}

function addNetworkIndicator() {
  const pill = document.createElement('div');
  pill.className = 'network-pill';
  document.body.appendChild(pill);
  const update = () => {
    const online = navigator.onLine;
    pill.classList.toggle('offline', !online);
    pill.innerHTML = `<i class="fas ${online ? 'fa-wifi' : 'fa-triangle-exclamation'}"></i> ${online ? 'Online' : 'Offline mode'}`;
  };
  addEventListener('online', update);
  addEventListener('offline', update);
  update();
}

function setupPWA() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./service-worker.js').catch(error => console.warn('Service worker registration failed:', error));
  }
  let installPrompt = null;
  addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    if (document.querySelector('.install-app-button')) return;
    const button = document.createElement('button');
    button.className = 'install-app-button';
    button.type = 'button';
    button.innerHTML = '<i class="fas fa-download"></i> Install LinuxAid';
    document.body.appendChild(button);
    button.addEventListener('click', async () => {
      if (!installPrompt) return;
      await installPrompt.prompt();
      installPrompt = null;
      button.remove();
    });
  });
}

function improveExistingContent() {
  document.querySelectorAll('a[href="https://github.com/linuxaid"]').forEach(a => a.href = 'https://github.com/MartechMods2/linuxaid');
  document.querySelectorAll('a[href^="mailto:support@linuxaid.example"]').forEach(a => {
    a.href = 'mailto:support@linuxaid.dev';
    a.textContent = 'support@linuxaid.dev';
  });
  document.querySelectorAll('#themeToggle').forEach(button => button.setAttribute('aria-label','Toggle light and dark theme'));
  document.querySelectorAll('#closeAuth').forEach(button => button.setAttribute('aria-label','Close sign-in dialog'));

  const authOverlay = document.getElementById('authOverlay');
  const authForm = authOverlay?.querySelector('.auth-form');
  if (authForm && !authForm.querySelector('[data-full-auth]')) {
    const a = document.createElement('a');
    a.href = 'auth.html';
    a.className = 'button';
    a.dataset.fullAuth = 'true';
    a.style.textAlign = 'center';
    a.textContent = 'Create account / Reset password';
    authForm.appendChild(a);
  }
}

function setupInternalTransitions() {
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !url.pathname.endsWith('.html') || url.href === location.href) return;
    event.preventDefault();
    document.body.classList.add('page-transitioning');
    setTimeout(() => { location.href = url.href; }, 130);
  });
}

ensureStyles();
ensureMeta();
ready(() => {
  document.body.classList.add('product-ready');
  addSkipLink();
  upgradeNav();
  addScrollProgress();
  improveExistingContent();
  buildPalette();
  addNetworkIndicator();
  setupPWA();
  setupInternalTransitions();
  showIntroOnce();
  requestAnimationFrame(setupRevealAnimations);
});

export { upgradeNav, setupRevealAnimations };
