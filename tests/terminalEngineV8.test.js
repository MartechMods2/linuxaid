import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerminalEngine, terminalReferenceCount } from '../js/terminalEngineV8.js';

test('terminal V8 indexes more than 1000 command forms', () => {
  assert.ok(terminalReferenceCount > 1000, `expected >1000 reference forms, got ${terminalReferenceCount}`);
});

test('terminal V8 keeps core simulator behavior', () => {
  const terminal = createTerminalEngine();
  assert.equal(terminal.execute('pwd').output, '/home/linuxaid');
  terminal.execute('mkdir testdir');
  assert.match(terminal.execute('ls').output, /testdir/);
});

test('terminal V8 provides debugging guidance', () => {
  const terminal = createTerminalEngine();
  const result = terminal.execute('debug permission denied');
  assert.match(result.output, /whoami/i);
  assert.match(result.output, /chmod 777/i);
  assert.equal(result.safety.level, 'safe');
});

test('terminal V8 recognizes reference-only commands without pretending to execute them', () => {
  const terminal = createTerminalEngine();
  const result = terminal.execute('docker ps');
  assert.match(result.output, /recognized/i);
  assert.match(result.output, /does not fake a real system action/i);
});
