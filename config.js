// Public runtime configuration for the static LinuxAid site.
// Supabase project URLs and publishable keys are browser-safe identifiers.
// Security is enforced with Row Level Security (RLS). Never put service_role,
// OpenAI, Gemini, Resend or other secret server keys in this file.
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
  ai: {
    proxyUrl: '',
    edgeFunction: 'linuxaid-ai',
    provider: 'server',
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
    repository: 'https://github.com/MartechMods2/linuxaid',
    website: 'https://martechmods2.github.io/linuxaid/'
  }
};
window.LINUXAID_CONFIG.firebase = window.LINUXAID_CONFIG.backend.firebase;

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
