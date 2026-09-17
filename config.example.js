// Copy this file to config.js and add only PUBLIC client identifiers.
// Never place Supabase service_role, Cloudflare Turnstile secret, Google OAuth secret,
// OpenAI/Gemini, SMTP or other private keys here.
window.LINUXAID_CONFIG = {
  backendProvider: 'supabase',
  backend: {
    provider: 'supabase',
    supabase: {
      url: 'https://YOUR_PROJECT.supabase.co',
      publishableKey: 'YOUR_SUPABASE_PUBLISHABLE_KEY',
      anonKey: ''
    },
    firebase: null
  },
  auth: {
    siteUrl: 'https://YOUR_PUBLIC_SITE/',
    googleEnabled: false,
    captcha: {
      provider: 'turnstile',
      siteKey: 'YOUR_PUBLIC_TURNSTILE_SITE_KEY'
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
    posthogKey: 'YOUR_POSTHOG_PROJECT_API_KEY',
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
