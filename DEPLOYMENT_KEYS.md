# LinuxAid production setup

LinuxAid keeps public browser identifiers separate from secret server credentials.

## 1. Supabase Auth URL configuration — required

Open Supabase Dashboard → LinuxAid → Authentication → URL Configuration.

Set **Site URL** to:

`https://martechmods2.github.io/linuxaid/`

Add these **Redirect URLs**:

- `https://martechmods2.github.io/linuxaid/auth.html`
- `https://martechmods2.github.io/linuxaid/auth.html?verified=1`
- `https://martechmods2.github.io/linuxaid/auth.html?mode=recovery`
- `https://martechmods2.github.io/linuxaid/dashboard.html`
- `http://localhost:3000/**` for local testing only

Without these, email confirmation, password recovery and OAuth redirects can appear broken.

## 2. Email/password auth — no extra provider needed

Supabase email auth can be used on the free plan. Keep email confirmation enabled for production. Users must verify their email before first password sign-in when confirmation is required.

## 3. Google sign-in — optional

LinuxAid currently leaves Google OAuth disabled until credentials are added.

Create a Google OAuth web client. Add this Supabase callback URI in Google:

`https://qkpamdanjnxniwdinodi.supabase.co/auth/v1/callback`

Then open Supabase → Authentication → Providers → Google and add the Google Client ID and Client Secret. After that change `auth.googleEnabled` to `true` in `config.js`.

Never put the Google client secret in `config.js`.

## 4. Cloudflare Turnstile — recommended free bot protection

You do **not** install Cloudflare on ChatGPT or on GitHub Pages. Turnstile is loaded in the browser from Cloudflare's hosted JavaScript.

Create a Turnstile widget in Cloudflare for:

`martechmods2.github.io`

Then:

1. Copy the **Site Key** into `config.js` → `security.turnstileSiteKey`.
2. Copy the **Secret Key** into Supabase Dashboard → Authentication → Bot and Abuse Protection → Enable CAPTCHA protection → Cloudflare Turnstile.
3. Save.

The secret key must never be committed to GitHub.

## 5. Remote LinuxAid AI — optional

The `linuxaid-ai` Supabase Edge Function is deployed, but it needs one server-side provider key.

Add **one** of these as a Supabase Edge Function secret:

- `GEMINI_API_KEY`
- `OPENAI_API_KEY`

Optional server settings:

- `AI_PROVIDER=gemini` or `openai`
- `LINUXAID_AI_DAILY_LIMIT=40`
- `LINUXAID_ALLOWED_ORIGINS=https://martechmods2.github.io`

Keep the AI daily limit modest on free tiers. LinuxAid falls back to local tools when remote AI is unavailable.

## 6. PostHog analytics

The public PostHog project key is already configured. Analytics starts only after the visitor explicitly allows analytics in the cookie/privacy banner. Session replay is disabled.

## 7. Public keys that may live in `config.js`

Allowed in the browser:

- Supabase project URL
- Supabase publishable key
- PostHog project key
- Cloudflare Turnstile **site key**

Never commit:

- Supabase service-role / secret key
- Gemini/OpenAI API keys
- Cloudflare Turnstile secret
- Google OAuth client secret
- SMTP passwords

## 8. Free-resource controls already used

- Supabase RLS limits user data access.
- AI has a per-user daily quota.
- Chat history is capped.
- PostHog requires consent.
- Session replay is off.
- No background AI polling.
- No automatic realtime subscription is opened unless a feature needs it.
- Browser auth includes a local attempt cooldown.
- Remote requests use bounded input sizes and timeouts where applicable.
