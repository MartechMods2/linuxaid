// Copy the public Firebase client settings here if you use Firebase Auth/Firestore.
// Firebase client configuration is an identifier set, not a server secret; protect data with Firestore rules.
// NEVER put OpenAI/Gemini secret API keys in this browser-loaded file.
window.LINUXAID_CONFIG = {
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  },
  ai: {
    proxyUrl: 'https://your-server.example/api/ai',
    provider: 'server',
    allowInsecureBrowserAI: false
  }
};
