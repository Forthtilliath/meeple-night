const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$|^(\d{2})\/(\d{2})\/(\d{4})$/;
const TIME_PATTERN = /^(\d{1,2})[:h](\d{2})?$/i;

/** Offset (ms) between the given timezone's wall clock and UTC at a given instant. */
function timezoneOffset(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wallClock = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return wallClock - instant.getTime();
}

/**
 * Parses a date ("2026-10-24" or "24/10/2026") and a time ("20:30", "20h30", "20h")
 * typed in the given timezone. Returns null when the input is invalid.
 */
export function parseLocalDateTime(date: string, time: string, timeZone: string): Date | null {
  const d = DATE_PATTERN.exec(date.trim());
  const t = TIME_PATTERN.exec(time.trim());
  if (!d || !t) return null;
  const year = Number(d[1] ?? d[6]);
  const month = Number(d[2] ?? d[5]);
  const day = Number(d[3] ?? d[4]);
  const hour = Number(t[1]);
  const minute = Number(t[2] ?? 0);
  if (hour > 23 || minute > 59) return null;

  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(asUtc);
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;

  // Two passes handle instants close to a DST change.
  let result = asUtc - timezoneOffset(new Date(asUtc), timeZone);
  result = asUtc - timezoneOffset(new Date(result), timeZone);
  return new Date(result);
}

/** Wall-clock date ("2026-10-24") and time ("20:30") of an instant in a timezone. */
export function localDateTime(instant: Date, timeZone: string): { date: string; time: string } {
  const local = new Date(instant.getTime() + timezoneOffset(instant, timeZone));
  const iso = local.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** Same wall-clock time `days` later in the timezone, whatever DST changes in between. */
export function addLocalDays(instant: Date, days: number, timeZone: string): Date {
  const { date, time } = localDateTime(instant, timeZone);
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return parseLocalDateTime(shifted.toISOString().slice(0, 10), time, timeZone) ?? instant;
}

export function isValidTimezone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Discord timestamp markup, rendered in each viewer's own locale and timezone. */
export function discordTimestamp(date: Date, style: 'F' | 'R' | 'f' | 't' | 'd' = 'F'): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}
