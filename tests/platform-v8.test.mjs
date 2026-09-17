import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { COMMAND_UNIVERSE_V8 } from '../js/commandUniverseV8.js';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Terminal V8 indexes at least 1200 real command names',()=>{
  assert.ok(COMMAND_UNIVERSE_V8.length>=1200,`expected >=1200, got ${COMMAND_UNIVERSE_V8.length}`);
  for(const name of ['ssh','systemctl','journalctl','docker','kubectl','git','python3','iptables'])assert.ok(COMMAND_UNIVERSE_V8.includes(name),`missing ${name}`);
});

test('mobile layout has phone breakpoint, safe area and touch sizing',async()=>{
  const css=await read('platform-v8.css');
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.match(css,/--v8-touch:44px/);
  assert.match(css,/\.v8-mobile-nav/);
});

test('AI proxy supports NVIDIA without a hard-coded key',async()=>{
  const source=await read('supabase/functions/linuxaid-ai/index.ts');
  assert.match(source,/NVIDIA_API_KEY/);
  assert.match(source,/integrate\.api\.nvidia\.com\/v1/);
  assert.match(source,/AbortController/);
  assert.doesNotMatch(source,/nvapi-[A-Za-z0-9_-]{8,}/);
});

test('public config contains session timeout but no private provider key',async()=>{
  const source=await read('config.js');
  assert.match(source,/sessionIdleMs/);
  assert.match(source,/sessionMaxAgeMs/);
  assert.doesNotMatch(source,/NVIDIA_API_KEY\s*:/);
});

test('social layer persists richer post and profile fields',async()=>{
  const source=await read('js/socialApi.js');
  for(const key of ['post_type','code_snippet','experience_level','availability_status','skills'])assert.match(source,new RegExp(key));
});

test('installation, command and support pages exist in navigation runtime',async()=>{
  const runtime=await read('js/platformV8.js');
  for(const page of ['install.html','commands.html','support.html'])assert.match(runtime,new RegExp(page.replace('.','\\.')));
});
