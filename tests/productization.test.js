import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const REQUIRED_PAGES = [
  'index.html','dashboard.html','linux.html','labs.html','tools.html','rankings.html',
  'community.html','profile.html','auth.html','offline.html','404.html'
];

test('production pages and PWA assets exist', async () => {
  for (const path of [...REQUIRED_PAGES,'manifest.webmanifest','service-worker.js','product.css','mobile-v5.css']) {
    await assert.doesNotReject(() => access(path), `missing ${path}`);
  }
});

test('public config keeps secrets out of browser and exposes auth slots only', async () => {
  const config = await readFile('config.js','utf8');
  assert.match(config, /allowInsecureBrowserAI:\s*false/);
  assert.match(config, /provider:\s*'turnstile'/);
  assert.match(config, /googleEnabled:\s*false/);
  assert.doesNotMatch(config, /AIza[0-9A-Za-z_-]{20,}/);
  assert.doesNotMatch(config, /sk-[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(config, /service_role/i);
});

test('service worker busts stale layout caches and includes current product routes', async () => {
  const sw = await readFile('service-worker.js','utf8');
  assert.match(sw, /linuxaid-v7/);
  for (const path of ['rankings.html','labs.html','tools.html','community.html','offline.html','mobile-v5.css','authV5.js']) {
    assert.match(sw, new RegExp(path.replace('.','\\.')));
  }
});

test('auth page uses Supabase static-site flow and Turnstile slot', async () => {
  const page = await readFile('auth.html','utf8');
  const runtime = await readFile('js/authV5.js','utf8');
  assert.match(page, /js\/authV5\.js/);
  assert.match(page, /id="authCaptcha"/);
  assert.match(runtime, /signInWithPassword/);
  assert.match(runtime, /signUp/);
  assert.match(runtime, /turnstile/);
});

test('mobile hardening prevents common viewport overflow patterns', async () => {
  const css = await readFile('mobile-v5.css','utf8');
  assert.match(css, /overflow-x:hidden/);
  assert.match(css, /100dvw/);
  assert.match(css, /100dvh/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /terminal-dock/);
});

test('course URL no longer promises courses or certificates', async () => {
  const courses = await readFile('courses.html','utf8');
  assert.match(courses, /rankings\.html/);
  assert.match(courses, /does not issue certificates|rather than courses or certificate promises/i);
  const home = await readFile('index.html','utf8');
  assert.doesNotMatch(home, /Browse courses|Courses & quizzes|View courses/);
});

test('mock admin analytics are suppressed until a real backend exists', async () => {
  const runtime = await readFile('js/pageBasics.js','utf8');
  assert.match(runtime, /admin-shell/);
  assert.match(runtime, /section\.hidden\s*=\s*true/);
});
