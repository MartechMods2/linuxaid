const SYSTEM_PROMPT = `You are LinuxAid, a beginner-friendly Linux tutor. Explain concepts step by step, prefer safe read-only inspection before system changes, clearly warn before privileged or destructive commands, distinguish distro-specific commands, and never pretend a simulated command changed a real machine.`;

const MAX_PROMPT = 6000;
const MAX_HISTORY = 10;
const MAX_BODY_BYTES = 50_000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 24;
const DEFAULT_TIMEOUT_MS = 18_000;
const rateBuckets = new Map();

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
}

function json(res, status, body, origin = 'null') {
  setSecurityHeaders(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.end(JSON.stringify(body));
}

function configuredOrigins() {
  return String(process.env.LINUXAID_ALLOWED_ORIGIN || 'https://martechmods2.github.io')
    .split(',').map(v => v.trim().replace(/\/$/, '')).filter(Boolean);
}

function allowedOrigin(req) {
  const origin = String(req.headers?.origin || '').replace(/\/$/, '');
  const allowed = configuredOrigins();
  if (!origin) return allowed[0] || 'null';
  return allowed.includes(origin) ? origin : null;
}

function clientKey(req) {
  return String(req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim().slice(0,120);
}

function withinRateLimit(req) {
  const now = Date.now();
  const key = clientKey(req);
  const current = rateBuckets.get(key);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(key, { startedAt:now, count:1 });
    return true;
  }
  current.count += 1;
  if (rateBuckets.size > 2000) {
    for (const [bucketKey, value] of rateBuckets) {
      if (now - value.startedAt >= RATE_WINDOW_MS) rateBuckets.delete(bucketKey);
    }
  }
  return current.count <= RATE_LIMIT;
}

function cleanHistory(history) {
  return (Array.isArray(history) ? history : [])
    .filter(item => item && ['user','assistant'].includes(item.role) && item.content)
    .slice(-MAX_HISTORY)
    .map(item => ({ role:item.role, content:String(item.content).replace(/\u0000/g,'').slice(0,4000) }));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) throw new Error('Request too large.');
  }
  return raw ? JSON.parse(raw) : {};
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const configured = Number(process.env.AI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const timeout = Math.min(30_000, Math.max(5_000, Number.isFinite(configured) ? configured : DEFAULT_TIMEOUT_MS));
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal:controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function askOpenAI(prompt, history) {
  if (!process.env.OPENAI_API_KEY) throw new Error('AI provider is not configured.');
  const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${process.env.OPENAI_API_KEY}` },
    body:JSON.stringify({ model:process.env.OPENAI_MODEL || 'gpt-4.1-mini', temperature:0.35, max_tokens:900, messages:[{ role:'system', content:SYSTEM_PROMPT }, ...history, { role:'user', content:prompt }] })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || `Provider request failed (${response.status}).`);
  return String(result?.choices?.[0]?.message?.content || '').trim();
}

async function askGemini(prompt, history) {
  if (!process.env.GEMINI_API_KEY) throw new Error('AI provider is not configured.');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const contents = [...history.map(item => ({ role:item.role === 'assistant' ? 'model' : 'user', parts:[{ text:item.content }] })), { role:'user', parts:[{ text:prompt }] }];
  const response = await fetchWithTimeout(endpoint, {
    method:'POST', headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ systemInstruction:{ parts:[{ text:SYSTEM_PROMPT }] }, contents, generationConfig:{ temperature:0.35, maxOutputTokens:900 } })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || `Provider request failed (${response.status}).`);
  return String(result?.candidates?.[0]?.content?.parts?.map(part => part?.text || '').join('') || '').trim();
}

async function askNvidia(prompt, history) {
  if (!process.env.NVIDIA_API_KEY) throw new Error('AI provider is not configured.');
  const endpoint = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1/chat/completions';
  const model = process.env.NVIDIA_MODEL || 'nvidia/nemotron-3.5-lightning-30b-a3b';
  const response = await fetchWithTimeout(endpoint, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${process.env.NVIDIA_API_KEY}` },
    body:JSON.stringify({ model, temperature:0.3, top_p:0.9, max_tokens:1000, stream:false, messages:[{ role:'system', content:SYSTEM_PROMPT }, ...history, { role:'user', content:prompt }] })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || result?.message || `Provider request failed (${response.status}).`);
  return String(result?.choices?.[0]?.message?.content || '').trim();
}

async function askProvider(provider, prompt, history) {
  if (provider === 'openai') return askOpenAI(prompt, history);
  if (provider === 'nvidia') return askNvidia(prompt, history);
  return askGemini(prompt, history);
}

export default async function handler(req, res) {
  const origin = allowedOrigin(req);
  if (!origin) return json(res, 403, { error:'Origin not allowed.' }, 'null');
  if (req.method === 'OPTIONS') return json(res, 204, {}, origin);
  if (req.method !== 'POST') return json(res, 405, { error:'Use POST.' }, origin);
  if (!withinRateLimit(req)) return json(res, 429, { error:'Too many requests. Try again shortly.' }, origin);

  try {
    const body = await readBody(req);
    const prompt = String(body?.prompt || '').replace(/\u0000/g,'').trim().slice(0,MAX_PROMPT);
    if (!prompt) return json(res, 400, { error:'Prompt is required.' }, origin);
    const history = cleanHistory(body?.history);
    const provider = String(process.env.AI_PROVIDER || 'nvidia').toLowerCase();
    const answer = await askProvider(provider, prompt, history);
    if (!answer) throw new Error('AI provider returned an empty response.');
    return json(res, 200, { answer }, origin);
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    console.error('LinuxAid AI proxy error:', timedOut ? 'provider timeout' : error?.message || error);
    return json(res, timedOut ? 504 : 502, { error:timedOut ? 'LinuxAid AI timed out. Please retry.' : 'LinuxAid AI is temporarily unavailable.' }, origin);
  }
}
