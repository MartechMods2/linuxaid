// Public runtime configuration for the static LinuxAid site.
// Never place OpenAI/Gemini secret API keys in this browser-loaded file.
window.LINUXAID_CONFIG = {
  firebase: null,
  ai: {
    // Point this to a deployed server-side proxy, e.g. https://your-api.example/api/ai
    proxyUrl: '',
    provider: 'server',
    // Emergency development-only compatibility. Keep false in production.
    allowInsecureBrowserAI: false
  }
};
