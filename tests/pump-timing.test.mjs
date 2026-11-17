import test from 'node:test';
import assert from 'node:assert/strict';
import { supplyTiming, simulatedContactStart, simulatedDrainTiming } from '../lib/pump-timing.ts';
const interval = 30 * 60_000;
test('scheduled watering runs only for the configured duration', () => {
  assert.equal(supplyTiming(interval, 15, interval).running, true);
  assert.equal(supplyTiming(interval + 14999, 15, interval).running, true);
  const ended = supplyTiming(interval + 15000, 15, interval);
  assert.equal(ended.running, false);
  assert.equal(ended.endsAt, null);
  assert.equal(ended.lastEndedAt, interval + 15000);
  assert.equal(ended.nextStartedAt, interval * 2);
});
test('manual supply restarts the next watering countdown', () => {
  const start = interval + 123000;
  const active = supplyTiming(start + 1000, 25, interval, start);
  assert.equal(active.endsAt, start + 25000);
  assert.equal(active.nextStartedAt, start + interval);
  assert.equal(supplyTiming(start + interval, 25, interval, start).running, true);
});
test('completed history never contains a future end', () => {
  for (const now of [interval, interval + 14000, interval + 15000]) {
    assert.ok(supplyTiming(now, 15, interval).recentEndedAt.every(t => t <= now));
  }
});

test('last watering time reflects the latest scheduled or manual start', () => {
  assert.equal(supplyTiming(interval + 15000, 15, interval).lastStartedAt, interval);
  const manual = interval + 123000;
  assert.equal(supplyTiming(manual + 1000, 25, interval, manual).lastStartedAt, manual);
});

test('demo drainage predicts the next contact and records only completed drains', () => {
  const cycle = 120 * 60_000;
  const before = simulatedDrainTiming(cycle - 1000, 30, cycle, [0]);
  assert.equal(before.nextStartedAt, cycle);
  const active = simulatedDrainTiming(cycle + 1000, 30, cycle, [0, cycle]);
  assert.equal(active.running, true);
  assert.equal(active.endsAt, cycle + 30000);
  assert.equal(active.lastStartedAt, cycle);
  assert.equal(active.nextStartedAt, cycle * 2);
  assert.deepEqual(active.recentEndedAt, [30000]);
  const ended = simulatedDrainTiming(cycle + 30000, 30, cycle, [0, cycle]);
  assert.equal(ended.running, false);
  assert.equal(ended.lastEndedAt, cycle + 30000);
  const manual = simulatedDrainTiming(cycle + 60000, 30, cycle, [0, cycle], cycle + 45000);
  assert.equal(manual.running, true);
  assert.equal(manual.lastStartedAt, cycle + 45000);
  assert.equal(manual.nextStartedAt, cycle + 45000 + cycle);
});

test('manual drainage resets the two-hour sensor cycle from the button press', () => {
  const cycle = 120 * 60_000;
  const pressed = cycle + 45_123;
  assert.equal(simulatedContactStart(pressed + cycle - 1, cycle, pressed), null);
  assert.equal(simulatedContactStart(pressed + cycle, cycle, pressed), pressed + cycle);
  assert.equal(simulatedContactStart(pressed + cycle * 2 + 999, cycle, pressed), pressed + cycle * 2);
  const start = simulatedDrainTiming(pressed + 1000, 30, cycle, [cycle], pressed);
  assert.equal(start.nextStartedAt, pressed + cycle);
  assert.equal(start.running, true);
  const next = simulatedDrainTiming(pressed + cycle, 30, cycle, [cycle, pressed + cycle], pressed);
  assert.equal(next.running, true);
  assert.equal(next.nextStartedAt, pressed + cycle * 2);
});

test('the original demo sensor schedule is preserved before a manual start', () => {
  const cycle = 120 * 60_000;
  const pressed = cycle + 45_123;
  assert.equal(simulatedContactStart(cycle + 10_000, cycle, pressed), cycle);
  assert.equal(simulatedContactStart(pressed + 1000, cycle, pressed), null);
  assert.equal(simulatedContactStart(cycle * 2, cycle), cycle * 2);
});
