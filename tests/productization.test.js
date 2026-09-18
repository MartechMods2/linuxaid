import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const REQUIRED_PAGES = [
  'index.html','dashboard.html','linux.html','labs.html','tools.html',
  'community.html','people.html','messages.html','rankings.html','play.html','profile.html','auth.html','about.html','offline.html','404.html'
];

test('product pages and PWA assets exist', async () => {
  for (const path of [...REQUIRED_PAGES,'manifest.webmanifest','service-worker.js','product.css','social-v7.css','play.css','ai-v10.css','experience.css','js/homeExperience.js']) {
    await assert.doesNotReject(() => access(path), `missing ${path}`);
  }
});

test('public config keeps insecure browser AI disabled', async () => {
  const config = await readFile('config.js','utf8');
  assert.match(config, /allowInsecureBrowserAI:\s*false/);
  assert.doesNotMatch(config, /AIza[0-9A-Za-z_-]{20,}/);
  assert.doesNotMatch(config, /sk-[A-Za-z0-9_-]{20,}/);
});

test('service worker app shell includes core LinuxAid routes', async () => {
  const sw = await readFile('service-worker.js','utf8');
  for (const path of ['labs.html','tools.html','community.html','people.html','messages.html','rankings.html','play.html','about.html','offline.html']) {
    assert.match(sw, new RegExp(path.replace('.','\\.')));
  }
  assert.doesNotMatch(sw, /supabase\.co'\]/);
});

test('mock admin analytics are suppressed until a real backend exists', async () => {
  const runtime = await readFile('js/pageBasics.js','utf8');
  assert.match(runtime, /admin-shell/);
  assert.match(runtime, /section\.hidden\s*=\s*true/);
});

test('public README stays minimal and does not advertise implementation details', async () => {
  const readme = await readFile('README.md','utf8');
  assert.doesNotMatch(readme,/Supabase|PostHog|Edge Function|RLS|service role|API key|security architecture|product areas/i);
  assert.match(readme,/LinuxAid/);
  assert.match(readme,/All rights reserved/i);
});

test('homepage experience includes accessible legends and daily exploration', async () => {
  const [home,script] = await Promise.all([readFile('index.html','utf8'),readFile('js/homeExperience.js','utf8')]);
  assert.match(home,/data-legends-carousel/);
  assert.match(home,/data-legend-toggle/);
  assert.match(home,/Daily Linux Spark/);
  assert.match(home,/Choose your path/);
  assert.match(home,/about\.html/);
  assert.match(script,/toggleAttribute\('inert'/);
  assert.match(script,/getProgressSummary/);
});
