export type AlertState = { lastSent: Record<string, number>; active: Record<string, boolean> };

export function advanceAlertState<Key extends string>(
  keys: readonly Key[],
  violations: ReadonlySet<Key>,
  previous: AlertState,
  now: number,
  cooldownMinutes: number,
): { state: AlertState; due: Key[]; changed: boolean } {
  const state: AlertState = { lastSent: { ...previous.lastSent }, active: { ...previous.active } };
  const due: Key[] = [];
  let changed = false;

  for (const key of keys) {
    if (!violations.has(key)) {
      if (state.active[key]) { state.active[key] = false; changed = true; }
      continue;
    }
    const wasActive = state.active[key] === true;
    if (!wasActive) { state.active[key] = true; changed = true; }
    if (state.lastSent[key] === undefined || now - state.lastSent[key] >= cooldownMinutes * 60_000) {
      due.push(key);
      state.lastSent[key] = now;
      changed = true;
    }
  }
  return { state, due, changed };
}
