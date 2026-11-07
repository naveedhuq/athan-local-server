import { EventEmitter } from 'node:events';
import type { PlayerState } from './api-types.js';
import type { Athan, AthanLibrary } from './athans.js';
import type { ConfigStore, Prayer } from './config.js';
import type { EventBus } from './events.js';
import { baseUrl } from './net.js';
import { mockDriver } from './speakers/mock.js';
import type { SpeakerRegistry } from './speakers/registry.js';
import { speakerName, speakerVolume, type Speaker } from './speakers/types.js';

export type { PlayerState };

const IDLE: PlayerState = { status: 'idle', prayer: null, trigger: null, athan: null, speakers: [], startedAt: null, endsAt: null };

export interface PlayOptions {
  athan: Athan;
  speakers: Speaker[];
  /** null = each speaker's own volume */
  volume: number | null;
  prayer: Prayer | null;
  trigger: 'schedule' | 'manual';
}

export class Player extends EventEmitter {
  private state: PlayerState = IDLE;
  private abort: AbortController | null = null;

  constructor(
    private readonly store: ConfigStore,
    private readonly registry: SpeakerRegistry,
    private readonly library: AthanLibrary,
    private readonly bus: EventBus,
    private readonly port: number,
  ) {
    super();
  }

  getState(): PlayerState {
    return this.state;
  }

  private set(state: PlayerState) {
    this.state = state;
    this.emit('state', state);
  }

  /** Starts playback and returns immediately; completion is reported through events. */
  start(opts: PlayOptions): PlayerState {
    if (this.state.status === 'playing') this.stop();
    const cfg = this.store.get();
    const abort = new AbortController();
    this.abort = abort;
    const now = Date.now();
    const label = opts.prayer ? opts.prayer[0].toUpperCase() + opts.prayer.slice(1) : 'Test';
    const names = opts.speakers.map((s) => speakerName(cfg, s));

    this.set({
      status: 'playing',
      prayer: opts.prayer,
      trigger: opts.trigger,
      athan: { id: opts.athan.id, name: opts.athan.name },
      speakers: opts.speakers.map((s) => ({ id: s.id, name: speakerName(cfg, s), state: 'playing' })),
      startedAt: new Date(now).toISOString(),
      endsAt: new Date(now + opts.athan.durationSec * 1000).toISOString(),
    });
    this.bus.log('started', `${label} athan “${opts.athan.name}” on ${names.join(', ') || 'no speakers'}`, {
      prayer: opts.prayer,
      athan: opts.athan.name,
      speakers: names,
      trigger: opts.trigger,
    });

    const url = `${baseUrl(cfg, this.port)}/audio/${encodeURIComponent(opts.athan.filename)}`;
    const file = this.library.filePath(opts.athan);

    const runs = opts.speakers.map(async (sp) => {
      const volume = opts.volume ?? speakerVolume(cfg, sp);
      const req = { url, file, mime: opts.athan.mime, durationSec: opts.athan.durationSec, volume, signal: abort.signal };
      try {
        if (sp.mock) await mockDriver.play(sp, req);
        else {
          const driver = this.registry.drivers.get(sp.type);
          if (!driver) throw new Error(`No driver for ${sp.type}`);
          await driver.play(sp, req);
        }
        this.mark(sp.id, 'done');
      } catch (err) {
        const msg = (err as Error).message || String(err);
        this.mark(sp.id, 'error', msg);
        this.bus.log('error', `${speakerName(cfg, sp)}: ${msg}`, { speaker: speakerName(cfg, sp), prayer: opts.prayer });
      }
    });

    void Promise.all(runs).then(() => {
      if (this.abort !== abort) return; // superseded by a newer playback
      this.abort = null;
      const aborted = abort.signal.aborted;
      this.set({ ...IDLE });
      if (!aborted) this.bus.log('finished', `${label} athan finished`, { prayer: opts.prayer, athan: opts.athan.name, speakers: names });
    });
    return this.state;
  }

  private mark(id: string, st: 'done' | 'error', error?: string) {
    if (this.state.status !== 'playing') return;
    this.set({ ...this.state, speakers: this.state.speakers.map((s) => (s.id === id ? { ...s, state: st, error } : s)) });
  }

  stop() {
    if (this.abort) {
      this.abort.abort();
      this.abort = null;
      this.set({ ...IDLE });
      this.bus.log('info', 'Playback stopped');
    }
  }
}
