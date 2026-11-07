import { EventEmitter } from 'node:events';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../paths.js';
import type { Speaker, SpeakerDriver } from './types.js';

const file = path.join(DATA_DIR, 'speakers.json');
/** A speaker counts as online if it was seen within this window */
export const ONLINE_WINDOW_MS = 5 * 60_000;

export class SpeakerRegistry extends EventEmitter {
  private map = new Map<string, Speaker>();
  private stops: Array<() => void> = [];
  readonly drivers = new Map<string, SpeakerDriver>();

  constructor() {
    super();
    if (existsSync(file)) {
      try {
        for (const s of JSON.parse(readFileSync(file, 'utf8')) as Speaker[]) {
          // Remembered speakers start as "not seen" until discovery confirms them.
          if (!s.mock) this.map.set(s.id, { ...s, lastSeen: s.manual ? Date.now() : 0 });
        }
      } catch {
        /* ignore corrupt cache */
      }
    }
  }

  private persist() {
    try {
      writeFileSync(file, JSON.stringify([...this.map.values()].filter((s) => !s.mock), null, 2));
    } catch {
      /* non-fatal */
    }
  }

  upsert(s: Omit<Speaker, 'lastSeen'>) {
    const prev = this.map.get(s.id);
    const next: Speaker = { ...prev, ...s, lastSeen: Date.now() };
    this.map.set(s.id, next);
    const changed = !prev || prev.host !== next.host || prev.name !== next.name || Date.now() - prev.lastSeen > ONLINE_WINDOW_MS || prev.port !== next.port;
    if (changed) {
      this.persist();
      this.emit('change');
    }
  }

  remove(id: string) {
    if (this.map.delete(id)) {
      this.persist();
      this.emit('change');
    }
  }

  get(id: string): Speaker | undefined {
    return this.map.get(id);
  }

  list(): Speaker[] {
    return [...this.map.values()].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  }

  isOnline(s: Speaker): boolean {
    return Date.now() - s.lastSeen < ONLINE_WINDOW_MS;
  }

  register(driver: SpeakerDriver) {
    this.drivers.set(driver.type, driver);
    this.stops.push(driver.start((s) => this.upsert(s)));
  }

  rescan() {
    for (const d of this.drivers.values()) d.rescan();
  }

  stop() {
    for (const s of this.stops) s();
    this.stops = [];
  }
}
