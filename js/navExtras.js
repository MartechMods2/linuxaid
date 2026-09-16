function ready(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once:true });
  else fn();
}

ready(() => {
  document.querySelectorAll('.nav-links').forEach(nav => {
    if (![...nav.querySelectorAll('a')].some(link => link.getAttribute('href') === 'community.html')) {
      const link = document.createElement('a');
      link.href = 'community.html';
      link.textContent = 'Community';
      nav.appendChild(link);
    }
  });
});
