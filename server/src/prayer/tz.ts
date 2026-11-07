/** Time-zone helpers built on Intl so we never depend on the Pi's own TZ setting. */

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday */
  weekday: number;
}

export function partsInZone(date: Date, tz: string): Parts {
  const o: Record<string, number> = {};
  for (const p of fmt(tz).formatToParts(date)) if (p.type !== 'literal') o[p.type] = Number(p.value);
  const weekday = new Date(Date.UTC(o.year, o.month - 1, o.day)).getUTCDay();
  return { year: o.year, month: o.month, day: o.day, hour: o.hour, minute: o.minute, second: o.second, weekday };
}

/** "YYYY-MM-DD" of the given instant in the zone. */
export function dateKey(date: Date, tz: string): string {
  const p = partsInZone(date, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Wall-clock time in a zone -> absolute instant. */
export function zonedTime(key: string, hhmm: string, tz: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, h, mi);
  let guess = wall;
  for (let i = 0; i < 3; i++) {
    const p = partsInZone(new Date(guess), tz);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess += wall - asUtc;
  }
  return new Date(guess);
}

/** Is `now` inside a [start, end) quiet window (may wrap midnight)? */
export function inQuietWindow(now: Date, tz: string, start: string, end: string): boolean {
  const p = partsInZone(now, tz);
  const cur = p.hour * 60 + p.minute;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  if (s === e) return false;
  return s < e ? cur >= s && cur < e : cur >= s || cur < e;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
