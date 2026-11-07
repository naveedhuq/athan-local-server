import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { DayTimes, NextPrayer } from '../api-types.js';
import type { Config, ConfigStore, Location, Prayer, TimeName } from '../config.js';
import { PRAYERS, TIME_NAMES } from '../config.js';
import { CACHE_DIR } from '../paths.js';
import { aladhanProvider, offlineProvider, type CalcInput, type ProviderResult, type RawTimes, type SourceId } from './providers.js';
import { addDays, dateKey, zonedTime } from './tz.js';

export type { DayTimes, NextPrayer };

type Provider = (input: CalcInput) => Promise<ProviderResult> | ProviderResult;

const cacheFile = path.join(CACHE_DIR, 'times.json');

export class PrayerTimeService {
  private memory = new Map<string, { source: SourceId; times: Record<TimeName, string> }>();
  /** After the online source fails, skip it for a while so a month view doesn't wait on 30 timeouts. */
  private onlineDownUntil = 0;
  private providers: Record<SourceId, Provider> = { aladhan: aladhanProvider, offline: offlineProvider };

  constructor(private readonly store: ConfigStore, providers?: Partial<Record<SourceId, Provider>>) {
    Object.assign(this.providers, providers);
    this.loadDisk();
  }

  private loadDisk() {
    try {
      if (existsSync(cacheFile)) {
        const data = JSON.parse(readFileSync(cacheFile, 'utf8')) as Record<string, any>;
        for (const [k, v] of Object.entries(data)) this.memory.set(k, v);
      }
    } catch {
      /* cache is optional */
    }
  }

  private saveDisk() {
    // bound the cache: keep the most recent ~800 day entries
    if (this.memory.size > 800) {
      const oldest = [...this.memory.keys()].sort().slice(0, this.memory.size - 800);
      for (const k of oldest) this.memory.delete(k);
    }
    try {
      writeFileSync(cacheFile, JSON.stringify(Object.fromEntries(this.memory)));
    } catch {
      /* ignore */
    }
  }

  private cacheKey(date: string, loc: Location, calc: Config['calculation']) {
    return [date, loc.latitude.toFixed(3), loc.longitude.toFixed(3), calc.method, calc.madhab, calc.highLatitudeRule].join('|');
  }

  /** Raw (pre-offset) times for a calendar day, trying each configured source in order. */
  private async raw(date: string, loc: Location, calc: Config['calculation'], force = false): Promise<{ source: SourceId | 'cache'; times: RawTimes; warnings: string[] }> {
    const key = this.cacheKey(date, loc, calc);
    const hit = this.memory.get(key);
    // An online result is authoritative and cached; offline results are cheap to recompute.
    if (!force && hit && hit.source === 'aladhan') {
      return { source: 'cache', times: revive(hit.times), warnings: [] };
    }
    const warnings: string[] = [];
    for (const src of calc.sources) {
      if (src === 'aladhan' && Date.now() < this.onlineDownUntil) {
        warnings.push('aladhan: unreachable a moment ago, skipped');
        continue;
      }
      try {
        const res = await this.providers[src]({ date, location: loc, calc });
        if (src === 'aladhan') {
          this.onlineDownUntil = 0;
          this.memory.set(key, { source: 'aladhan', times: serialize(res.times) });
          this.saveDisk();
        }
        return { source: res.source, times: res.times, warnings };
      } catch (err) {
        if (src === 'aladhan') this.onlineDownUntil = Date.now() + 2 * 60_000;
        warnings.push(`${src}: ${(err as Error).message}`);
      }
    }
    // Last resort so the scheduler never goes dark.
    const res = offlineProvider({ date, location: loc, calc });
    warnings.push('falling back to offline calculation');
    return { source: res.source, times: res.times, warnings };
  }

  async getDay(date?: string, opts: { force?: boolean } = {}): Promise<DayTimes | null> {
    const cfg = this.store.get();
    const loc = cfg.location;
    if (!loc) return null;
    const day = date ?? dateKey(new Date(), loc.timezone);
    const { source, times, warnings } = await this.raw(day, loc, cfg.calculation, !!opts.force);

    const out = {} as DayTimes['times'];
    for (const name of TIME_NAMES) {
      const fixed = cfg.calculation.fixedTimes[name];
      let when: Date;
      if (fixed) {
        when = zonedTime(day, fixed, loc.timezone);
      } else {
        when = times[name];
        const offset = name === 'sunrise' ? 0 : cfg.prayers[name].offsetMinutes;
        // Offsets are whole minutes; round the base to the minute like a printed timetable would.
        when = new Date(Math.round(when.getTime() / 60000) * 60000 + offset * 60000);
      }
      out[name] = { time: when.toISOString(), fixed: !!fixed };
    }
    return { date: day, timezone: loc.timezone, source, warnings, times: out };
  }

  /**
   * Prepare `days` days from `startKey` (used by the daily sync). The first `forceFirst` days are re-fetched
   * ignoring cached online results; later days are only fetched when missing, to stay gentle on the online API.
   * Reports how many days came from the online source vs. offline calculation.
   */
  async refreshRange(startKey: string, days: number, forceFirst = 35): Promise<{ days: number; online: number; offline: number; onlineFailed: boolean; firstWarning: string | null }> {
    const wantsOnline = this.store.get().calculation.sources.includes('aladhan');
    this.onlineDownUntil = 0; // give the network a fresh chance
    const keys = Array.from({ length: days }, (_, i) => addDays(startKey, i));
    let online = 0;
    let offline = 0;
    let onlineFailed = false;
    let firstWarning: string | null = null;
    let next = 0;
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        while (next < keys.length) {
          const i = next++;
          const day = await this.getDay(keys[i], { force: i < forceFirst });
          if (!day) continue;
          if (day.source === 'aladhan' || day.source === 'cache') online++;
          else offline++;
          if (wantsOnline && day.warnings.length) {
            onlineFailed = true;
            firstWarning ??= day.warnings[0];
          }
        }
      }),
    );
    return { days, online, offline, onlineFailed, firstWarning };
  }

  /** First athan-able prayer strictly after `now`. */
  async next(now = new Date()): Promise<NextPrayer | null> {
    const loc = this.store.get().location;
    if (!loc) return null;
    const today = dateKey(now, loc.timezone);
    for (const date of [addDays(today, -1), today, addDays(today, 1), addDays(today, 2)]) {
      const day = await this.getDay(date);
      if (!day) return null;
      for (const prayer of PRAYERS) {
        const at = day.times[prayer].time;
        if (new Date(at) > now) return { prayer, at, date };
      }
    }
    return null;
  }
}

const serialize = (t: RawTimes) => Object.fromEntries(TIME_NAMES.map((n) => [n, t[n].toISOString()])) as Record<TimeName, string>;
const revive = (t: Record<TimeName, string>) => Object.fromEntries(TIME_NAMES.map((n) => [n, new Date(t[n])])) as RawTimes;
