import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { QUIZ_BANK } from '../js/quizBank.js';

test('LinuxAid Play has a meaningful question bank',()=>{
  assert.ok(QUIZ_BANK.length>=25);
  assert.equal(new Set(QUIZ_BANK.map(q=>q.id)).size,QUIZ_BANK.length);
  for(const q of QUIZ_BANK){
    assert.equal(q.options.length,4);
    assert.ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<4);
    assert.ok(q.explanation.length>20);
  }
});

test('V10 exposes play and AI mentor modes',async()=>{
  const [play,dashboard,edge]=await Promise.all([
    readFile('play.html','utf8'),
    readFile('dashboard.html','utf8'),
    readFile('supabase/functions/linuxaid-ai/index.ts','utf8')
  ]);
  assert.match(play,/Daily Mission/);
  assert.match(play,/Quick Fire/);
  for(const mode of ['explain','troubleshoot','review','coach','quiz']){
    assert.match(dashboard,new RegExp(`data-ai-mode="${mode}"`));
    assert.match(edge,new RegExp(`${mode}:`));
  }
});

test('stale product copy is removed from core learning surfaces',async()=>{
  const [home,labs]=await Promise.all([readFile('index.html','utf8'),readFile('labs.html','utf8')]);
  assert.doesNotMatch(home,/Terminal V2/);
  assert.match(home,/Terminal V8/);
  assert.doesNotMatch(labs,/courses\.html/);
  assert.match(labs,/play\.html/);
});

test('V10 game files exist',async()=>{
  for(const path of ['play.html','play.css','js/playPage.js','js/quizBank.js','ai-v10.css']){
    await assert.doesNotReject(()=>access(path),`missing ${path}`);
  }
});
