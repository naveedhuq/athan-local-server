import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ConfigStore } from './config.js';
import type { EventBus } from './events.js';
import { DATA_DIR } from './paths.js';
import { hijriLabel, hijriOf, upcomingEvents } from './hijri.js';
import type { PrayerTimeService } from './prayer/service.js';
import { addDays, dateKey, partsInZone, zonedTime } from './prayer/tz.js';
import type { Scheduler } from './scheduler.js';
import type { SpeakerRegistry } from './speakers/registry.js';

export interface SyncResult {
  at: string;
  trigger: 'schedule' | 'manual' | 'catch-up';
  ok: boolean;
  summary: string;
  details: string[];
  durationMs: number;
}

interface Persisted {
  lastRun: SyncResult | null;
  /** local date (YYYY-MM-DD) of the last run that fully succeeded */
  doneDay: string | null;
  lastAttemptAt: number;
}

const file = path.join(DATA_DIR, 'sync.json');
const RETRY_AFTER_MS = 30 * 60_000;
const DISCOVERY_WAIT_MS = 8_000;

/** Should the daily sync run now? Pure so it can be unit-tested. */
export function isSyncDue(now: Date, tz: string, time: string, doneDay: string | null, lastAttemptAt: number): boolean {
  const p = partsInZone(now, tz);
  const [h, m] = time.split(':').map(Number);
  if (p.hour * 60 + p.minute < h * 60 + m) return false; // not yet today
  if (doneDay === dateKey(now, tz)) return false; // already done today
  return now.getTime() - lastAttemptAt >= RETRY_AFTER_MS; // don't hammer after a failure
}

/** Next scheduled run time (ISO) after `now`. */
export function nextSyncAt(now: Date, tz: string, time: string, doneDay: string | null): string {
  const today = dateKey(now, tz);
  const todayAt = zonedTime(today, time, tz);
  if (todayAt > now && doneDay !== today) return todayAt.toISOString();
  return zonedTime(addDays(today, 1), time, tz).toISOString();
}

export class SyncService {
  private state: Persisted = { lastRun: null, doneDay: null, lastAttemptAt: 0 };
  private running = false;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly store: ConfigStore,
    private readonly times: PrayerTimeService,
    private readonly registry: SpeakerRegistry,
    private readonly scheduler: Scheduler,
    private readonly bus: EventBus,
  ) {
    if (existsSync(file)) {
      try {
        this.state = { ...this.state, ...JSON.parse(readFileSync(file, 'utf8')) };
      } catch {
        /* start fresh */
      }
    }
  }

  private persist() {
    try {
      const tmp = `${file}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.state));
      renameSync(tmp, file);
    } catch {
      /* non-fatal */
    }
  }

  private tz(): string {
    return this.store.get().location?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  start() {
    // Check every 30 s; first check shortly after boot so a missed 3 AM run is caught up.
    this.timer = setInterval(() => void this.tick(), 30_000);
    setTimeout(() => void this.tick(), 20_000);
  }

  stop() {
    clearInterval(this.timer);
  }

  private async tick() {
    const cfg = this.store.get();
    if (!cfg.sync.enabled || !cfg.location || this.running) return;
    const now = new Date();
    if (!isSyncDue(now, this.tz(), cfg.sync.time, this.state.doneDay, this.state.lastAttemptAt)) return;
    const missedBy = now.getTime() - zonedTime(dateKey(now, this.tz()), cfg.sync.time, this.tz()).getTime();
    await this.run(missedBy > 10 * 60_000 ? 'catch-up' : 'schedule');
  }

  status() {
    const cfg = this.store.get();
    const tz = this.tz();
    return {
      enabled: cfg.sync.enabled,
      time: cfg.sync.time,
      timezone: tz,
      running: this.running,
      lastRun: this.state.lastRun,
      nextRun: cfg.sync.enabled && cfg.location ? nextSyncAt(new Date(), tz, cfg.sync.time, this.state.doneDay) : null,
    };
  }

  /** Runs one sync. Safe to call while one is running (returns the current status). */
  async run(trigger: SyncResult['trigger'] = 'manual'): Promise<SyncResult | null> {
    if (this.running) return null;
    const cfg = this.store.get();
    const started = Date.now();
    this.running = true;
    this.state.lastAttemptAt = started;
    const details: string[] = [];
    let ok = true;
    try {
      // 1) Prayer times
      if (cfg.location) {
        const today = dateKey(new Date(), cfg.location.timezone);
        const [y, m] = today.split('-').map(Number);
        const start = `${y}-${String(m).padStart(2, '0')}-01`;
        const last = new Date(Date.UTC(y, m - 1 + cfg.sync.monthsAhead + 1, 0));
        const days = Math.round((last.getTime() - Date.UTC(y, m - 1, 1)) / 86_400_000) + 1;
        const mon = (d: Date) => new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d);
        const r = await this.times.refreshRange(start, days);
        const src = r.online ? `${r.online} from Aladhan` : '';
        const off = r.offline ? `${r.offline} calculated offline` : '';
        details.push(`Prayer times ready for ${mon(new Date(Date.UTC(y, m - 1, 1)))} – ${mon(last)} (${r.days} days: ${[src, off].filter(Boolean).join(', ')}).`);
        if (r.onlineFailed) {
          ok = false;
          details.push(`Online source unavailable (${r.firstWarning ?? 'unknown error'}); using offline calculation. Will retry in 30 minutes.`);
        }
      } else {
        details.push('No location set, prayer times skipped.');
      }

      // 2) Speaker discovery
      const before = new Set(this.registry.list().filter((s) => this.registry.isOnline(s)).map((s) => s.id));
      const known = this.registry.list().length;
      this.registry.rescan();
      await new Promise((r) => setTimeout(r, DISCOVERY_WAIT_MS));
      const online = this.registry.list().filter((s) => this.registry.isOnline(s));
      const added = this.registry.list().length - known;
      const back = online.filter((s) => !before.has(s.id)).length;
      details.push(`Speakers: ${online.length} online of ${this.registry.list().length} known${added > 0 ? `, ${added} new` : ''}${back > 0 && added <= 0 ? `, ${back} back online` : ''}.`);

      // 3) Islamic calendar: work out the coming events (no download needed, uses the built-in Umm al-Qura calendar)
      {
        const tzName = this.tz();
        const todayKey = dateKey(new Date(), tzName);
        const adj = cfg.calendar.hijriAdjust;
        const h = hijriOf(todayKey, adj);
        const next = upcomingEvents(todayKey, 3, adj);
        const fmtDay = (d: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
        details.push(`Islamic calendar: today is ${hijriLabel(h)}${adj ? ` (adjusted ${adj > 0 ? '+' : ''}${adj})` : ''}. Next: ${next.map((n) => `${n.event.name} ${fmtDay(n.date)}`).join(', ')}.`);
      }

      // 4) Rebuild the schedule from the fresh times
      this.scheduler.invalidate();
    } catch (err) {
      ok = false;
      details.push(`Error: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }

    const result: SyncResult = {
      at: new Date().toISOString(),
      trigger,
      ok,
      summary: ok ? 'Sync complete' : 'Sync finished with warnings',
      details,
      durationMs: Date.now() - started,
    };
    this.state.lastRun = result;
    if (ok && cfg.location) this.state.doneDay = dateKey(new Date(), cfg.location.timezone);
    else if (ok) this.state.doneDay = dateKey(new Date(), this.tz());
    this.persist();
    this.bus.log('info', `${result.summary}: ${details.join(' ')}`, { sync: true }, ok ? 'info' : 'warn');
    return result;
  }
}
