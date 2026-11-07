import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Where config, speaker cache and audio files live. Override with DATA_DIR. */
export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(here, '..', '..', 'data'));
export const AUDIO_DIR = path.join(DATA_DIR, 'athans');
export const CACHE_DIR = path.join(DATA_DIR, 'cache');
/** Built React app (web/dist). Override with WEB_DIR. */
export const WEB_DIR = path.resolve(process.env.WEB_DIR ?? path.join(here, '..', '..', 'web', 'dist'));

for (const dir of [DATA_DIR, AUDIO_DIR, CACHE_DIR]) mkdirSync(dir, { recursive: true });
