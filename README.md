# LinuxAid

**LinuxAid** is a practical Linux learning and community platform: safe terminal practice, troubleshooting playbooks, AI-assisted guidance, installation guides, social posts, profiles, direct messages, labs, tools and synced learner progress.

🌐 **Live website:** https://martechmods2.github.io/linuxaid/

📦 **Repository:** https://github.com/MartechMods2/linuxaid

## Platform V8

The current architecture is no longer a demo-only frontend. LinuxAid now uses a live Supabase backend for authentication, social data, messages, notifications, progress and server-side AI requests.

### Learn and practice

- Stateful browser terminal for the core Linux command set.
- **1,200+ real Linux/Unix/developer commands** indexed in Terminal V8 reference mode.
- Safe debugging playbooks: `debug network`, `debug disk`, `debug service`, `debug permissions`, `debug process`, `debug boot`.
- Searchable `commands.html` command library.
- Linux fundamentals, labs, deterministic troubleshooting tools and progress tracking.
- `install.html` guide for PC installs, WSL, VMs, Android/Termux, Mac, ChromeOS, ARM boards and mobile limitations.

Terminal V8 does not pretend that a browser changed a real computer. Core commands run against the simulated filesystem; broader or high-impact commands are recognized and explained in reference mode.

### Live community

- Public community posts and replies.
- Post types, distro context, tags and optional command/code snippets.
- Reactions and saved posts.
- Follow graph and People discovery.
- Rich public profiles with experience level, skills, shell/editor preference, availability and collaboration interests.
- Direct conversations with live message updates, edit/delete support and unread state.
- Realtime notifications.
- Reports, block-aware database policies and database-enforced social rate limits.

### AI

The browser calls the authenticated `linuxaid-ai` Supabase Edge Function. Provider secrets never belong in frontend JavaScript.

Supported server-side providers:

- NVIDIA NIM / API Catalog — recommended hosted option.
- Gemini.
- OpenAI.

The default NVIDIA model configured by the function is `nvidia/nemotron-3.5-lightning-30b-a3b`, and the model remains configurable through Edge Function secrets.

See **[AI_SETUP.md](AI_SETUP.md)** for the exact place to add your NVIDIA API key.

### Security

LinuxAid currently uses:

- Supabase Auth with PKCE.
- RLS on exposed user/social data.
- private helper functions for authorization logic.
- database validation on posts, replies, messages and profiles.
- database-enforced post/reply/message rate limits.
- conversation-membership and block checks for messages.
- signed-in verification and daily quotas for remote AI.
- AI origin allowlist, input limits and upstream request timeouts.
- pinned Supabase browser/Edge Function SDK version.
- 45-minute frontend inactivity lock and 12-hour local session ceiling.
- catastrophic-command detection in the terminal simulator.
- escaped user-generated content before HTML rendering.

**Owner action still recommended:** enable Supabase Auth leaked-password protection in the dashboard.

## Main pages

| Page | Purpose |
| --- | --- |
| `index.html` | Landing page |
| `dashboard.html` | LinuxAid workspace and AI tutor |
| `labs.html` | Hands-on troubleshooting scenarios |
| `tools.html` | Deterministic Linux analysis tools |
| `commands.html` | Search 1,200+ command names |
| `install.html` | PC/mobile Linux installation centre |
| `community.html` | Live social feed |
| `people.html` | Discover/follow/message members |
| `messages.html` | Direct messages |
| `rankings.html` | Learner rankings |
| `profile.html` | Learning + public social profile |
| `support.html` | Configurable Buy Me a Coffee / support page |
| `privacy.html` | Privacy information |
| `security.html` | Security posture |
| `acceptable-use.html` | Community/platform acceptable use |
| `terms.html` | Terms |

## Architecture

```text
Browser / GitHub Pages
├── Platform V8 responsive shell
├── Terminal V8 + 1,200+ command catalog
├── Labs / tools / install guides
├── Supabase Auth
├── Supabase Data API + RLS
├── Supabase Realtime (posts / replies / messages / notifications)
└── Authenticated Supabase Edge Function
    ├── NVIDIA NIM
    ├── Gemini
    └── OpenAI
```

## Backend

Connected Supabase project ref:

```text
qkpamdanjnxniwdinodi
```

`config.js` contains only the public project URL and publishable key. Never add service-role/secret keys or AI provider keys to that file.

The production database currently has live v6/v7 migrations that predate Platform V8 and are ahead of the historical migration files committed in GitHub. Treat migration parity as release work before using this repository to bootstrap a second Supabase project from scratch.

## Local development

Requirements:

- Node.js 22+
- a local HTTP server

```bash
npm install
npm run check
npm test
```

Serve the repository over HTTP rather than opening files with `file://` so ES modules, service workers and auth callbacks behave normally.

## NVIDIA setup

1. Create a key for a hosted model in NVIDIA's API Catalog.
2. Open the LinuxAid Supabase project.
3. Go to **Edge Functions → Secrets**.
4. Add `NVIDIA_API_KEY` plus the variables documented in [AI_SETUP.md](AI_SETUP.md).
5. Keep `AI_PROVIDER=nvidia` to select NVIDIA explicitly.

No NVIDIA secret is required in `config.js`.

## Support link setup

`support.html` is ready, but the payment destination is intentionally not guessed. Add your real public support URL here:

```js
// config.js
product: {
  supportUrl: 'https://www.buymeacoffee.com/YOUR_HANDLE'
}
```

A Ko-fi or other legitimate public support URL can be used instead.

## Testing / CI

CI runs JavaScript/module checks and Node tests. Platform V8 adds regression coverage for:

- 1,200+ terminal command indexing.
- phone breakpoints, safe-area handling and 44px touch targets.
- NVIDIA proxy support without a hard-coded key.
- frontend session timeouts.
- richer social/profile fields.
- installation, command and support entry points.

CodeQL remains enabled in GitHub Actions.

## Release checklist

Before merging a production release:

1. `npm run check`
2. `npm test`
3. review GitHub Actions + CodeQL
4. inspect Supabase Security Advisor
5. inspect Supabase Performance Advisor
6. test account/auth flows on desktop and phone
7. test community create/reply/react/save/follow/message/realtime flows
8. verify NVIDIA/Gemini/OpenAI Edge Function secrets without exposing values
9. verify PWA/service-worker navigation for newly added pages
10. confirm the configured support URL belongs to the project owner

## License

Apache License 2.0. See `LICENSE`.

---

Built as a practical, safety-first Linux learning environment by **MartechMods2**.
