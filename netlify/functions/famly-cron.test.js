import test from 'node:test';
import assert from 'node:assert/strict';

import { __test } from './famly-cron.js';

test('isoDateInTimeZone returns YYYY-MM-DD', () => {
  const result = __test.isoDateInTimeZone('Europe/London', new Date('2026-02-11T09:30:00Z'));
  assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(result, '2026-02-11');
});

test('normalizeDateInput keeps YYYY-MM-DD input as-is', () => {
  const result = __test.normalizeDateInput('2026-02-11', 'Europe/London');
  assert.deepEqual(result, { day: '2026-02-11' });
});

test('normalizeDateInput converts ISO datetime to configured timezone day', () => {
  const result = __test.normalizeDateInput('2026-02-11T23:30:00Z', 'Europe/London');
  assert.deepEqual(result, { day: '2026-02-11' });
});

test('normalizeDateInput rejects invalid values', () => {
  const result = __test.normalizeDateInput('not-a-date', 'Europe/London');
  assert.equal(typeof result.error, 'string');
});
