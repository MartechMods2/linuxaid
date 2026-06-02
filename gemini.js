export async function queryGemini(prompt, config) {
  if (!config?.geminiApiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const endpoint = config.geminiApiUrl || 'https://api.openai.com/v1/chat/completions';
  const payload = {
    model: 'gpt-4.1',
    messages: [
      { role: 'system', content: 'You are LinuxAid, a beginner-friendly Linux tutor. Answer safely and avoid destructive commands.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.38,
    max_tokens: 500
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.geminiApiKey}`
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!response.ok) {
    const message = result.error?.message || 'Gemini API request failed.';
    throw new Error(message);
  }

  const completion = result?.choices?.[0]?.message?.content || result?.choices?.[0]?.text || '';
  return String(completion).trim();
}
