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
  },
  product: {
    name: 'LinuxAid',
    repository: 'https://github.com/MartechMods2/linuxaid',
    website: 'https://martechmods2.github.io/linuxaid/'
  }
};

// Every current LinuxAid page already loads config.js in <head>. Use that stable
// entry point to attach the shared product shell without duplicating script tags.
Promise.all([
  import('./js/siteEnhancements.js'),
  import('./js/pageBasics.js')
]).catch(error => {
  console.warn('LinuxAid shared product runtime could not be loaded:', error);
});
