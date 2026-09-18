import { initBackend, getBackendStatus, invokeBackendFunction } from './backend.js';

const SYSTEM_PROMPT = `You are LinuxAid, a beginner-friendly Linux tutor. Explain concepts step by step, prefer safe read-only inspection before system changes, clearly warn before privileged or destructive commands, distinguish distro-specific commands, and never pretend a simulated command changed a real machine.`;

function aiConfig(config = {}) {
  return config.ai || {};
}

function normalizeHistory(history = []) {
  return (Array.isArray(history) ? history : [])
    .filter(item => item && ['user','assistant'].includes(item.role) && item.text)
    .slice(-10)
    .map(item => ({ role:item.role, content:String(item.text).slice(0,4000) }));
}

function readAnswer(result) {
  return String(
    result?.answer ||
    result?.output_text ||
    result?.choices?.[0]?.message?.content ||
    result?.choices?.[0]?.text ||
    result?.candidates?.[0]?.content?.parts?.map(part => part?.text || '').join('') ||
    ''
  ).trim();
}

async function queryBackendFunction(prompt, config, history, options = {}) {
  await initBackend(config);
  const status = getBackendStatus();
  if (!status.ready) throw new Error('LinuxAid AI service is not configured.');
  const functionName = aiConfig(config).edgeFunction || 'linuxaid-ai';
  const requestBody = {
    prompt:String(prompt).slice(0,6000),
    history:normalizeHistory(history),
    mode:String(options.mode || 'explain').slice(0,24),
    distro:String(options.distro || '').slice(0,40),
    level:String(options.level || 'beginner').slice(0,20)
  };

  let result;
  try {
    result = await invokeBackendFunction(functionName, requestBody);
  } catch (error) {
    const retryable = ['AI_PROVIDER_BUSY','AI_TIMEOUT','AI_UPSTREAM_ERROR','AI_PROVIDER_REQUEST'].includes(String(error?.code || ''));
    if (!retryable) throw error;
    await new Promise(resolve => setTimeout(resolve, 700));
    result = await invokeBackendFunction(functionName, requestBody);
  }

  const answer = readAnswer(result);
  if (!answer) throw new Error('LinuxAid AI returned an empty answer.');
  return answer;
}

async function queryProxy(prompt, config, history, options = {}) {
  const proxyUrl = aiConfig(config).proxyUrl || config.aiProxyUrl;
  if (!proxyUrl) throw new Error('LinuxAid AI proxy is not configured.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(proxyUrl, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ prompt:String(prompt).slice(0,6000), history:normalizeHistory(history), mode:options.mode||'explain', distro:options.distro||'', level:options.level||'beginner' }),
      signal:controller.signal
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.error?.message || result?.error || `AI proxy request failed (${response.status}).`);
    const answer = readAnswer(result);
    if (!answer) throw new Error('AI proxy returned an empty answer.');
    return answer;
  } finally {
    clearTimeout(timeout);
  }
}

async function queryOpenAIDirect(prompt, config, history) {
  const ai = aiConfig(config);
  const apiKey = ai.openaiApiKey || config.openaiApiKey;
  if (!apiKey) throw new Error('OpenAI API key is not configured.');
  const response = await fetch(ai.openaiApiUrl || 'https://api.openai.com/v1/chat/completions', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${apiKey}` },
    body:JSON.stringify({
      model:ai.openaiModel || 'gpt-4.1-mini',
      messages:[{ role:'system', content:SYSTEM_PROMPT }, ...normalizeHistory(history), { role:'user', content:String(prompt).slice(0,6000) }],
      temperature:0.35,
      max_tokens:700
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || 'OpenAI request failed.');
  const answer = readAnswer(result);
  if (!answer) throw new Error('OpenAI returned an empty answer.');
  return answer;
}

async function queryGeminiDirect(prompt, config, history) {
  const ai = aiConfig(config);
  const apiKey = ai.geminiApiKey || config.geminiApiKey;
  if (!apiKey) throw new Error('Gemini API key is not configured.');
  const model = ai.geminiModel || 'gemini-2.5-flash';
  const endpoint = ai.geminiApiUrl || `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const contents = [
    ...normalizeHistory(history).map(item => ({ role:item.role === 'assistant' ? 'model' : 'user', parts:[{ text:item.content }] })),
    { role:'user', parts:[{ text:String(prompt).slice(0,6000) }] }
  ];
  const response = await fetch(endpoint, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ systemInstruction:{ parts:[{ text:SYSTEM_PROMPT }] }, contents, generationConfig:{ temperature:0.35, maxOutputTokens:700 } })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || 'Gemini request failed.');
  const answer = readAnswer(result);
  if (!answer) throw new Error('Gemini returned an empty answer.');
  return answer;
}

export function getAIStatus(config = {}) {
  const ai = aiConfig(config);
  const backend = getBackendStatus();
  const supabaseConfigured = Boolean(config.backend?.supabase?.url && (config.backend?.supabase?.publishableKey || config.backend?.supabase?.anonKey));
  if ((backend.ready && backend.provider === 'supabase') || supabaseConfigured) {
    return { ready:true, mode:'edge-function', provider:'server', function:ai.edgeFunction || 'linuxaid-ai' };
  }
  if (ai.proxyUrl || config.aiProxyUrl) return { ready:true, mode:'proxy', provider:ai.provider || 'server' };
  if (ai.allowInsecureBrowserAI === true && (ai.openaiApiKey || config.openaiApiKey)) return { ready:true, mode:'browser-direct', provider:'openai', warning:'API key is exposed to the browser.' };
  if (ai.allowInsecureBrowserAI === true && (ai.geminiApiKey || config.geminiApiKey)) return { ready:true, mode:'browser-direct', provider:'gemini', warning:'API key is exposed to the browser.' };
  return { ready:false, mode:'local-fallback', provider:'local' };
}

export async function queryAI(prompt, config = {}, history = [], options = {}) {
  const ai = aiConfig(config);
  const supabaseConfigured = Boolean(config.backend?.supabase?.url && (config.backend?.supabase?.publishableKey || config.backend?.supabase?.anonKey));
  if (supabaseConfigured) return queryBackendFunction(prompt, config, history, options);
  if (ai.proxyUrl || config.aiProxyUrl) return queryProxy(prompt, config, history, options);
  if (ai.allowInsecureBrowserAI !== true) throw new Error('Secure AI backend is not configured. Browser API keys are disabled.');
  const provider = String(ai.provider || 'gemini').toLowerCase();
  if (provider === 'openai') return queryOpenAIDirect(prompt, config, history);
  if (provider === 'gemini') return queryGeminiDirect(prompt, config, history);
  throw new Error(`Unsupported AI provider: ${provider}`);
}

export async function checkAIHealth(config = {}) {
  const ai=aiConfig(config);
  const supabaseConfigured=Boolean(config.backend?.supabase?.url&&(config.backend?.supabase?.publishableKey||config.backend?.supabase?.anonKey));
  if(supabaseConfigured){
    try{
      await initBackend(config);
      const result=await invokeBackendFunction(ai.edgeFunction||'linuxaid-ai',{action:'status'});
      return Boolean(result?.ready);
    }catch{return false}
  }
  return Boolean(ai.proxyUrl||config.aiProxyUrl);
}

export const queryGemini = queryAI;
