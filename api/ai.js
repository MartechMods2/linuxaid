const SYSTEM_PROMPT = `You are LinuxAid, a beginner-friendly Linux tutor. Explain concepts step by step, prefer safe read-only inspection before system changes, clearly warn before privileged or destructive commands, distinguish distro-specific commands, and never pretend a simulated command changed a real machine.`;

const MAX_PROMPT = 6000;
const MAX_HISTORY = 10;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30;
const rateBuckets = new Map();

function json(res, status, body, origin = '*') {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.end(JSON.stringify(body));
}

function allowedOrigin(req) {
  const configured = process.env.LINUXAID_ALLOWED_ORIGIN || 'https://martechmods2.github.io';
  const origin = String(req.headers?.origin || '');
  if (!origin) return configured;
  return origin === configured || origin.startsWith(`${configured}/`) ? origin : null;
}

function clientKey(req) {
  return String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
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
    .map(item => ({ role:item.role, content:String(item.content).slice(0,4000) }));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 50_000) throw new Error('Request too large.');
  }
  return raw ? JSON.parse(raw) : {};
}

async function askOpenAI(prompt, history) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI is not configured on the server.');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${process.env.OPENAI_API_KEY}` },
    body:JSON.stringify({
      model:process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      temperature:0.35,
      max_tokens:700,
      messages:[{ role:'system', content:SYSTEM_PROMPT }, ...history, { role:'user', content:prompt }]
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || `OpenAI request failed (${response.status}).`);
  return String(result?.choices?.[0]?.message?.content || '').trim();
}

async function askGemini(prompt, history) {
  if (!process.env.GEMINI_API_KEY) throw new Error('Gemini is not configured on the server.');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const contents = [
    ...history.map(item => ({ role:item.role === 'assistant' ? 'model' : 'user', parts:[{ text:item.content }] })),
    { role:'user', parts:[{ text:prompt }] }
  ];
  const response = await fetch(endpoint, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({
      systemInstruction:{ parts:[{ text:SYSTEM_PROMPT }] },
      contents,
      generationConfig:{ temperature:0.35, maxOutputTokens:700 }
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || `Gemini request failed (${response.status}).`);
  return String(result?.candidates?.[0]?.content?.parts?.map(part => part?.text || '').join('') || '').trim();
}

export default async function handler(req, res) {
  const origin = allowedOrigin(req);
  if (!origin) return json(res, 403, { error:'Origin not allowed.' }, 'null');
  if (req.method === 'OPTIONS') return json(res, 204, {}, origin);
  if (req.method !== 'POST') return json(res, 405, { error:'Use POST.' }, origin);
  if (!withinRateLimit(req)) return json(res, 429, { error:'Too many AI requests. Try again shortly.' }, origin);

  try {
    const body = await readBody(req);
    const prompt = String(body?.prompt || '').trim().slice(0,MAX_PROMPT);
    if (!prompt) return json(res, 400, { error:'Prompt is required.' }, origin);
    const history = cleanHistory(body?.history);
    const provider = String(process.env.AI_PROVIDER || 'gemini').toLowerCase();
    const answer = provider === 'openai' ? await askOpenAI(prompt, history) : await askGemini(prompt, history);
    if (!answer) throw new Error('AI provider returned an empty response.');
    return json(res, 200, { answer, provider }, origin);
  } catch (error) {
    console.error('LinuxAid AI proxy error:', error);
    return json(res, 502, { error:'LinuxAid AI is temporarily unavailable.' }, origin);
  }
}
