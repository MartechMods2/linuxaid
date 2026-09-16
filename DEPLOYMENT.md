# LinuxAid deployment guide

This checklist is for the current GitHub Pages + optional Firebase + optional AI proxy architecture.

## 1. Static web deployment

LinuxAid can be hosted directly from GitHub Pages because the learning UI, Terminal V2, local troubleshooting tools, courses, labs and browser progress are static.

Live project URL:

**https://martechmods2.github.io/linuxaid/**

Before deployment, verify:

- `main` CI is green.
- CodeQL is green.
- GitHub Pages build is green.
- `config.js` contains no provider secret keys.
- `allowInsecureBrowserAI` remains `false`.
- The PWA service worker updates successfully after deployment.

## 2. Firebase Authentication + Firestore

Firebase's Spark plan is suitable for an early LinuxAid deployment within its free quotas.

### Create the Firebase project

1. Create a Firebase project.
2. Add a **Web app**.
3. Copy the public Firebase web configuration values.
4. In Firebase Authentication, enable:
   - Email/Password
   - Google
5. Add your deployed domain to Authentication > Settings > Authorized domains.
6. Create a Firestore database.
7. Deploy the repository's `firestore.rules`.

### Configure LinuxAid

Edit the public `firebase` section in `config.js` or generate it during your deployment process:

```js
firebase: {
  apiKey: 'PUBLIC_FIREBASE_WEB_API_KEY',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '...',
  appId: '...'
}
```

Firebase web configuration values identify the Firebase project; they are not server secrets. Your Firestore rules are what protect private user data.

Never place an OpenAI or Gemini provider secret in this browser file.

## 3. AI proxy

LinuxAid ships with `api/ai.js` as a server-side proxy template. Deploy it to a serverless platform such as Vercel, Netlify Functions, Cloudflare Workers (after adapting the handler), Firebase Functions or another Node-compatible host.

Set provider secrets only on the server:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=...
```

or:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=...
```

Then set the public browser configuration:

```js
ai: {
  proxyUrl: 'https://your-api-host.example/api/ai',
  provider: 'server',
  allowInsecureBrowserAI: false
}
```

Recommended production controls:

- Restrict allowed origins to the LinuxAid domain.
- Apply per-IP and per-user rate limits.
- Set request-size limits.
- Log failures without logging secrets.
- Add budget/usage alerts at the AI provider.
- Return generic provider errors to the browser.

## 4. PWA/offline validation

LinuxAid includes `manifest.webmanifest` and `service-worker.js`.

After deploying:

1. Open the site in Chrome/Edge.
2. DevTools > Application > Manifest should show LinuxAid.
3. Confirm the service worker is activated.
4. Load Courses, Labs and Tools once.
5. Switch DevTools Network to Offline.
6. Revisit the cached pages.
7. Confirm `/api/` and Firebase traffic are not cached.

## 5. Firebase production checks

Before public launch:

- Confirm unauthenticated users cannot read `profiles`, `progress` or `chatHistory`.
- Confirm one user cannot read another user's private documents.
- Confirm community posts reject oversized or unsigned writes.
- Enable email verification if you plan to gate community posting later.
- Add Firebase App Check when the project grows beyond early testing.

## 6. GitHub release workflow

Recommended release process:

1. Create a feature branch.
2. Open a pull request into `main`.
3. Wait for CI + CodeQL.
4. Review the GitHub Pages preview/build status.
5. Merge only when green.
6. Verify the production URL after the Pages deployment completes.

## 7. Pre-launch smoke tests

Test on desktop and mobile:

- Landing page and mobile navigation
- Dark/light theme
- Ctrl/Cmd+K command palette
- Dashboard chat fallback
- Terminal V2
- Courses and quizzes
- Labs and XP rewards
- Tools page
- Profile export/import
- Sign in / sign up / reset password (when Firebase is enabled)
- Community read/write flow
- Offline page and cached PWA routes
- 404 page

## 8. What still needs a backend later

The static deployment is enough for the current learning experience, but these features should use protected backend services when added:

- paid plans or billing
- certificates with verification IDs
- admin analytics
- moderation queues
- email notifications
- advanced AI usage accounting
- shared achievements/leaderboards
- image or file uploads
- server-side course authoring

Do not reintroduce fake admin numbers as a substitute for those systems.
