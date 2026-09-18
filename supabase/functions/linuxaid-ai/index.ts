import { createClient } from 'npm:@supabase/supabase-js@2';

const SYSTEM_PROMPT = `You are LinuxAid, a beginner-friendly Linux tutor. Explain Linux concepts step by step. Prefer safe read-only inspection before system changes. Clearly warn before privileged or destructive commands. Distinguish distro-specific commands. Never pretend a browser simulator changed a real machine. Keep answers practical, accurate and concise.`;
const DEFAULT_TIMEOUT_MS = 18_000;

const allowedOrigins = new Set(
  (Deno.env.get('LINUXAID_ALLOWED_ORIGINS') || 'https://martechmods2.github.io,http://localhost:3000,http://127.0.0.1:3000')
    .split(',').map(value => value.trim()).filter(Boolean)
);

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') || '';
  const allowed = allowedOrigins.has(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://martechmods2.github.io',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  };
}

function json(request: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers:corsHeaders(request) });
}

class ProviderError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.status = status;
  }
}

function nvidiaKey() {
  return Deno.env.get('NVIDIA_API_KEY')
    || Deno.env.get('NVIDIA_NIM_API_KEY')
    || Deno.env.get('NIM_API_KEY')
    || Deno.env.get('NVIDIA_API')
    || '';
}

function normalizeHistory(value: unknown) {
  return (Array.isArray(value) ? value : [])
    .filter((item: any) => item && ['user','assistant'].includes(item.role) && item.content)
    .slice(-10)
    .map((item: any) => ({ role:item.role, content:String(item.content).replace(/\u0000/g,'').slice(0,4000) }));
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const configured = Number(Deno.env.get('AI_TIMEOUT_MS') || DEFAULT_TIMEOUT_MS);
  const timeout = Math.min(30_000, Math.max(5_000, Number.isFinite(configured) ? configured : DEFAULT_TIMEOUT_MS));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try { return await fetch(url, { ...init, signal:controller.signal }); }
  finally { clearTimeout(timer); }
}

async function askGemini(prompt: string, history: any[]) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('AI provider is not configured.');
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
  const contents = [
    ...history.map(item => ({ role:item.role === 'assistant' ? 'model' : 'user', parts:[{ text:item.content }] })),
    { role:'user', parts:[{ text:prompt }] }
  ];
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ systemInstruction:{ parts:[{ text:SYSTEM_PROMPT }] }, contents, generationConfig:{ temperature:.35, maxOutputTokens:900 } })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || `Provider request failed (${response.status}).`);
  const answer = String(result?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('') || '').trim();
  if (!answer) throw new Error('AI provider returned an empty answer.');
  return answer;
}

async function askOpenAI(prompt: string, history: any[]) {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('AI provider is not configured.');
  const model = Deno.env.get('OPENAI_MODEL') || 'gpt-5-mini';
  const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${apiKey}` },
    body:JSON.stringify({ model, messages:[{ role:'system', content:SYSTEM_PROMPT }, ...history, { role:'user', content:prompt }], temperature:.35, max_completion_tokens:900 })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || `Provider request failed (${response.status}).`);
  const answer = String(result?.choices?.[0]?.message?.content || '').trim();
  if (!answer) throw new Error('AI provider returned an empty answer.');
  return answer;
}

async function askNvidiaModel(apiKey: string, endpoint: string, model: string, prompt: string, history: any[]) {
  const body: Record<string, unknown> = {
    model,
    messages:[{ role:'system', content:SYSTEM_PROMPT }, ...history, { role:'user', content:prompt }],
    temperature:.4,
    max_tokens:1200,
    stream:false
  };
  if (model.includes('nemotron-3.5-lightning')) {
    body.chat_template_kwargs = { enable_thinking:false };
    body.reasoning_budget = 0;
  }

  const response = await fetchWithTimeout(endpoint, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Accept':'application/json', Authorization:`Bearer ${apiKey}` },
    body:JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));

  if (response.status === 401 || response.status === 403) {
    throw new ProviderError('AI_PROVIDER_AUTH', 503, 'The server-side AI key was rejected.');
  }
  if (response.status === 429) {
    throw new ProviderError('AI_PROVIDER_RATE_LIMIT', 429, 'The AI provider rate limit was reached.');
  }
  if (response.status === 202) {
    throw new ProviderError('AI_PROVIDER_BUSY', 503, 'The AI provider is still processing the request.');
  }
  if (!response.ok) {
    const detail = String(result?.error?.message || result?.message || '').slice(0,300);
    throw new ProviderError('AI_PROVIDER_REQUEST', response.status >= 500 ? 503 : 502, detail || `Provider request failed (${response.status}).`);
  }

  const message = result?.choices?.[0]?.message || {};
  const answer = String(message?.content || '').trim();
  if (!answer) throw new ProviderError('AI_EMPTY_RESPONSE', 502, 'The AI provider returned an empty answer.');
  return answer;
}

async function askNvidia(prompt: string, history: any[]) {
  const apiKey = nvidiaKey();
  if (!apiKey) throw new ProviderError('AI_NOT_CONFIGURED', 503, 'AI provider is not configured.');
  const endpoint = Deno.env.get('NVIDIA_BASE_URL') || 'https://integrate.api.nvidia.com/v1/chat/completions';
  const configuredModel = Deno.env.get('NVIDIA_MODEL') || 'nvidia/nemotron-3.5-lightning-30b-a3b';
  const models = [...new Set([
    configuredModel,
    'nvidia/nemotron-3.5-lightning-30b-a3b',
    'openai/gpt-oss-20b',
    'meta/llama-3.2-3b-instruct'
  ])];

  let lastError: unknown = null;
  for (const model of models) {
    try {
      return await askNvidiaModel(apiKey, endpoint, model, prompt, history);
    } catch (error) {
      lastError = error;
      if (error instanceof ProviderError && ['AI_PROVIDER_AUTH','AI_PROVIDER_RATE_LIMIT'].includes(error.code)) throw error;
    }
  }
  throw lastError || new ProviderError('AI_PROVIDER_REQUEST', 503, 'AI provider request failed.');
}

function selectedProvider() {
  const configured = String(Deno.env.get('AI_PROVIDER') || '').toLowerCase();
  if (configured === 'nvidia' && nvidiaKey()) return 'nvidia';
  if (configured === 'gemini' && Deno.env.get('GEMINI_API_KEY')) return 'gemini';
  if (configured === 'openai' && Deno.env.get('OPENAI_API_KEY')) return 'openai';
  if (nvidiaKey()) return 'nvidia';
  if (Deno.env.get('GEMINI_API_KEY')) return 'gemini';
  if (Deno.env.get('OPENAI_API_KEY')) return 'openai';
  return '';
}

async function askProvider(provider: string, prompt: string, history: any[]) {
  if (provider === 'nvidia') return askNvidia(prompt, history);
  if (provider === 'openai') return askOpenAI(prompt, history);
  return askGemini(prompt, history);
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers:corsHeaders(request) });
  if (request.method !== 'POST') return json(request, 405, { error:'Method not allowed.' });

  const origin = request.headers.get('origin') || '';
  if (origin && !allowedOrigins.has(origin) && !origin.startsWith('http://localhost:') && !origin.startsWith('http://127.0.0.1:')) {
    return json(request, 403, { error:'Origin is not allowed.' });
  }

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(request, 401, { error:'Sign in to use LinuxAid AI.' });

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 50_000) return json(request, 413, { error:'Request is too large.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceRole) return json(request, 500, { error:'Backend environment is incomplete.' });

  const admin = createClient(supabaseUrl, serviceRole, { auth:{ persistSession:false, autoRefreshToken:false } });
  const { data:userData, error:userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json(request, 401, { error:'Your LinuxAid session is invalid or expired.' });

  let payload: any;
  try { payload = await request.json(); }
  catch { return json(request, 400, { error:'Request body must be JSON.' }); }

  const provider = selectedProvider();
  if (payload?.action === 'status') {
    return json(request, provider ? 200 : 503, { ready:Boolean(provider) });
  }

  const prompt = String(payload?.prompt || '').replace(/\u0000/g,'').trim().slice(0,6000);
  if (!prompt) return json(request, 400, { error:'Prompt is required.' });
  const history = normalizeHistory(payload?.history);
  const dailyLimit = Math.max(1, Math.min(500, Number(Deno.env.get('LINUXAID_AI_DAILY_LIMIT') || 40)));

  try {
    const { data:usage, error:quotaError } = await admin.rpc('consume_linuxaid_ai_quota', { target_user:user.id, daily_limit:dailyLimit });
    if (quotaError) {
      if (String(quotaError.message || '').includes('AI_DAILY_LIMIT_REACHED')) return json(request, 429, { error:`Daily AI limit reached (${dailyLimit}). LinuxAid's local tutor and tools are still available.` });
      throw quotaError;
    }

    if (!provider) return json(request, 503, { error:'Remote LinuxAid AI is not configured yet.' });
    const answer = await askProvider(provider, prompt, history);
    return json(request, 200, { answer, usage:{ requestsToday:Number(usage || 1), dailyLimit } });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'AbortError';
    const providerError = error instanceof ProviderError ? error : null;
    console.error('linuxaid-ai error', timedOut ? 'provider timeout' : providerError ? `${providerError.code}: ${providerError.message}` : error instanceof Error ? error.message : error);

    if (timedOut) return json(request, 504, { error:'LinuxAid AI timed out. Please retry.', code:'AI_TIMEOUT' });
    if (providerError) {
      const safeMessage =
        providerError.code === 'AI_PROVIDER_AUTH' ? 'LinuxAid AI is connected, but the server-side AI key was rejected. Check the NVIDIA API key in your project secrets.' :
        providerError.code === 'AI_PROVIDER_RATE_LIMIT' ? 'LinuxAid AI has reached the provider rate limit. Please retry shortly.' :
        providerError.code === 'AI_PROVIDER_BUSY' ? 'LinuxAid AI is warming up. Please retry in a moment.' :
        providerError.code === 'AI_NOT_CONFIGURED' ? 'LinuxAid AI does not have a server-side API key configured yet.' :
        'LinuxAid AI could not reach its model provider. Please retry.';
      return json(request, providerError.status || 502, { error:safeMessage, code:providerError.code });
    }
    return json(request, 502, { error:'LinuxAid AI is temporarily unavailable. Please retry.', code:'AI_UPSTREAM_ERROR' });
  }
});