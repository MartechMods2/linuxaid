import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('mobile CSS enforces viewport-safe sizing and responsive terminal',()=>{
  const css=read('mobile-v5.css');
  assert.match(css,/overflow-x:hidden/);
  assert.match(css,/100dvh/);
  assert.match(css,/terminal-dock/);
  assert.match(css,/@media\(max-width:720px\)/);
});

test('auth client uses Supabase and supports captcha tokens',()=>{
  const js=read('js/authClientV5.js');
  assert.match(js,/signInWithPassword/);
  assert.match(js,/captchaToken/);
  assert.match(js,/signInWithOtp/);
  assert.match(js,/resetPasswordForEmail/);
  assert.match(js,/provider:'github'/);
});

test('public config exposes only browser-safe Turnstile key and never server secrets',()=>{
  const cfg=read('config.js');
  assert.match(cfg,/turnstileSiteKey:\s*['"][^'"]+['"]/);
  assert.doesNotMatch(cfg,/turnstileSecret|CLOUDFLARE_SECRET|serviceRole|service_role|OPENAI_API_KEY\s*:|GEMINI_API_KEY\s*:/i);
  assert.match(cfg,/maxAuthAttemptsPerWindow/);
});

test('runtime removes course/certificate promises and adds rankings navigation',()=>{
  const js=read('js/runtimeV5.js');
  assert.match(js,/removeCoursePromises/);
  assert.match(js,/Rankings/);
  assert.match(js,/Founder & CEO, LinuxAid/);
});

test('account page offers Google and GitHub without public build labels',()=>{
  const html=read('auth.html');
  assert.match(html,/Continue with Google/);
  assert.match(html,/Continue with GitHub/);
  assert.match(html,/fa-github/);
  const home=read('index.html');
  const tools=read('tools.html');
  assert.doesNotMatch(home,/Terminal V\d+/i);
  assert.doesNotMatch(tools,/Terminal V\d+/i);
});
