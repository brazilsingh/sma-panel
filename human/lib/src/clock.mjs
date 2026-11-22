export const systemClock = Object.freeze({ now: () => Date.now() });

/** Deterministic clock for tests and simulations. */
export function createControlledClock(start = Date.UTC(2026, 10, 23, 8, 0)) {
  let t = typeof start === 'string' ? Date.parse(start) : start;
  return {
    now: () => t,
    set(value) { t = typeof value === 'string' ? Date.parse(value) : value; },
    advance(ms) { t += ms; return t; },
    advanceMinutes(minutes) { t += minutes * 60000; return t; }
  };
}
