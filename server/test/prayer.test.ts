import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ConfigStore, deepMerge } from '../src/config.js';
import { offlineProvider, parseAladhanTimings } from '../src/prayer/providers.js';
import { PrayerTimeService } from '../src/prayer/service.js';
import { addDays, dateKey, inQuietWindow, zonedTime } from '../src/prayer/tz.js';
import { makeLocation } from '../src/location.js';
import { isSyncDue, nextSyncAt } from '../src/sync.js';

const nyc = makeLocation('New York', 40.7128, -74.006, 'US');
const calc = { sources: ['offline' as const], method: 'isna', madhab: 'shafi' as const, highLatitudeRule: 'auto' as const, fixedTimes: {} };

const tmpStore = () => new ConfigStore(path.join(mkdtempSync(path.join(tmpdir(), 'athan-')), 'config.json'));

describe('time zones', () => {
  it('converts wall-clock to instants across DST', () => {
    expect(zonedTime('2026-07-01', '12:00', 'America/New_York').toISOString()).toBe('2026-07-01T16:00:00.000Z');
    expect(zonedTime('2026-01-01', '12:00', 'America/New_York').toISOString()).toBe('2026-01-01T17:00:00.000Z');
    expect(zonedTime('2026-03-08', '12:00', 'America/New_York').toISOString()).toBe('2026-03-08T16:00:00.000Z');
  });
  it('computes date keys and day math', () => {
    expect(dateKey(new Date('2026-07-01T02:00:00Z'), 'America/New_York')).toBe('2026-06-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('handles quiet windows that wrap midnight', () => {
    const at = (iso: string) => inQuietWindow(new Date(iso), 'UTC', '22:00', '06:00');
    expect(at('2026-01-01T23:30:00Z')).toBe(true);
    expect(at('2026-01-01T05:59:00Z')).toBe(true);
    expect(at('2026-01-01T06:00:00Z')).toBe(false);
    expect(at('2026-01-01T12:00:00Z')).toBe(false);
  });
});

describe('offline provider', () => {
  it('produces ordered, plausible times for New York in summer', () => {
    const { times } = offlineProvider({ date: '2026-07-01', location: nyc, calc });
    const order = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
    for (let i = 1; i < order.length; i++) expect(times[order[i]].getTime()).toBeGreaterThan(times[order[i - 1]].getTime());
    // Dhuhr in NYC on July 1 is about 1:00 pm EDT (17:00 UTC)
    expect(Math.abs(times.dhuhr.getTime() - Date.parse('2026-07-01T17:00:00Z'))).toBeLessThan(15 * 60000);
  });
  it('gives the same answer regardless of the host time zone', () => {
    const a = offlineProvider({ date: '2026-07-01', location: nyc, calc }).times.fajr.toISOString();
    expect(a).toMatch(/^2026-07-01T0[7-9]:|^2026-07-01T0[0-9]:/);
  });
});

describe('aladhan parsing', () => {
  it('reads HH:mm and "HH:mm (TZ)" values in the location zone', () => {
    const t = parseAladhanTimings({ Fajr: '04:01 (EDT)', Sunrise: '05:30', Dhuhr: '13:00', Asr: '16:55', Maghrib: '20:30', Isha: '22:00' }, '2026-07-01', 'America/New_York');
    expect(t.fajr.toISOString()).toBe('2026-07-01T08:01:00.000Z');
    expect(() => parseAladhanTimings({}, '2026-07-01', 'UTC')).toThrow();
  });
});

describe('PrayerTimeService', () => {
  it('falls back to offline when the online source fails, and applies offsets + fixed times', async () => {
    const store = tmpStore();
    store.update({ location: nyc, calculation: { sources: ['aladhan', 'offline'], method: 'isna' }, prayers: { asr: { offsetMinutes: 10 } } });
    const svc = new PrayerTimeService(store, { aladhan: () => Promise.reject(new Error('offline')) });
    const base = offlineProvider({ date: '2026-07-01', location: nyc, calc }).times.asr.getTime();
    const day = await svc.getDay('2026-07-01');
    expect(day?.source).toBe('offline');
    expect(day?.warnings[0]).toContain('aladhan');
    expect(new Date(day!.times.asr.time).getTime()).toBe(Math.round(base / 60000) * 60000 + 10 * 60000);

    store.update({ calculation: { fixedTimes: { isha: '21:45' } } });
    const fixed = await svc.getDay('2026-07-01');
    expect(fixed?.times.isha).toEqual({ time: '2026-07-02T01:45:00.000Z', fixed: true });
  });

  it('stops retrying the online source for a while after it fails', async () => {
    const store = tmpStore();
    store.update({ location: nyc, calculation: { sources: ['aladhan', 'offline'], method: 'isna' } });
    let calls = 0;
    const svc = new PrayerTimeService(store, { aladhan: () => { calls++; return Promise.reject(new Error('down')); } });
    for (const d of ['2026-07-01', '2026-07-02', '2026-07-03']) await svc.getDay(d);
    expect(calls).toBe(1);
  });

  it('finds the next prayer, rolling over to tomorrow after Isha', async () => {
    const store = tmpStore();
    store.update({ location: nyc, calculation: { sources: ['offline'], method: 'isna' } });
    const svc = new PrayerTimeService(store);
    const noon = await svc.next(new Date('2026-07-01T17:30:00Z'));
    expect(noon?.prayer).toBe('asr');
    const late = await svc.next(new Date('2026-07-02T03:30:00Z')); // 11:30pm local
    expect(late?.prayer).toBe('fajr');
    expect(late?.date).toBe('2026-07-02');
  });
});

describe('config', () => {
  it('fills defaults, merges patches deeply and validates', () => {
    const store = tmpStore();
    expect(store.get().prayers.fajr.enabled).toBe(true);
    store.update({ prayers: { fajr: { enabled: false } } });
    expect(store.get().prayers.fajr.enabled).toBe(false);
    expect(store.get().prayers.dhuhr.enabled).toBe(true);
    expect(() => store.update({ quietHours: { start: '25:00' } })).toThrow();
    expect(deepMerge({ a: { b: 1, c: [1] } }, { a: { c: [2, 3] } })).toEqual({ a: { b: 1, c: [2, 3] } });
  });
  it('masks and preserves the MQTT password', () => {
    const store = tmpStore();
    store.update({ integrations: { mqtt: { password: 'secret' } } });
    expect(store.getPublic().integrations.mqtt.password).toBe('********');
    store.update({ integrations: { mqtt: { password: '********', username: 'u' } } });
    expect(store.get().integrations.mqtt.password).toBe('secret');
  });
});

describe('daily sync', () => {
  const tz = 'America/New_York';
  const at = (iso: string) => new Date(iso);
  it('is not due before the configured local time', () => {
    expect(isSyncDue(at('2026-07-01T06:59:00Z'), tz, '03:00', null, 0)).toBe(false); // 02:59 local
  });
  it('is due after the time if not yet done today, and catches up later in the day', () => {
    expect(isSyncDue(at('2026-07-01T07:00:00Z'), tz, '03:00', null, 0)).toBe(true); // 03:00 local
    expect(isSyncDue(at('2026-07-01T20:00:00Z'), tz, '03:00', '2026-06-30', 0)).toBe(true); // 16:00, missed
  });
  it('is not due once done today, and waits 30 min after a failed attempt', () => {
    expect(isSyncDue(at('2026-07-01T20:00:00Z'), tz, '03:00', '2026-07-01', 0)).toBe(false);
    const attempt = at('2026-07-01T07:00:00Z').getTime();
    expect(isSyncDue(at('2026-07-01T07:10:00Z'), tz, '03:00', null, attempt)).toBe(false);
    expect(isSyncDue(at('2026-07-01T07:31:00Z'), tz, '03:00', null, attempt)).toBe(true);
  });
  it('computes the next run in the location time zone', () => {
    expect(nextSyncAt(at('2026-07-01T05:00:00Z'), tz, '03:00', null)).toBe('2026-07-01T07:00:00.000Z');
    expect(nextSyncAt(at('2026-07-01T09:00:00Z'), tz, '03:00', '2026-07-01')).toBe('2026-07-02T07:00:00.000Z');
  });
  it('force-refreshes online times instead of using the cache', async () => {
    const store = tmpStore();
    store.update({ location: nyc, calculation: { sources: ['aladhan', 'offline'], method: 'isna' } });
    let calls = 0;
    const svc = new PrayerTimeService(store, { aladhan: (i) => { calls++; return offlineProvider(i) && { ...offlineProvider(i), source: 'aladhan' as const }; } });
    await svc.getDay('2026-07-01');
    await svc.getDay('2026-07-01');
    expect(calls).toBe(1); // second read came from cache
    const r = await svc.refreshRange('2026-07-01', 3);
    expect(calls).toBe(4); // 1 + three forced fetches
    expect(r).toMatchObject({ days: 3, online: 3, offline: 0, onlineFailed: false });
  });

  it('only force-refreshes the first days of a long range and fills the rest from cache', async () => {
    const store = tmpStore();
    store.update({ location: nyc, calculation: { sources: ['aladhan', 'offline'], method: 'karachi' } });
    let calls = 0;
    const svc = new PrayerTimeService(store, { aladhan: (i) => { calls++; return { ...offlineProvider(i), source: 'aladhan' as const }; } });
    for (const d of ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04']) await svc.getDay(d);
    expect(calls).toBe(4);
    await svc.refreshRange('2026-07-01', 4, 2); // 2 forced, 2 served from cache
    expect(calls).toBe(6);
    await svc.refreshRange('2026-07-01', 6, 2); // 2 forced + 2 new days fetched, 2 cached
    expect(calls).toBe(10);
  });
});
