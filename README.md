# LinuxAid

LinuxAid is a beginner-friendly web learning platform for Linux with AI guidance, command exploration, a safe terminal simulator, and community learning sections.

## What is included

- Landing page: `index.html`
- Linux learning page: `linux.html`
- App dashboard: `dashboard.html`
- Shared styling: `styles.css`
- Core application logic: `app.js`
- Firebase integration scaffolding: `firebase.js`
- Gemini AI assistant integration: `gemini.js`
- Environment placeholders: `.env.example`, `config.example.js`
- Static branding and theme support

## Setup

1. Copy `config.example.js` to `config.js` in the project root.
2. Fill in your Firebase configuration values and the Gemini API key.
3. Open `index.html`, `linux.html`, or `dashboard.html` in a browser.

### Example `config.js`

```js
window.LINUXAID_CONFIG = {
  firebase: {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_AUTH_DOMAIN',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_STORAGE_BUCKET',
    messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
    appId: 'YOUR_APP_ID'
  },
  geminiApiKey: 'YOUR_GEMINI_API_KEY',
  geminiApiUrl: 'https://api.openai.com/v1/chat/completions'
};
```

> For production hosting, keep API keys secure and consider using a server-side proxy for Gemini API requests.

## Development notes

- The dashboard now uses a `data-page` attribute to initialize only the page-specific features.
- If Firebase is not configured, the site falls back to local session preview mode and saves chat history to `localStorage`.
- Gemini integration code is present, but the API key must be supplied by the developer.

## Deployment recommendations

1. Ensure `config.js` is created from `config.example.js` and is not committed.
2. Use Firebase Hosting or any static site host.
3. For a production-grade AI assistant, deploy a secure server-side function to proxy Gemini/OpenAI requests instead of exposing the API key in the browser.

## Remaining TODOs

- Add a server-side proxy or Cloud Function for Gemini/OpenAI to protect API keys.
- Add Firestore security rules before production use.
- Build a full authentication flow with profile, settings, and email verification.
- Create a proper community post submission form backed by Firestore.

## Notes

- The previous version only simulated authentication with browser state. This update preserves the UI but adds real Firebase scaffolding and a page structure for landing and Linux learning.
