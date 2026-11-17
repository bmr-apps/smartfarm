export type TankConfig = { capacityLiters: number; heightCm: number; sensorOffsetCm: number };
export const tankDefaults: TankConfig = { capacityLiters: 200, heightCm: 50, sensorOffsetCm: 0 };
/** Constant cross-section tank; offset is the sensor's height above the full-water plane. */
export function measureTank(distanceCm: number | null, config: TankConfig = tankDefaults) {
  if (distanceCm === null || !Number.isFinite(distanceCm) || distanceCm < 2 || distanceCm > 400 || distanceCm > config.heightCm + config.sensorOffsetCm + 2) return null;
  const heightCm = Math.max(0, Math.min(config.heightCm, config.heightCm + config.sensorOffsetCm - distanceCm));
  const liters = heightCm / config.heightCm * config.capacityLiters;
  return { distanceCm, heightCm, liters, percent: heightCm / config.heightCm * 100 };
}
export function waterIsLow(liters: number | undefined, minimum = 10) {
  return typeof liters === 'number' && Number.isFinite(liters) && liters <= minimum;
}
