# LinuxAid AI setup

LinuxAid's browser must **never** contain an NVIDIA, OpenAI, Gemini, Supabase secret/service-role key. The browser calls the authenticated `linuxaid-ai` Supabase Edge Function; provider credentials live only in Edge Function Secrets.

## Recommended NVIDIA option

LinuxAid V8 supports NVIDIA's OpenAI-compatible hosted NIM API.

- Base URL: `https://integrate.api.nvidia.com/v1`
- Default LinuxAid model: `nvidia/nemotron-3.5-lightning-30b-a3b`
- Provider selector: `AI_PROVIDER=nvidia`

The model remains configurable through `NVIDIA_MODEL`, so changing models does not require changing frontend code.

## Where to put your NVIDIA API key

### Supabase Dashboard

1. Open the LinuxAid Supabase project.
2. Open **Edge Functions**.
3. Open **Secrets / Secrets Management**.
4. Add these keys:

```text
AI_PROVIDER=nvidia
NVIDIA_API_KEY=nvapi-YOUR_KEY_HERE
NVIDIA_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
LINUXAID_AI_DAILY_LIMIT=40
AI_UPSTREAM_TIMEOUT_MS=22000
LINUXAID_ALLOWED_ORIGINS=https://martechmods2.github.io
```

Supabase makes changed secrets available to hosted functions without requiring another code deployment.

### Supabase CLI alternative

```bash
supabase secrets set \
  AI_PROVIDER=nvidia \
  NVIDIA_API_KEY='nvapi-YOUR_KEY_HERE' \
  NVIDIA_MODEL='nvidia/nemotron-3.5-lightning-30b-a3b' \
  NVIDIA_BASE_URL='https://integrate.api.nvidia.com/v1' \
  LINUXAID_AI_DAILY_LIMIT=40 \
  AI_UPSTREAM_TIMEOUT_MS=22000 \
  LINUXAID_ALLOWED_ORIGINS='https://martechmods2.github.io' \
  --project-ref qkpamdanjnxniwdinodi
```

Then verify names only (not secret values):

```bash
supabase secrets list --project-ref qkpamdanjnxniwdinodi
```

## Why the API key does not go in `config.js`

`config.js` is downloaded by every visitor. Anything placed there is public. `NVIDIA_API_KEY` belongs in Supabase Edge Function Secrets only.

## Other supported providers

The same Edge Function can use Gemini or OpenAI as fallbacks:

```text
AI_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
```

or

```text
AI_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-mini
```

If `AI_PROVIDER` is omitted, the function selects the first configured key in this order: NVIDIA, Gemini, OpenAI.

## Protections already in the function

- Supabase JWT verification and a second user check before provider calls.
- Browser-origin allowlist.
- Maximum request body and prompt/history lengths.
- Daily per-user quota through `consume_linuxaid_ai_quota`.
- 22-second upstream timeout by default.
- `Cache-Control: no-store`.
- Provider errors are returned without exposing credentials.

## Test after adding the key

Sign in to LinuxAid and use an AI tutor action. If the key is missing, the function returns a server-side configuration error rather than exposing a key prompt in the browser. Check Edge Function logs for provider errors; never log the full API key.
