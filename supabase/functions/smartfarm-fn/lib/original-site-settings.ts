import { z } from 'npm:zod@4.6.5';
import { tankDefaults } from './water-tank.ts';

const metricKeys = ['ph', 'ec', 'temperature', 'humidity', 'water'] as const;

export const defaults = {
  thresholds: { ph: { min: 5.5, max: 6.5 }, ec: { min: 1.2, max: 2.2 }, temperature: { min: 18, max: 28 }, humidity: { min: 50, max: 80 }, water: { min: 10, max: 200 } },
  alertEnabled: { ph: true, ec: true, temperature: true, humidity: true, water: true },
  water: { ...tankDefaults, mode: 'continuous' as const, cycleMinutes: 120, maxRise: 15, maxFall: 15, staleMinutes: 60, tolerance: 0.5 },
  notifications: true,
  cooldownMinutes: 30,
  pumpSeconds: 15,
};

export const settingsSchema = z.object({
  thresholds: z.object(Object.fromEntries(metricKeys.map(key => [key, z.object({ min: z.number(), max: z.number() }).refine(value => value.min < value.max, { message: '하한은 상한보다 작아야 합니다.' })]))),
  alertEnabled: z.object(Object.fromEntries(metricKeys.map(key => [key, z.boolean()]))),
  water: z.object({
    mode: z.enum(['contact', 'continuous']).transform(() => 'continuous' as const),
    capacityLiters: z.number().positive().max(10000).default(200),
    heightCm: z.number().min(5).max(400).default(50),
    sensorOffsetCm: z.number().min(0).max(100).default(0),
    cycleMinutes: z.number().int().min(1).max(1440),
    maxRise: z.number().min(0).max(100),
    maxFall: z.number().min(0).max(100),
    staleMinutes: z.number().int().min(1).max(1440),
    tolerance: z.number().min(0).max(20),
  }),
  notifications: z.boolean(),
  cooldownMinutes: z.number().int().min(1).max(1440),
  pumpSeconds: z.number().int().min(1).max(600),
});


/** Upgrade the old contact/percentage settings exactly once without discarding other preferences. */
export function normalizeSettings(input: unknown) {
  const value = input as {water?: Record<string, unknown>; thresholds?: Record<string, unknown>};
  if (value?.water && !('capacityLiters' in value.water)) {
    return settingsSchema.parse({...value, water:{...value.water,...tankDefaults,mode:'continuous'},thresholds:{...value.thresholds,water:{min:10,max:200}}});
  }
  return settingsSchema.parse(input);
}
