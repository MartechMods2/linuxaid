import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const REQUIRED_PAGES = [
  'index.html','dashboard.html','linux.html','courses.html','labs.html','tools.html',
  'community.html','profile.html','auth.html','offline.html','404.html'
];

test('productization pages and PWA assets exist', async () => {
  for (const path of [...REQUIRED_PAGES,'manifest.webmanifest','service-worker.js','product.css']) {
    await assert.doesNotReject(() => access(path), `missing ${path}`);
  }
});

test('public config keeps insecure browser AI disabled', async () => {
  const config = await readFile('config.js','utf8');
  assert.match(config, /allowInsecureBrowserAI:\s*false/);
  assert.doesNotMatch(config, /AIza[0-9A-Za-z_-]{20,}/);
  assert.doesNotMatch(config, /sk-[A-Za-z0-9_-]{20,}/);
});

test('service worker app shell includes core learning routes', async () => {
  const sw = await readFile('service-worker.js','utf8');
  for (const path of ['courses.html','labs.html','tools.html','community.html','offline.html']) {
    assert.match(sw, new RegExp(path.replace('.','\\.')));
  }
});

test('mock admin analytics are suppressed until a real backend exists', async () => {
  const runtime = await readFile('js/pageBasics.js','utf8');
  assert.match(runtime, /admin-shell/);
  assert.match(runtime, /section\.hidden\s*=\s*true/);
});
