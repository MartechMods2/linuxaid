# LinuxAid AI setup

LinuxAid keeps AI provider secrets on the server. **Never paste an NVIDIA, OpenAI, Gemini or other secret API key into `config.js`, HTML, browser JavaScript, a public GitHub issue, or GitHub Pages.**

## Recommended provider: NVIDIA NIM

LinuxAid's server proxy now supports NVIDIA's OpenAI-compatible chat-completions API.

Recommended starting model:

```text
nvidia/nemotron-3.5-lightning-30b-a3b
```

Why it is a good default for LinuxAid: it is designed for fast text/agentic tasks and is available as an NVIDIA hosted endpoint. You can swap the model later without changing the website UI.

Other useful models in the NVIDIA catalog may be better for specialized coding or tool-use workloads. Always verify that a model still has a hosted/free endpoint before making it your default.

## Where to put the NVIDIA API key

The key goes in your **server/deployment environment variables**, not in the repository.

Use these variables:

```bash
AI_PROVIDER=nvidia
NVIDIA_API_KEY=YOUR_SECRET_KEY
NVIDIA_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1/chat/completions
AI_TIMEOUT_MS=18000
LINUXAID_ALLOWED_ORIGIN=https://martechmods2.github.io
```

The server handler that reads them is:

```text
api/ai.js
```

The browser should call only your deployed `/api/ai` endpoint.

## Vercel setup

1. Import the LinuxAid repository into Vercel.
2. Open **Project Settings → Environment Variables**.
3. Add the variables shown above.
4. Redeploy.
5. Set `window.LINUXAID_CONFIG.ai.proxyUrl` in `config.js` to your deployed API URL, for example:

```js
ai: {
  proxyUrl: 'https://YOUR-PROJECT.vercel.app/api/ai',
  provider: 'server',
  allowInsecureBrowserAI: false,
  requestTimeoutMs: 25000
}
```

Do not put `NVIDIA_API_KEY` in that browser object.

## Security already enforced by `api/ai.js`

- origin allow-list
- request body limit
- prompt/history size limits
- per-IP in-memory rate limiting
- hard upstream request timeout with `AbortController`
- no-store responses
- generic provider errors to avoid leaking internals
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- restrictive permissions policy
- no AI provider name returned to the browser

For production at larger scale, replace the in-memory rate limiter with a durable rate-limit service or edge firewall because serverless instances do not share one in-memory map.

## Support / Buy me a coffee

Paste your public Buy Me a Coffee, Ko-fi, or GitHub Sponsors URL into:

```js
product: {
  supportUrl: 'https://YOUR-SUPPORT-URL'
}
```

in `config.js`.

The profile and `support.html` pages will automatically use it.
