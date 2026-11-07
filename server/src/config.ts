import { EventEmitter } from 'node:events';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './paths.js';

import { configSchema, type Config } from './schema.js';

export * from './schema.js';

export const SECRET_MASK = '********';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Deep merge: objects merge key by key, everything else (arrays, scalars, null) replaces. */
export function deepMerge<T>(base: T, patch: unknown): T {
  if (!isObj(base) || !isObj(patch)) return (patch === undefined ? base : patch) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

export class ConfigStore extends EventEmitter {
  private cfg: Config;
  private readonly file: string;

  constructor(file = path.join(DATA_DIR, 'config.json')) {
    super();
    this.file = file;
    this.cfg = this.load();
  }

  private load(): Config {
    if (existsSync(this.file)) {
      try {
        return configSchema.parse(JSON.parse(readFileSync(this.file, 'utf8')));
      } catch (err) {
        console.error('[config] invalid config.json, starting from defaults:', err);
      }
    }
    return configSchema.parse({});
  }

  get(): Config {
    return this.cfg;
  }

  /** Same as get() but with secrets masked, for sending to the browser. */
  getPublic(): Config {
    const c = structuredClone(this.cfg);
    if (c.integrations.mqtt.password) c.integrations.mqtt.password = SECRET_MASK;
    return c;
  }

  /** Validates and saves. Throws a ZodError on invalid input. */
  update(patch: unknown): Config {
    const patchObj = structuredClone(patch) as Record<string, any>;
    // Keep stored secrets when the browser sends the mask back.
    if (patchObj?.integrations?.mqtt?.password === SECRET_MASK) {
      patchObj.integrations.mqtt.password = this.cfg.integrations.mqtt.password;
    }
    const next = configSchema.parse(deepMerge(this.cfg, patchObj));
    this.cfg = next;
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(next, null, 2));
    renameSync(tmp, this.file);
    this.emit('change', next);
    return next;
  }
}
