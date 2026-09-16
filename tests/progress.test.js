import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRoadmap, getProgressSummary, SKILL_BUCKETS } from '../js/progress.js';

test('roadmap percentages are based on commands actually learned', () => {
  const learnedCommands = SKILL_BUCKETS.beginner.slice(0, Math.ceil(SKILL_BUCKETS.beginner.length / 2));
  const result = calculateRoadmap({ learnedCommands });
  assert.ok(result.beginner >= 50);
  assert.equal(result.intermediate, 0);
  assert.equal(result.advanced, 0);
});

test('summary derives learner level from XP', () => {
  assert.equal(getProgressSummary({ xp:10, learnedCommands:[] }).level, 'Linux Starter');
  assert.equal(getProgressSummary({ xp:600, learnedCommands:[] }).level, 'Linux Builder');
  assert.equal(getProgressSummary({ xp:1300, learnedCommands:[] }).level, 'Advanced Explorer');
});
