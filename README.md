# LinuxAid

**LinuxAid** is a beginner-friendly Linux learning platform that combines structured courses, safe terminal practice, AI guidance, hands-on labs, troubleshooting tools, community learning and visible learner progress.

🌐 **Live website:** https://martechmods2.github.io/linuxaid/

📦 **Repository:** https://github.com/MartechMods2/linuxaid

## What LinuxAid is becoming

LinuxAid is no longer just a command list plus a fake terminal. The current product is organized around six ideas:

- **Learn** — structured Linux courses with short lessons and quizzes.
- **Practice** — Terminal V2 with a stateful virtual filesystem and realistic commands.
- **Ask** — AI-assisted Linux explanations through a secure server-side proxy, with a local tutor fallback.
- **Labs** — scenario-based challenges for permissions, files, services, networking and troubleshooting.
- **Tools** — deterministic command-risk, permission, distro and error-analysis utilities.
- **Progress** — XP, command exploration, streaks, achievements, course progress and profile export/import.

## Main pages

| Page | Purpose |
| --- | --- |
| `index.html` | Marketing / landing page |
| `dashboard.html` | AI tutor, command explorer, Terminal V2 and roadmap |
| `linux.html` | Linux fundamentals guide |
| `courses.html` | Structured learning tracks and quizzes |
| `labs.html` | Hands-on scenario labs |
| `tools.html` | Command analyzer, permission decoder, distro converter and error interpreter |
| `community.html` | Firebase-ready learner discussions |
| `profile.html` | Progress, achievements, preferences and data portability |
| `auth.html` | Firebase-ready sign in, sign up and password reset |
| `offline.html` | PWA offline fallback |
| `404.html` | GitHub Pages not-found experience |

## Current highlights

### Terminal Simulator V2

The browser simulator has a stateful virtual filesystem and supports realistic learning workflows including:

- `pwd`, `ls`, `cd`, `mkdir`, `touch`, `cat`
- `cp`, `mv`, `rm`
- `head`, `tail`, `grep`, `find`
- `chmod`, `stat`, `du`, `df`, `free`, `ps`
- `ping`, `ip`, `ss`
- package-manager simulations
- `systemctl`, `journalctl`
- `man`, `history`, autocomplete and command history
- safe output redirection

Destructive command patterns are blocked instead of simulated.

### Command Safety Engine

LinuxAid classifies commands as **safe**, **medium**, **high** or **extreme** risk and explains why. The Tools page also works without remote AI, which keeps core safety guidance fast and available offline.

### Courses and labs

Current learning tracks include:

- Linux Foundations
- Linux Administration
- Linux Networking
- Bash & Automation

Hands-on labs cover permission errors, file finding, disk checks, service debugging, network triage, log searching, safe backups and project archives.

### Authentication

LinuxAid has a Firebase-ready account flow with:

- Google sign-in
- Email/password sign-in
- Account creation
- Email verification request
- Password reset
- Browser-only demo mode when Firebase is not configured
- Profile persistence scaffolding

LinuxAid never stores user passwords itself.

### PWA / offline readiness

The project includes:

- `manifest.webmanifest`
- `service-worker.js`
- cached learning pages and tools
- offline fallback page
- install prompt support
- online/offline status indicator

Remote AI, Firebase writes and community sync still require a network connection.

## Product experience upgrades

The shared product shell adds:

- responsive mobile navigation
- animated first-session boot intro
- scroll reveal animations
- page transitions
- scroll progress bar
- keyboard-accessible focus states
- Ctrl/Cmd + K command palette
- dark/light theme continuity
- installable PWA prompt
- branded 404/offline experiences
- reduced-motion support

## Architecture

```text
Browser
├── Static LinuxAid UI
├── Terminal V2
├── Courses / Labs / Tools
├── Local progress + PWA cache
├── Firebase Auth / Firestore (optional)
└── Secure AI proxy (recommended)
        ├── Gemini
        └── OpenAI
```

Provider secret keys must stay on the server. The browser should only know the AI proxy URL.

## Project structure

```text
.
├── api/
│   └── ai.js
├── js/
│   ├── authPage.js
│   ├── commandCatalog.js
│   ├── communityPage.js
│   ├── learningData.js
│   ├── learningPages.js
│   ├── linuxTools.js
│   ├── navExtras.js
│   ├── pageBasics.js
│   ├── profilePage.js
│   ├── progress.js
│   ├── security.js
│   ├── siteEnhancements.js
│   ├── terminalEngine.js
│   └── toolsPage.js
├── tests/
├── app.js
├── config.js
├── firebase.js
├── firestore.rules
├── gemini.js
├── product.css
├── styles.css
├── manifest.webmanifest
├── service-worker.js
└── DEPLOYMENT.md
```

## Local development

LinuxAid currently stays deliberately lightweight.

Requirements:

- Node.js 22+
- a simple local static server

Install/check:

```bash
npm install
npm run check
npm test
```

Then serve the repository with any local web server rather than opening pages through `file://`, because modules, service workers and Firebase work best over HTTP.

## Firebase setup

Copy the Firebase Web App public configuration into the `firebase` section of `config.js` (or generate the file in your deployment process):

```js
window.LINUXAID_CONFIG = {
  firebase: {
    apiKey: 'PUBLIC_FIREBASE_WEB_API_KEY',
    authDomain: 'your-project.firebaseapp.com',
    projectId: 'your-project',
    storageBucket: 'your-project.appspot.com',
    messagingSenderId: '...',
    appId: '...'
  },
  ai: {
    proxyUrl: 'https://your-api-host.example/api/ai',
    provider: 'server',
    allowInsecureBrowserAI: false
  }
};
```

Enable Email/Password and Google providers in Firebase Authentication and deploy `firestore.rules` before public use.

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the complete checklist.

## AI configuration

LinuxAid uses a **proxy-first** AI architecture.

`api/ai.js` is a server-side proxy template that can call Gemini or OpenAI using server environment variables. Do not put provider API secrets inside `config.js`, HTML or browser JavaScript.

If no remote AI proxy is configured, the dashboard still provides a limited local Linux tutor fallback.

## Security principles

LinuxAid follows these rules:

1. Escape chat output before limited Markdown rendering.
2. Never expose AI provider secret keys in the browser.
3. Treat Firebase client config as public identifiers and enforce privacy through Firestore rules.
4. Block catastrophic terminal patterns in the simulator.
5. Prefer inspect → change → verify troubleshooting.
6. Do not present mock analytics as real production data.
7. Keep CI and CodeQL green before merging production changes.

## Testing and CI

GitHub Actions runs:

- JavaScript syntax checks
- Node unit tests
- terminal regression tests
- security rendering tests
- progress tests
- Linux tools tests
- CodeQL analysis

The main branch also triggers GitHub Pages deployment.

## Roadmap

High-value future work includes:

- server-synced course/lab progress
- richer lesson authoring
- community replies, voting and moderation
- email verification gating
- Firebase App Check
- real admin analytics with role protection
- ShellCheck integration
- screenshot/error analysis
- distro-specific lesson modes
- certificates with verification IDs
- accessibility audits and Lighthouse CI
- optional paid/hosted tiers without weakening the free learning experience

## License

Apache License 2.0. See `LICENSE`.

---

Built as a practical, safety-first Linux learning environment by **MartechMods2**.
