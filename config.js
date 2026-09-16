// Public runtime configuration for the static LinuxAid site.
// Supabase project URLs and publishable/anon keys are browser-safe identifiers.
// Security is enforced with Row Level Security (RLS). Never put service_role,
// OpenAI, Gemini, Resend or other secret server keys in this file.
window.LINUXAID_CONFIG = {
  backendProvider: 'supabase',
  backend: {
    provider: 'supabase',
    supabase: {
      url: 'https://qkpamdanjnxniwdinodi.supabase.co',
      publishableKey: 'sb_publishable_wTI5I06u46jE2DcCpelhYw_n6VYNps6',
      // `anonKey` remains supported for older Supabase projects.
      anonKey: ''
    },
    // Optional fallback only. Leave null when Supabase is your backend.
    firebase: null
  },
  ai: {
    // With Supabase configured, LinuxAid automatically prefers the
    // `linuxaid-ai` Edge Function. You can still override with a custom proxy.
    proxyUrl: '',
    edgeFunction: 'linuxaid-ai',
    provider: 'server',
    allowInsecureBrowserAI: false
  },
  analytics: {
    provider: 'posthog',
    // PostHog project API keys are intended for client-side SDK use.
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

// Old pages may still read this property. It remains null when Supabase is used.
window.LINUXAID_CONFIG.firebase = window.LINUXAID_CONFIG.backend.firebase;

Promise.all([
  import('./js/siteEnhancements.js'),
  import('./js/pageBasics.js'),
  import('./js/navExtras.js'),
  import('./js/analytics.js'),
  import('./js/sync.js')
]).catch(error => {
  console.warn('LinuxAid shared product runtime could not be loaded:', error);
});
