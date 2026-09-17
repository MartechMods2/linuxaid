# LinuxAid launch status

This file separates **implemented**, **working with normal configuration**, and **waiting for external credentials/settings** so the live site does not over-promise.

## Implemented and working without additional paid services

- Static GitHub Pages frontend
- Dark/light theme
- Responsive navigation
- Mobile viewport containment
- Kinetic particle hero animation
- Floating Terminal V2 (`Alt + T` on desktop, bottom sheet on phones)
- Stateful safe virtual filesystem
- Command history and autocomplete
- `man` help and Linux command simulation
- Command Explorer
- Command Safety Engine
- Linux permission decoder
- Distro package-command converter
- Linux error interpreter
- Hands-on labs
- Local XP/streak/rank tracking
- Rankings page
- Cookie/privacy consent
- PostHog opt-in gate
- PWA install shell and offline fallback
- Legal/privacy/security pages
- Founder/CEO branding for Martech

## Supabase backend implemented

- Supabase project and PostgreSQL schema
- Row Level Security policies
- Profiles
- Synced learner state
- Chat-history sync
- Community posts
- Community replies
- Community votes
- Notifications
- Avatar storage
- AI daily-usage quota table/function
- Authenticated `linuxaid-ai` Edge Function

## Authentication

### Implemented in code

- Email/password sign in
- Email/password account creation
- Email confirmation handling
- Password-reset request
- Password update after recovery
- Persistent browser session
- Friendly auth errors
- Demo/local mode
- Cloudflare Turnstile frontend slot
- Optional Google OAuth button

### Required Supabase dashboard configuration before calling auth launch-ready

- Production **Site URL** must be `https://martechmods2.github.io/linuxaid/`
- LinuxAid auth/dashboard redirect URLs must be added to the Supabase allow-list
- Email/password provider must remain enabled

### Optional credentials still required

- **Cloudflare Turnstile** Site Key + Secret Key to enforce CAPTCHA
- **Google OAuth** Client ID + Client Secret before enabling Google login
- Custom SMTP provider if production auth email volume/reliability needs exceed Supabase built-in mail

## AI

The secure Edge Function is deployed, but the remote model needs one server-side provider secret:

- `GEMINI_API_KEY`, or
- `OPENAI_API_KEY`

The key must be configured as a Supabase Edge Function secret, never in GitHub/browser code.

## Current upgrade log

### Mobile/auth hardening v5

- Added `mobile-v5.css` with `100dvw`/`100dvh`, safe-area support and global overflow containment.
- Converted mobile navigation to a compact drawer.
- Made auth a single-column phone layout.
- Changed phone terminal to a full-width bottom sheet.
- Made cookie consent fit small screens.
- Made cards/grids/forms/code/tables viewport-safe.
- Added horizontal suggestion scrolling instead of page overflow.
- Added a fresh static-site Supabase auth runtime (`js/authV5.js`).
- Hid Google OAuth until provider credentials are configured.
- Added Turnstile-ready auth challenge support.
- Added `API_SETUP.md` with exact public/secret key locations.
- Replaced stale service-worker caching with version `linuxaid-v7` and network-first JS/CSS/HTML updates.
- Added `rankings.html` and redirected the old Courses URL there.
- Removed course/certificate promises from the landing page.
- Rebuilt homepage branding around the uploaded LinuxAid logo, Martech founder bio, practice, terminal, tools and ranks.
- Updated global navigation/command palette to use Rankings instead of Courses.
- Expanded automated launch tests for auth, secrets, mobile overflow and stale-cache protection.
