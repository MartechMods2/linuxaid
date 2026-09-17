function ready(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once:true });
  else fn();
}

function addNavLink(nav, href, label) {
  if ([...nav.querySelectorAll('a')].some(link => link.getAttribute('href') === href)) return;
  const link = document.createElement('a');
  link.href = href;
  link.textContent = label;
  nav.appendChild(link);
}

ready(() => {
  document.querySelectorAll('.nav-links').forEach(nav => {
    addNavLink(nav, 'community.html', 'Community');
    addNavLink(nav, 'install.html', 'Install Linux');
  });
});
