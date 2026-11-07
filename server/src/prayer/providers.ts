import { Coordinates, PrayerTimes } from 'adhan';
import type { Config, Location, TimeName } from '../config.js';
import { TIME_NAMES } from '../config.js';
import { aladhanHighLatitude, getMethod, offlineParams } from './methods.js';
import { zonedTime } from './tz.js';

export type SourceId = 'aladhan' | 'offline';
export type RawTimes = Record<TimeName, Date>;
export interface ProviderResult {
  source: SourceId;
  times: RawTimes;
}

export interface CalcInput {
  date: string; // YYYY-MM-DD in the location's zone
  location: Location;
  calc: Config['calculation'];
}

/** Fully offline calculation using adhan-js. Never fails for valid coordinates. */
export function offlineProvider({ date, location, calc }: CalcInput): ProviderResult {
  const [y, m, d] = date.split('-').map(Number);
  // adhan reads Y/M/D from the Date's local components, so build it from the location's calendar day.
  const day = new Date(y, m - 1, d);
  const params = offlineParams(calc.method, calc.madhab, calc.highLatitudeRule, location.latitude);
  const pt = new PrayerTimes(new Coordinates(location.latitude, location.longitude), day, params);
  return {
    source: 'offline',
    times: { fajr: pt.fajr, sunrise: pt.sunrise, dhuhr: pt.dhuhr, asr: pt.asr, maghrib: pt.maghrib, isha: pt.isha },
  };
}

const ALADHAN_KEYS: Record<TimeName, string> = {
  fajr: 'Fajr',
  sunrise: 'Sunrise',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

export function parseAladhanTimings(timings: Record<string, string>, date: string, tz: string): RawTimes {
  const out = {} as RawTimes;
  for (const name of TIME_NAMES) {
    const raw = timings[ALADHAN_KEYS[name]];
    const m = /(\d{1,2}):(\d{2})/.exec(raw ?? '');
    if (!m) throw new Error(`Aladhan response is missing ${name}`);
    out[name] = zonedTime(date, `${m[1].padStart(2, '0')}:${m[2]}`, tz);
  }
  return out;
}

/** Aladhan.com public API (https://aladhan.com/prayer-times-api). */
export async function aladhanProvider(
  { date, location, calc }: CalcInput,
  fetchFn: typeof fetch = fetch,
): Promise<ProviderResult> {
  const [y, m, d] = date.split('-');
  const url = new URL(`https://api.aladhan.com/v1/timings/${d}-${m}-${y}`);
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  url.searchParams.set('method', String(getMethod(calc.method).aladhan));
  url.searchParams.set('school', calc.madhab === 'hanafi' ? '1' : '0');
  url.searchParams.set('timezonestring', location.timezone);
  const lat = aladhanHighLatitude(calc.highLatitudeRule);
  if (lat) url.searchParams.set('latitudeAdjustmentMethod', String(lat));

  const res = await fetchFn(url, { signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Aladhan HTTP ${res.status}`);
  const body = (await res.json()) as { code?: number; data?: { timings?: Record<string, string> } };
  if (!body.data?.timings) throw new Error('Aladhan returned no timings');
  return { source: 'aladhan', times: parseAladhanTimings(body.data.timings, date, location.timezone) };
}
