import { invalid } from './errors.mjs';

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function assertTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone) throw invalid('Choose a time zone, for example Europe/London.');
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(0);
  } catch {
    throw invalid('Unknown time zone: ' + timeZone + '. Use an IANA name such as Europe/London.');
  }
  return timeZone;
}

function offsetMs(utcMs, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(utcMs).map(p => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * Convert a wall-clock time ("2026-11-23T09:30") in an IANA time zone to UTC milliseconds.
 * Times that do not exist (spring-forward gap) are rejected. Ambiguous times (fall-back
 * overlap) resolve to the earlier instant, and the result says so.
 */
export function zonedToUtc(local, timeZone) {
  assertTimeZone(timeZone);
  const m = LOCAL.exec(String(local || ''));
  if (!m) throw invalid('Enter the date and time as YYYY-MM-DDTHH:mm.');
  const [y, mo, d, h, mi, s = '0'] = m.slice(1);
  const naive = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  const check = new Date(naive);
  if (check.getUTCFullYear() !== +y || check.getUTCMonth() !== +mo - 1 || check.getUTCDate() !== +d || +h > 23 || +mi > 59 || +s > 59) {
    throw invalid('That date does not exist: ' + local + '.');
  }
  const candidates = new Set();
  // The offsets in force a day either side cover both sides of any DST transition.
  for (const probe of [naive - 864e5, naive, naive + 864e5]) {
    const guess = naive - offsetMs(probe, timeZone);
    if (guess + offsetMs(guess, timeZone) === naive) candidates.add(guess);
  }
  const sorted = [...candidates].sort((a, b) => a - b);
  if (!sorted.length) {
    throw invalid(local + ' does not exist in ' + timeZone + ' because the clocks change at that time. Choose another time.');
  }
  return { utcMs: sorted[0], ambiguous: sorted.length > 1 };
}

/** Normalise the owner's schedule input. Accepts {local, timeZone} or {at} (ISO with offset). */
export function parseSchedule(input) {
  if (!input || typeof input !== 'object') throw invalid('Set a date, time, and time zone.');
  if (input.local !== undefined || input.timeZone !== undefined) {
    const { utcMs, ambiguous } = zonedToUtc(input.local, input.timeZone);
    return { local: input.local, timeZone: input.timeZone, at: new Date(utcMs).toISOString(), ...(ambiguous ? { ambiguous: true } : {}) };
  }
  if (typeof input.at === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(input.at) && !Number.isNaN(Date.parse(input.at))) {
    return { local: null, timeZone: 'UTC', at: new Date(Date.parse(input.at)).toISOString() };
  }
  throw invalid('Set a date, time, and time zone.');
}
