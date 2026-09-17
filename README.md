# LinuxAid

**LinuxAid** is a safety-first Linux practice and troubleshooting workspace created by **Martech, Founder & CEO of LinuxAid**.

🌐 **Live website:** https://martechmods2.github.io/linuxaid/

📦 **Repository:** https://github.com/MartechMods2/linuxaid

LinuxAid is deliberately focused on **practical Linux skill-building**, not certificate promises. Users learn by inspecting commands, practising inside a safe browser terminal, solving troubleshooting scenarios, using Linux utilities and building XP/rank through useful activity.

## What works today

- **Floating Terminal V2** — stateful virtual filesystem, history, autocomplete, manuals and blocked destructive patterns.
- **Command Explorer** — Linux commands with syntax, explanations and risk levels.
- **Command Safety Engine** — safe / medium / high / extreme classification.
- **Linux Tools** — permission decoder, package-command converter, command analyzer and error interpreter.
- **Hands-on Labs** — practical troubleshooting scenarios.
- **XP & Rankings** — progression from Kernel Seed toward Linux Legend.
- **Supabase Auth** — email/password account flow, email confirmation and password recovery scaffolding.
- **Synced learner state** — profile, progress and chat history can sync through Supabase after sign-in.
- **Community backend** — Supabase-backed posts, replies and votes.
- **Avatar storage** — Supabase Storage integration.
- **Notifications** — authenticated notification storage.
- **LinuxAid AI Edge Function** — authenticated, quota-protected server-side AI endpoint. A Gemini/OpenAI server secret is still required to activate the remote model.
- **Cookie/privacy consent** — essential storage by default; PostHog analytics only after opt-in.
- **PWA/offline shell** — installable site, offline fallback and cache management.
- **Responsive/mobile UI** — viewport-safe navigation, cards, auth and a phone bottom-sheet terminal.
- **Kinetic hero animation** — interactive particle constellation inspired by the project’s visual reference.

## Main pages

| Page | Purpose |
| --- | --- |
| `index.html` | Landing page, product overview and founder information |
| `dashboard.html` | LinuxAid AI, command explorer, rank summary and workspace |
| `linux.html` | Linux fundamentals reference |
| `labs.html` | Hands-on Linux scenarios |
| `tools.html` | Linux troubleshooting and command utilities |
| `rankings.html` | XP rank ladder and progression |
| `community.html` | Supabase-backed discussions |
| `profile.html` | Progress, preferences and profile data |
| `auth.html` | Supabase sign in, sign up and password recovery |
| `privacy.html` / `terms.html` / `cookies.html` / `security.html` | Trust and legal information |
| `offline.html` | PWA offline fallback |

`courses.html` remains only as a no-index compatibility redirect to Rankings. LinuxAid currently makes **no certification promise**.

## Backend

LinuxAid uses a free-tier-first stack:

```text
GitHub Pages
   │
   ├── Static LinuxAid UI + PWA
   │
   ├── Supabase
   │   ├── Authentication
   │   ├── PostgreSQL + RLS
   │   ├── Storage
   │   └── Edge Functions
   │
   └── PostHog (optional, consent-based analytics)
```

Current Supabase project configuration is represented in `config.js` with **public browser-safe values only**. Secrets remain server-side.

## Authentication and bot protection

LinuxAid uses Supabase Auth.

The frontend supports:

- Email/password sign in
- Account creation
- Email confirmation
- Password reset
- Optional Google OAuth
- Optional Cloudflare Turnstile CAPTCHA
- Browser-only demo mode

Before launch, configure Supabase **Site URL + Redirect URLs** for the GitHub Pages domain. Google login stays hidden until its provider credentials are configured.

For exact credential placement and Turnstile setup, read **[API_SETUP.md](API_SETUP.md)**.

## Terminal V2

The safe simulator supports realistic learning workflows including:

- `pwd`, `ls`, `cd`, `mkdir`, `touch`, `cat`
- `cp`, `mv`, `rm`
- `head`, `tail`, `grep`, `find`
- `chmod`, `stat`, `du`, `df`, `free`, `ps`
- `ping`, `ip`, `ss`
- package-manager simulations
- `systemctl`, `journalctl`
- `man`, `history`, autocomplete and command history
- safe output redirection

Destructive patterns are blocked rather than executed.

The terminal is available as a **floating launcher** across LinuxAid. Press **Alt + T** on desktop; phones receive a full-width bottom-sheet terminal.

## AI architecture

Remote LinuxAid AI uses the deployed authenticated Supabase Edge Function `linuxaid-ai`.

The Edge Function provides:

- authenticated access only
- per-user daily quotas
- server-side provider keys
- origin restrictions
- bounded prompt/history sizes
- no browser exposure of Gemini/OpenAI credentials

To enable the remote model, configure either `GEMINI_API_KEY` or `OPENAI_API_KEY` as a Supabase Edge Function secret. See `API_SETUP.md`.

## Privacy and analytics

- Essential storage is enabled for normal product operation.
- PostHog analytics does not start until the visitor chooses **Allow analytics**.
- Session replay is disabled.
- LinuxAid does not sell personal data.
- Auth passwords are handled by Supabase Auth, not LinuxAid JavaScript or the LinuxAid database schema.

## Local development

Requirements:

- Node.js 22+
- a local HTTP server

```bash
npm install
npm run check
npm test
```

Serve the folder over HTTP/HTTPS rather than opening pages through `file://`, because modules, PWA workers and authentication require web origins.

## Production checklist

1. Set the Supabase Site URL and redirect allow-list to the LinuxAid GitHub Pages URLs.
2. Confirm email/password authentication is enabled.
3. Add Turnstile Site Key to `config.js` and Secret Key to Supabase Auth Bot Protection when ready.
4. Configure optional Google OAuth in Supabase before setting `googleEnabled: true`.
5. Add an AI provider key to the `linuxaid-ai` Edge Function if remote AI is required.
6. Run `npm run check` and `npm test`.
7. Require CI + CodeQL before merging.
8. Test at phone widths and confirm the PWA service worker has updated.

See **[DEPLOYMENT.md](DEPLOYMENT.md)** and **[API_SETUP.md](API_SETUP.md)**.

## Security principles

1. Never expose service-role, AI, SMTP, OAuth client-secret or Turnstile secret keys in browser files.
2. Keep Row Level Security enabled for user data.
3. Sanitize AI/community output before rendering HTML.
4. Keep destructive command simulation blocked.
5. Rate-limit and CAPTCHA public authentication paths.
6. Keep analytics opt-in.
7. Maintain a responsible vulnerability disclosure path in `security.html` / `.well-known/security.txt`.

## License

See [LICENSE](LICENSE).
