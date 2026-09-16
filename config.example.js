// Copy this file to config.js and add only PUBLIC client identifiers.
// Never place Supabase service_role, OpenAI/Gemini, Resend or other secret keys here.
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
  ai: {
    // Leave blank to use the Supabase `linuxaid-ai` Edge Function automatically.
    proxyUrl: '',
    edgeFunction: 'linuxaid-ai',
    provider: 'server',
    allowInsecureBrowserAI: false
  },
  analytics: {
    provider: 'posthog',
    posthogKey: 'YOUR_POSTHOG_PROJECT_API_KEY',
    posthogHost: 'https://us.i.posthog.com',
    sessionReplay: false,
    respectDoNotTrack: true
  }
};
