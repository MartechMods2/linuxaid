import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, renderSafeMarkdown, clampText } from '../js/security.js';

test('escapeHtml neutralizes executable markup', () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
});

test('safe markdown formats supported text after escaping HTML', () => {
  const rendered = renderSafeMarkdown('**Safe** `<script>alert(1)</script>`');
  assert.match(rendered, /<strong>Safe<\/strong>/);
  assert.match(rendered, /<code>&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/code>/);
  assert.doesNotMatch(rendered, /<script>/);
});

test('clampText limits untrusted payload size', () => {
  assert.equal(clampText('abcdef', 3), 'abc');
});
