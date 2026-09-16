import { createClient } from 'npm:@supabase/supabase-js@2';

const SYSTEM_PROMPT = `You are LinuxAid, a beginner-friendly Linux tutor. Explain Linux concepts step by step. Prefer safe read-only inspection before system changes. Clearly warn before privileged or destructive commands. Distinguish distro-specific commands. Never pretend a browser simulator changed a real machine. Keep answers practical, accurate and concise.`;

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
    'Cache-Control': 'no-store'
  };
}

function json(request: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers:corsHeaders(request) });
}

function normalizeHistory(value: unknown) {
  return (Array.isArray(value) ? value : [])
    .filter((item: any) => item && ['user','assistant'].includes(item.role) && item.content)
    .slice(-10)
    .map((item: any) => ({ role:item.role, content:String(item.content).slice(0,4000) }));
}

async function askGemini(prompt: string, history: any[]) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
  const contents = [
    ...history.map(item => ({ role:item.role === 'assistant' ? 'model' : 'user', parts:[{ text:item.content }] })),
    { role:'user', parts:[{ text:prompt }] }
  ];
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({
      systemInstruction:{ parts:[{ text:SYSTEM_PROMPT }] },
      contents,
      generationConfig:{ temperature:.35, maxOutputTokens:900 }
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || `Gemini request failed (${response.status}).`);
  const answer = String(result?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('') || '').trim();
  if (!answer) throw new Error('Gemini returned an empty answer.');
  return answer;
}

async function askOpenAI(prompt: string, history: any[]) {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.');
  const model = Deno.env.get('OPENAI_MODEL') || 'gpt-5-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${apiKey}` },
    body:JSON.stringify({
      model,
      messages:[{ role:'system', content:SYSTEM_PROMPT }, ...history, { role:'user', content:prompt }],
      temperature:.35,
      max_completion_tokens:900
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || `OpenAI request failed (${response.status}).`);
  const answer = String(result?.choices?.[0]?.message?.content || '').trim();
  if (!answer) throw new Error('OpenAI returned an empty answer.');
  return answer;
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

  const prompt = String(payload?.prompt || '').trim().slice(0,6000);
  if (!prompt) return json(request, 400, { error:'Prompt is required.' });
  const history = normalizeHistory(payload?.history);
  const dailyLimit = Math.max(1, Math.min(500, Number(Deno.env.get('LINUXAID_AI_DAILY_LIMIT') || 40)));

  try {
    const { data:usage, error:quotaError } = await admin.rpc('consume_linuxaid_ai_quota', {
      target_user:user.id,
      daily_limit:dailyLimit
    });
    if (quotaError) {
      if (String(quotaError.message || '').includes('AI_DAILY_LIMIT_REACHED')) {
        return json(request, 429, { error:`Daily AI limit reached (${dailyLimit}). LinuxAid's local tutor and tools are still available.` });
      }
      throw quotaError;
    }

    const configuredProvider = String(Deno.env.get('AI_PROVIDER') || '').toLowerCase();
    let provider = configuredProvider;
    if (!provider) provider = Deno.env.get('GEMINI_API_KEY') ? 'gemini' : Deno.env.get('OPENAI_API_KEY') ? 'openai' : '';
    if (!provider) return json(request, 503, { error:'No remote AI provider is configured on the server.' });

    const answer = provider === 'openai'
      ? await askOpenAI(prompt, history)
      : await askGemini(prompt, history);

    return json(request, 200, {
      answer,
      provider,
      usage:{ requestsToday:Number(usage || 1), dailyLimit }
    });
  } catch (error) {
    console.error('linuxaid-ai error', error);
    return json(request, 500, { error:error instanceof Error ? error.message : 'LinuxAid AI request failed.' });
  }
});
