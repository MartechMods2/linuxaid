# LinuxAid 🐧

LinuxAid is a beginner-friendly Linux learning and practice platform built around safe experimentation. It combines an AI Linux tutor, an expanded command explorer, a browser-based terminal simulator, learner progress tracking, Firebase-ready authentication/community features, and safety guidance for commands that can change a real system.

## 🌐 Live website

**LinuxAid:** https://martechmods2.github.io/linuxaid/

**Repository:** https://github.com/MartechMods2/linuxaid

## What LinuxAid includes

- **LinuxAid Terminal V2** — a stateful virtual filesystem with real simulated `cp`, `mv`, `rm`, `grep`, `find`, `chmod`, redirection, history, autocomplete, `man`, monitoring and networking commands.
- **Command safety engine** — classifies commands as safe, medium, high or extreme and blocks destructive patterns such as filesystem-wiping commands inside the learning simulator.
- **Expanded command explorer** — command syntax, examples, related tools, risk levels and explanations across files, permissions, networking, packages, monitoring and shell usage.
- **AI Linux tutor** — proxy-first architecture so production API keys stay on the server rather than inside browser JavaScript.
- **Local tutor fallback** — useful Linux explanations still work when a remote AI provider is unavailable.
- **Safe chat rendering** — model and user text is escaped before supported Markdown formatting to prevent executable HTML from chat history.
- **Learner progress** — commands explored, XP, learning streak and roadmap percentages are calculated from actual simulator activity instead of hard-coded demo percentages.
- **Firebase scaffolding** — Google/email authentication, chat history and community loading with production-oriented Firestore security rules.
- **Dark/light themes** and responsive browser UI.
- **Automated quality gates** — Node unit tests, JavaScript syntax checks and GitHub CodeQL scanning.

## Project structure

```text
.
├── index.html                 # Landing page
├── linux.html                 # Linux learning page
├── dashboard.html             # Interactive learning dashboard
├── app.js                     # Browser application controller
├── firebase.js                # Firebase Auth/Firestore integration
├── gemini.js                  # Provider-neutral AI client (kept for compatibility)
├── config.js                  # PUBLIC browser config — never store AI secrets here
├── config.example.js          # Safe public config example
├── styles.css                 # Shared UI styling
├── firestore.rules            # Firestore access-control rules
├── api/
│   └── ai.js                  # Server-side AI proxy template
├── js/
│   ├── commandCatalog.js      # Linux command knowledge catalog
│   ├── progress.js            # Local learner progress engine
│   ├── security.js            # Safe HTML/Markdown helpers
│   └── terminalEngine.js      # Terminal Simulator V2
├── tests/                     # Node unit tests
└── .github/workflows/         # CI and CodeQL
```

## Run locally

LinuxAid remains a static web application, so you can use any local static server. With Node installed:

```bash
npx serve .
```

Then open the local URL shown by the server.

To verify the JavaScript and run the terminal/security/progress tests:

```bash
npm install
npm run ci
```

Node.js 22 or newer is recommended.

## AI configuration — production-safe approach

LinuxAid no longer expects production AI secrets to be stored in browser code. The recommended request path is:

```text
Browser → LinuxAid AI proxy → Gemini/OpenAI
```

Set the public browser endpoint in `config.js`:

```js
window.LINUXAID_CONFIG = {
  firebase: null,
  ai: {
    proxyUrl: 'https://your-server.example/api/ai',
    provider: 'server',
    allowInsecureBrowserAI: false
  }
};
```

The included `api/ai.js` is a server-side endpoint template suitable for environments that support JavaScript serverless functions. Configure secrets on that server using environment variables, not in the browser:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_server_secret
GEMINI_MODEL=gemini-2.5-flash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
LINUXAID_ALLOWED_ORIGIN=https://martechmods2.github.io
```

`AI_PROVIDER` can be `gemini` or `openai`.

> GitHub Pages only hosts the static frontend. Host the AI proxy on a serverless/backend provider and place that HTTPS endpoint in `config.js`. If no proxy is configured, LinuxAid automatically uses its local safety tutor instead of exposing a secret API key.

## Firebase setup

1. Create a Firebase project.
2. Enable the authentication providers you want to use.
3. Create Firestore.
4. Copy your Firebase **public web app configuration** into the `firebase` section of `config.js`.
5. Deploy `firestore.rules` before storing production user data.

Example:

```js
firebase: {
  apiKey: 'YOUR_FIREBASE_PUBLIC_WEB_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: '...',
  appId: '...'
}
```

Firebase web configuration identifies the project; authorization is enforced by Firebase Auth and Firestore Security Rules. Do not put server credentials or AI provider secrets there.

## Terminal Simulator V2

The simulator is intentionally isolated from the visitor's real computer. It maintains a virtual Linux filesystem and supports practical learning flows such as:

```bash
pwd
ls -la
mkdir demo
cd demo
echo hello > note.txt
cat note.txt
cp note.txt backup.txt
mv backup.txt final.txt
grep hello note.txt
find . -name "*.txt"
chmod 755 note.txt
stat note.txt
history
man chmod
```

It also simulates system/network inspection (`ps`, `free`, `df`, `ip`, `ss`, `ping`, `journalctl`, `systemctl status`) without touching the user's operating system.

## Safety model

LinuxAid teaches a simple workflow:

1. **Inspect first.**
2. Understand the exact command and target.
3. Prefer the smallest necessary change.
4. Warn before privilege elevation or destructive operations.
5. Verify the result after making a change.

The simulator blocks extreme destructive patterns rather than normalizing them as harmless beginner examples.

## Development quality gates

Every pull request and push to `main` should pass:

- JavaScript syntax/module checks
- Unit tests for terminal behavior, command safety, safe rendering and progress calculations
- GitHub CodeQL analysis

Run locally with:

```bash
npm run ci
```

## Current upgrade roadmap

The foundation is now ready for the next larger LinuxAid layers:

- Structured lessons and quizzes
- Scenario-based Linux Labs
- Distro profiles for Ubuntu/Debian, Fedora, Arch and others
- Error-output interpreter
- Shell-script analysis
- Cloud-synced learner progress
- Real community posting, answers and moderation
- Role-protected analytics/admin dashboard
- PWA/offline lessons and simulator data
- Accessibility and mobile navigation refinements

## License

Apache License 2.0. See `LICENSE`.

---

Built by **MartechMods2** as a safer, friendlier way to learn Linux by doing.
