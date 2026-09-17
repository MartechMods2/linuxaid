# LinuxAid API & authentication setup

LinuxAid separates **public browser identifiers** from **server secrets**. Never paste a private key into `config.js`.

## 1. Supabase — already connected

Project URL and the publishable browser key are already configured in `config.js`.

Before public launch, open **Supabase → Authentication → URL Configuration** and set:

- **Site URL:** `https://martechmods2.github.io/linuxaid/`
- **Additional Redirect URLs:**
  - `https://martechmods2.github.io/linuxaid/auth.html`
  - `https://martechmods2.github.io/linuxaid/auth.html?verified=1`
  - `https://martechmods2.github.io/linuxaid/auth.html?mode=recovery`
  - `https://martechmods2.github.io/linuxaid/dashboard.html`

This is required for reliable confirmation, recovery and OAuth redirects on GitHub Pages.

## 2. Cloudflare Turnstile — recommended free bot protection

LinuxAid uses the CAPTCHA provider Supabase supports natively: **Cloudflare Turnstile**. No Cloudflare ChatGPT plugin or Cloudflare Tunnel installation is required.

Create a Turnstile widget in the Cloudflare dashboard for these hostnames:

- `martechmods2.github.io`
- `localhost` (optional for local testing)

You will receive two values:

### Public Site Key

Put the **Site Key** in `config.js`:

```js
auth: {
  captcha: {
    provider: 'turnstile',
    siteKey: 'PASTE_PUBLIC_SITE_KEY_HERE'
  }
}
```

The Site Key is safe to expose in browser code.

### Secret Key

**Never commit the Turnstile Secret Key.**

Open **Supabase → Authentication → Bot and Abuse Protection**, enable CAPTCHA, choose **Turnstile**, and paste the secret key there.

After both values are configured, LinuxAid's sign-up/sign-in/reset screen will require the bot challenge and Supabase will verify the token server-side.

## 3. Google login — optional

Google OAuth is intentionally hidden until credentials exist.

In Google Cloud Console create a Web OAuth client. Add the Supabase callback URL shown in **Supabase → Authentication → Providers → Google**. Then paste the Google Client ID and Client Secret into the Supabase Google provider settings.

After that, change this public flag in `config.js`:

```js
auth: {
  googleEnabled: true
}
```

Do not place the Google Client Secret in GitHub.

## 4. Remote LinuxAid AI

The `linuxaid-ai` Supabase Edge Function is already deployed and requires an authenticated user. It also applies a daily quota.

To enable remote AI, add **one** provider secret to the Supabase Edge Function environment:

- `GEMINI_API_KEY` and optionally `GEMINI_MODEL`, or
- `OPENAI_API_KEY` and optionally `OPENAI_MODEL`

Optional server variables:

- `AI_PROVIDER=gemini` or `AI_PROVIDER=openai`
- `LINUXAID_AI_DAILY_LIMIT=40`
- `LINUXAID_ALLOWED_ORIGINS=https://martechmods2.github.io`

Never place an AI provider secret in `config.js`.

## 5. PostHog analytics — already connected

The public PostHog project key is configured in `config.js`. Analytics is loaded **only after the visitor explicitly allows analytics cookies/storage**. Session replay is disabled.

## 6. Email delivery

Supabase's built-in email service is suitable for initial testing but has free-plan rate limits. Before a larger launch, connect a free/low-volume SMTP provider from **Supabase → Authentication → SMTP Settings** if you need higher reliability or branded mail.

## Secret placement rule

| Value | Where it belongs |
|---|---|
| Supabase publishable key | `config.js` |
| Turnstile Site Key | `config.js` |
| PostHog project key | `config.js` |
| Supabase service-role key | Supabase/server only — never GitHub |
| Turnstile Secret Key | Supabase Auth Bot Protection |
| Google Client Secret | Supabase Auth Google provider |
| Gemini/OpenAI key | Supabase Edge Function secret |
| SMTP password/API key | Supabase SMTP settings |

If a credential grants administrative access, billing access, unrestricted database access or paid API usage, it does **not** belong in the public repository.
