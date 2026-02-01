import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseJsonBody,
  validateActivityPayload,
  validateActivityId,
} from '../netlify/functions/_shared/activityValidation.js';

test('parseJsonBody returns empty data when body is missing', () => {
  assert.deepEqual(parseJsonBody(null), { data: {}, error: null });
  assert.deepEqual(parseJsonBody(undefined), { data: {}, error: null });
});

test('parseJsonBody returns parsed data for valid JSON', () => {
  const result = parseJsonBody('{"activity":{"eventType":"Feed","timestamp":"2024-01-01T00:00:00Z"}}');
  assert.equal(result.error, null);
  assert.deepEqual(result.data.activity.eventType, 'Feed');
});

test('parseJsonBody returns error for invalid JSON', () => {
  const result = parseJsonBody('{');
  assert.equal(result.data, null);
  assert.equal(result.error, 'Invalid JSON body.');
});

test('validateActivityPayload enforces required fields', () => {
  assert.equal(validateActivityPayload(null), 'Missing activity data');
  assert.equal(validateActivityPayload({ eventType: 'Feed' }), 'Missing activity data');
  assert.equal(
    validateActivityPayload({ eventType: 'Feed', timestamp: '2024-01-01T00:00:00Z' }),
    null
  );
});

test('validateActivityId enforces id presence', () => {
  assert.equal(validateActivityId(null), 'Missing activity id');
  assert.equal(validateActivityId('abc'), null);
});
