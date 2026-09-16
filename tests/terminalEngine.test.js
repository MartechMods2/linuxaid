import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerminalEngine, analyzeCommandSafety, resolvePath } from '../js/terminalEngine.js';

test('terminal performs real simulated file operations', () => {
  const term = createTerminalEngine();
  assert.equal(term.execute('pwd').output, '/home/linuxaid');
  assert.equal(term.execute('mkdir demo').output, '');
  assert.equal(term.execute('cd demo').output, '');
  assert.equal(term.execute('echo hello > note.txt').output, '');
  assert.equal(term.execute('cat note.txt').output, 'hello\n');
  assert.equal(term.execute('cp note.txt copy.txt').output, '');
  assert.equal(term.execute('cat copy.txt').output, 'hello\n');
  assert.equal(term.execute('mv copy.txt final.txt').output, '');
  assert.match(term.execute('ls').output, /final\.txt/);
  assert.equal(term.execute('rm final.txt').output, '');
  assert.doesNotMatch(term.execute('ls').output, /final\.txt/);
});

test('terminal blocks extreme destructive patterns', () => {
  const result = createTerminalEngine().execute('rm -rf /');
  assert.equal(result.blocked, true);
  assert.equal(result.safety.level, 'extreme');
  assert.match(result.output, /BLOCKED/);
});

test('safety analyzer classifies privilege-changing commands', () => {
  assert.equal(analyzeCommandSafety('sudo systemctl restart nginx').level, 'high');
  assert.equal(analyzeCommandSafety('ls -la').level, 'safe');
});

test('path resolver normalizes dot dot and home paths', () => {
  assert.equal(resolvePath('/home/linuxaid/projects', '..'), '/home/linuxaid');
  assert.equal(resolvePath('/tmp', '~/notes.txt'), '/home/linuxaid/notes.txt');
});

test('history navigation and autocomplete work', () => {
  const term = createTerminalEngine();
  term.execute('pwd');
  term.execute('ls');
  assert.equal(term.historyMove(-1), 'ls');
  assert.equal(term.historyMove(-1), 'pwd');
  assert.equal(term.autocomplete('jour'), 'journalctl');
});
