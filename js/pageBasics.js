function ready(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once:true });
  else fn();
}

ready(() => {
  const page = document.body.dataset.page || '';
  const originalAppPage = ['dashboard','landing','linux'].includes(page);

  // The original three pages already receive these listeners from app.js.
  if (!originalAppPage) {
    const stored = localStorage.getItem('linuxaid-theme');
    if (stored === 'light') document.body.classList.add('light-theme');
    const button = document.getElementById('themeToggle');
    const updateIcon = () => {
      const icon = button?.querySelector('i');
      if (icon) icon.className = document.body.classList.contains('light-theme') ? 'fas fa-sun' : 'fas fa-moon';
    };
    button?.addEventListener('click', () => {
      const light = document.body.classList.toggle('light-theme');
      localStorage.setItem('linuxaid-theme', light ? 'light' : 'dark');
      updateIcon();
    });
    updateIcon();

    const back = document.getElementById('backToTop');
    back?.addEventListener('click', () => scrollTo({ top:0, behavior:'smooth' }));
    addEventListener('scroll', () => back?.classList.toggle('show', scrollY > 320), { passive:true });
  }

  // Phase 1 inherited a static mock admin section. Hide it until a real
  // role-protected analytics backend exists; fake production numbers are worse
  // than no numbers.
  document.querySelectorAll('.admin-shell').forEach(section => {
    section.hidden = true;
    section.setAttribute('aria-hidden','true');
  });
});
