import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults, settingsSchema } from '../lib/original-site-settings.ts';

test('the default farm settings can be saved', () => {
  assert.deepEqual(settingsSchema.parse(defaults), defaults);
});

test('the settings form can save continuous water readings and a one minute cycle', () => {
  const submitted = {
    ...defaults,
    thresholds: { ...defaults.thresholds, ph: { min: 5.8, max: 6.4 } },
    water: { ...defaults.water, mode: 'continuous', cycleMinutes: 1, staleMinutes: 1 },
  };
  const parsed = settingsSchema.parse(submitted);
  assert.equal(parsed.water.mode, 'continuous');
  assert.equal(parsed.water.cycleMinutes, 1);
  assert.equal(parsed.thresholds.ph.min, 5.8);
});

test('invalid ranges and unsupported water modes are rejected', () => {
  assert.equal(settingsSchema.safeParse({ ...defaults, thresholds: { ...defaults.thresholds, ph: { min: 7, max: 6 } } }).success, false);
  assert.equal(settingsSchema.safeParse({ ...defaults, water: { ...defaults.water, mode: 'other' } }).success, false);
});
