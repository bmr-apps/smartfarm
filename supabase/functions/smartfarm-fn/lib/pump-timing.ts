export function supplyTiming(now: number, durationSeconds: number, intervalMs: number, manualStart?: number) {
  const anchor = manualStart ?? 0;
  const startedAt = anchor + Math.floor((now - anchor) / intervalMs) * intervalMs;
  const end = startedAt + durationSeconds * 1000;
  const running = now >= startedAt && now < end;
  const lastEndedAt = running ? end - intervalMs : end;
  return { running, endsAt: running ? end : null, lastStartedAt: startedAt, lastEndedAt,
    recentEndedAt: Array.from({ length: 5 }, (_, i) => lastEndedAt - i * intervalMs),
    nextStartedAt: startedAt + intervalMs, durationSeconds, source: 'demo' };
}

/** Most recent synthetic water contact, shifted when a manual drain resets the demo cycle. */
export function simulatedContactStart(time: number, contactCycleMs: number, manualStart?: number): number | null {
  if (manualStart !== undefined && time >= manualStart) {
    const elapsed = time - manualStart;
    return elapsed < contactCycleMs ? null : manualStart + Math.floor(elapsed / contactCycleMs) * contactCycleMs;
  }
  return Math.floor(time / contactCycleMs) * contactCycleMs;
}

/** Predicts the dashboard's demo contact cycle; actual drains are sensor-triggered. */
export function simulatedDrainTiming(now: number, durationSeconds: number, contactCycleMs: number, contacts: number[], manualStart?: number) {
  const durationMs = durationSeconds * 1000;
  const starts = [...contacts, ...(manualStart === undefined ? [] : [manualStart])]
    .filter(start => start <= now).sort((a, b) => a - b);
  const latestStart = starts.at(-1) ?? null;
  const endsAt = latestStart !== null && latestStart + durationMs > now ? latestStart + durationMs : null;
  const recentEndedAt = [...new Set(starts.map(start => start + durationMs).filter(end => end <= now))]
    .sort((a, b) => b - a).slice(0, 5);
  return {
    running: endsAt !== null, endsAt, lastStartedAt: latestStart, lastEndedAt: recentEndedAt[0] ?? null, recentEndedAt,
    nextStartedAt: (manualStart ?? 0) + (Math.floor((now - (manualStart ?? 0)) / contactCycleMs) + 1) * contactCycleMs,
    durationSeconds, source: 'demo',
  };
}
