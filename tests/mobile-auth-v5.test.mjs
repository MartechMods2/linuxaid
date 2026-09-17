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
});

test('public config never embeds server secrets and exposes Turnstile site-key slot',()=>{
  const cfg=read('config.js');
  assert.match(cfg,/turnstileSiteKey:\s*''/);
  assert.doesNotMatch(cfg,/serviceRole|service_role|OPENAI_API_KEY\s*:/);
  assert.match(cfg,/maxAuthAttemptsPerWindow/);
});

test('runtime removes course/certificate promises and adds rankings navigation',()=>{
  const js=read('js/runtimeV5.js');
  assert.match(js,/removeCoursePromises/);
  assert.match(js,/Rankings/);
  assert.match(js,/Founder & CEO, LinuxAid/);
});
