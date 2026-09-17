// Public runtime configuration for the static LinuxAid site.
// Only PUBLIC client identifiers belong here. Never place Supabase service_role,
// Cloudflare Turnstile secret, Google OAuth secret, OpenAI/Gemini or SMTP secrets in this file.
window.LINUXAID_CONFIG = {
  backendProvider: 'supabase',
  backend: {
    provider: 'supabase',
    supabase: {
      url: 'https://qkpamdanjnxniwdinodi.supabase.co',
      publishableKey: 'sb_publishable_wTI5I06u46jE2DcCpelhYw_n6VYNps6',
      anonKey: ''
    },
    firebase: null
  },
  auth: {
    siteUrl: 'https://martechmods2.github.io/linuxaid/',
    googleEnabled: false,
    captcha: {
      provider: 'turnstile',
      // Public Cloudflare Turnstile site key goes here. The secret key belongs in Supabase Auth settings.
      siteKey: ''
    }
  },
  ai: {
    proxyUrl: '',
    edgeFunction: 'linuxaid-ai',
    provider: 'server',
    requestTimeoutMs: 25000,
    allowInsecureBrowserAI: false
  },
  analytics: {
    provider: 'posthog',
    posthogKey: 'phc_kWsQD4Tvvy4ubUm8KiQ73wG6TTKnNpHAa5AJ4AKNFrki',
    posthogHost: 'https://us.i.posthog.com',
    sessionReplay: false,
    respectDoNotTrack: true
  },
  product: {
    name: 'LinuxAid',
    founder: 'Martech',
    repository: 'https://github.com/MartechMods2/linuxaid',
    website: 'https://martechmods2.github.io/linuxaid/'
  }
};
window.LINUXAID_CONFIG.firebase = window.LINUXAID_CONFIG.backend.firebase;

// Make the current visual/mobile layer available on every legacy and new page.
for (const href of ['experience-v3.css','deployment-v4.css','mobile-v5.css']) {
  if (!document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.linuxaidRuntimeStyle = 'true';
    document.head.appendChild(link);
  }
}

Promise.all([
  import('./js/siteEnhancements.js'),
  import('./js/pageBasics.js'),
  import('./js/navExtras.js'),
  import('./js/analytics.js'),
  import('./js/sync.js'),
  import('./js/consent.js'),
  import('./js/terminalDock.js'),
  import('./js/brand.js')
]).then(modules => {
  const brand = modules[7];
  brand?.applyLinuxAidBranding?.();
  document.querySelectorAll('[data-rank-panel]').forEach(async node => {
    const [{ renderRankPanel }, { getProgressSummary }] = await Promise.all([import('./js/ranks.js'), import('./js/progress.js')]);
    renderRankPanel(node, getProgressSummary());
  });
  document.querySelectorAll('[data-open-terminal],#openTerminalPrimary').forEach(button => {
    button.addEventListener('click', () => document.dispatchEvent(new CustomEvent('linuxaid:open-terminal')));
  });
}).catch(error => {
  console.warn('LinuxAid shared product runtime could not be loaded:', error);
});
