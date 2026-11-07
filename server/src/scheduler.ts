import { EventEmitter } from 'node:events';
import type { AthanLibrary } from './athans.js';
import type { Config, ConfigStore, Prayer } from './config.js';
import { PRAYERS } from './config.js';
import type { EventBus } from './events.js';
import type { Player } from './player.js';
import type { PrayerTimeService } from './prayer/service.js';
import { addDays, dateKey, inQuietWindow, partsInZone } from './prayer/tz.js';
import type { SpeakerRegistry } from './speakers/registry.js';
import { speakerEnabled, type Speaker } from './speakers/types.js';

interface Entry {
  key: string;
  prayer: Prayer;
  at: number;
}

/** How late we may still fire (covers a busy event loop, not a long outage) */
const GRACE_MS = 90_000;

export type SkipReason = 'disabled' | 'paused' | 'prayer-off' | 'day-off' | 'quiet-hours' | 'no-speakers';

export function skipReason(cfg: Config, prayer: Prayer, now: Date, speakers: Speaker[]): SkipReason | null {
  const ps = cfg.prayers[prayer];
  if (!cfg.enabled) return 'disabled';
  if (cfg.pausedUntil && new Date(cfg.pausedUntil) > now) return 'paused';
  if (!ps.enabled) return 'prayer-off';
  const tz = cfg.location?.timezone ?? 'UTC';
  if (!ps.days.includes(partsInZone(now, tz).weekday)) return 'day-off';
  if (ps.respectQuietHours && cfg.quietHours.enabled && inQuietWindow(now, tz, cfg.quietHours.start, cfg.quietHours.end)) return 'quiet-hours';
  if (speakers.length === 0) return 'no-speakers';
  return null;
}

const REASON_TEXT: Record<SkipReason, string> = {
  disabled: 'the athan is switched off',
  paused: 'notifications are paused',
  'prayer-off': 'this prayer is turned off',
  'day-off': 'not scheduled for today',
  'quiet-hours': 'quiet hours',
  'no-speakers': 'no speakers are enabled',
};

export class Scheduler extends EventEmitter {
  private entries: Entry[] = [];
  private fired = new Set<string>();
  private builtAt = 0;
  private builtFor = '';
  private timer?: NodeJS.Timeout;
  private busy = false;

  constructor(
    private readonly store: ConfigStore,
    private readonly times: PrayerTimeService,
    private readonly player: Player,
    private readonly library: AthanLibrary,
    private readonly registry: SpeakerRegistry,
    private readonly bus: EventBus,
  ) {
    super();
    store.on('change', () => (this.builtAt = 0));
  }

  start() {
    this.timer = setInterval(() => void this.tick(), 1000);
    void this.tick();
  }

  stop() {
    clearInterval(this.timer);
  }

  private async rebuild(now: Date) {
    const loc = this.store.get().location;
    this.entries = [];
    if (!loc) return;
    const today = dateKey(now, loc.timezone);
    for (const date of [addDays(today, -1), today, addDays(today, 1)]) {
      const day = await this.times.getDay(date);
      if (!day) continue;
      for (const prayer of PRAYERS) this.entries.push({ key: `${date}:${prayer}`, prayer, at: new Date(day.times[prayer].time).getTime() });
    }
    this.builtAt = Date.now();
    this.builtFor = today;
    this.emit('rebuilt');
  }

  /** Check for due prayers. Exposed for tests. */
  async tick(now = new Date()) {
    if (this.busy) return;
    this.busy = true;
    try {
      const loc = this.store.get().location;
      if (!loc) return;
      if (!this.builtAt || Date.now() - this.builtAt > 30 * 60_000 || this.builtFor !== dateKey(now, loc.timezone)) await this.rebuild(now);
      for (const e of this.entries) {
        if (this.fired.has(e.key) || e.at > now.getTime()) continue;
        this.fired.add(e.key);
        if (now.getTime() - e.at <= GRACE_MS) this.fire(e.prayer, now);
      }
      if (this.fired.size > 50) this.fired = new Set([...this.fired].slice(-20));
    } catch (err) {
      this.bus.log('error', `Scheduler error: ${(err as Error).message}`);
    } finally {
      this.busy = false;
    }
  }

  /** Speakers a prayer would play on right now. */
  targets(prayer: Prayer): Speaker[] {
    const cfg = this.store.get();
    const wanted = cfg.prayers[prayer].speakerIds;
    return this.registry
      .list()
      .filter((s) => speakerEnabled(cfg, s))
      .filter((s) => (wanted.length ? wanted.includes(s.id) : this.registry.isOnline(s)));
  }

  private fire(prayer: Prayer, now: Date) {
    const cfg = this.store.get();
    const targets = this.targets(prayer);
    const reason = skipReason(cfg, prayer, now, targets);
    const label = prayer[0].toUpperCase() + prayer.slice(1);
    if (reason) {
      this.bus.log('skipped', `${label} athan skipped: ${REASON_TEXT[reason]}`, { prayer, reason });
      return;
    }
    const ps = cfg.prayers[prayer];
    this.player.start({ athan: this.library.resolve(ps.athanId, cfg.defaultAthanId), speakers: targets, volume: ps.volume, prayer, trigger: 'schedule' });
  }
}
