// Public runtime configuration for LinuxAid.
// Only browser-safe public identifiers belong here. Never place service-role,
// AI provider secrets, OAuth client secrets or CAPTCHA secret keys in this file.
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
    emailEnabled: true,
    googleEnabled: true,
    magicLinkEnabled: true,
    requireEmailVerification: true,
    // Turn this on only after Google OAuth is configured in Supabase.
    providerLabel: 'Supabase Auth'
  },
  security: {
    // Paste only the PUBLIC Turnstile site key here after creating a widget.
    // Put the Turnstile SECRET in Supabase Auth > Bot and Abuse Protection.
    turnstileSiteKey: '0x4AAAAAAE6PU0UdSo50KwA_',
    authTimeoutMs: 15000,
    maxAuthAttemptsPerWindow: 6,
    authAttemptWindowMs: 10 * 60 * 1000
  },
  ai: {
    proxyUrl: '',
    edgeFunction: 'linuxaid-ai',
    provider: 'server',
    allowInsecureBrowserAI: false,
    requestTimeoutMs: 25000
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
  import('./js/brand.js'),
  import('./js/runtimeV5.js')
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
}).catch(error => console.warn('LinuxAid shared runtime could not be loaded:', error));
