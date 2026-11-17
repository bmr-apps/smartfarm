import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceAlertState } from '../lib/alert-state.ts';

const keys = ['ph', 'ec'];
const empty = { lastSent: {}, active: {} };

test('dashboard polling without alerts never needs a storage write', () => {
  const result = advanceAlertState(keys, new Set(), empty, 1000, 30);
  assert.equal(result.changed, false);
  assert.deepEqual(result.due, []);
  assert.deepEqual(result.state, empty);
});

test('only alert transitions and cooldown expiry need a storage write', () => {
  const first = advanceAlertState(keys, new Set(['ph']), empty, 1000, 30);
  assert.deepEqual(first.due, ['ph']);
  assert.equal(first.changed, true);
  const repeated = advanceAlertState(keys, new Set(['ph']), first.state, 6000, 30);
  assert.equal(repeated.changed, false);
  assert.deepEqual(repeated.due, []);
  const expired = advanceAlertState(keys, new Set(['ph']), repeated.state, 1801000, 30);
  assert.equal(expired.changed, true);
  assert.deepEqual(expired.due, ['ph']);
  const cleared = advanceAlertState(keys, new Set(), expired.state, 1806000, 30);
  assert.equal(cleared.changed, true);
  assert.equal(cleared.state.active.ph, false);
  const stillClear = advanceAlertState(keys, new Set(), cleared.state, 1811000, 30);
  assert.equal(stillClear.changed, false);
  const rearmed = advanceAlertState(keys, new Set(['ph']), stillClear.state, 1816000, 30);
  assert.deepEqual(rearmed.due, []);
  const later = advanceAlertState(keys, new Set(['ph']), rearmed.state, 3601000, 30);
  assert.deepEqual(later.due, ['ph']);
  assert.deepEqual(empty, { lastSent: {}, active: {} });
});
