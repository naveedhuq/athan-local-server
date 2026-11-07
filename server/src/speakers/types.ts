import type { Config } from '../config.js';

import type { Speaker, SpeakerType, DriverStatus } from '../api-types.js';

export type { Speaker, SpeakerType, DriverStatus };

export interface PlayRequest {
  /** http URL the speaker can fetch from this server */
  url: string;
  /** absolute path on this machine (for local / AirPlay tools) */
  file: string;
  mime: string;
  durationSec: number;
  /** 0-100 */
  volume: number;
  signal: AbortSignal;
}

export interface SpeakerDriver {
  readonly type: SpeakerType;
  status(): Promise<DriverStatus>;
  /** Start background discovery; returns a function that stops it. */
  start(found: (s: Omit<Speaker, 'lastSeen'>) => void): () => void;
  /** Ask for an immediate rescan. */
  rescan(): void;
  /** Resolves when playback has finished (or been aborted). Rejects on failure. */
  play(speaker: Speaker, req: PlayRequest): Promise<void>;
  /** Validate and describe a speaker added by IP address. */
  probe?(host: string, name?: string): Promise<Omit<Speaker, 'lastSeen'>>;
}

export const DEFAULT_VOLUME = 40;

export function speakerEnabled(cfg: Config, sp: Speaker): boolean {
  // The Pi's own audio jack is opt-in; network speakers are on by default.
  return cfg.speakers[sp.id]?.enabled ?? sp.type !== 'local';
}
export function speakerVolume(cfg: Config, sp: Speaker): number {
  return cfg.speakers[sp.id]?.volume ?? DEFAULT_VOLUME;
}
export function speakerName(cfg: Config, sp: Speaker): string {
  return cfg.speakers[sp.id]?.nickname || sp.name;
}

export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(done, ms);
    function done() {
      signal?.removeEventListener('abort', done);
      clearTimeout(t);
      resolve();
    }
    signal?.addEventListener('abort', done, { once: true });
  });
