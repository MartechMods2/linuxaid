# LinuxAid

Copyright © 2026 Martech. All rights reserved.

LinuxAid is a safety-first Linux learning workspace for people who want to
understand Linux by actually using it. It combines a browser terminal,
command reference, troubleshooting tools, hands-on labs, AI guidance,
profiles, rankings, community discussions and private conversations.

## Product areas

- **Dashboard** — LinuxAid AI, command exploration, progress and quick actions.
- **Terminal** — safe stateful command simulation with command history,
  autocomplete, manuals, debugging helpers and destructive-command blocking.
- **Labs** — practical scenarios for permissions, files, services, logs,
  storage and networking.
- **Tools** — command-risk analysis, permission decoding, distro translation
  and error interpretation.
- **Community** — posts, replies, reactions, saves, follows and notifications.
- **Messages** — private member conversations.
- **Profiles & rankings** — learner identity, XP, achievements, preferences,
  appearance and discoverability.
- **PWA** — installable experience with cached learning tools and offline
  fallback.

## Security principles

LinuxAid keeps provider secrets on protected server-side infrastructure,
uses authenticated server functions for AI, applies protected member-data
access controls, limits request sizes and AI usage, blocks dangerous terminal
patterns, escapes rendered user content and runs automated CI/security checks.

## Development

Requirements:

- Node.js 22+
- a local HTTP server

Checks:

```bash
npm install
npm run check
npm test
```

## License and ownership

The current LinuxAid source is proprietary. See `LICENSE` and `NOTICE.md`.

Source visibility on a hosting service does **not** grant permission to copy,
redistribute, mirror, rebrand, sell, or create a competing derivative from
current LinuxAid code or original content.

Historical versions that were distributed under Apache License 2.0 remain
subject to the license that applied to those historical versions.

---

Built by **Martech**.
