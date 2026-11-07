import { randomUUID } from 'node:crypto';
import { createWriteStream, existsSync, readFileSync, renameSync, unlinkSync, writeFileSync, statSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { parseFile } from 'music-metadata';
import type { Athan } from './api-types.js';
import { AUDIO_DIR } from './paths.js';

export type { Athan };

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
};
export const MAX_BYTES = 40 * 1024 * 1024;
export const CHIME_ID = 'builtin-chime';
const indexFile = path.join(AUDIO_DIR, 'index.json');

/** A short synthesized chime so the system can be tested before any athan is added. */
export function synthesizeChime(): Buffer {
  const rate = 22050;
  const seconds = 4;
  const n = rate * seconds;
  const pcm = Buffer.alloc(n * 2);
  const notes = [
    { f: 523.25, t: 0.0 },
    { f: 659.25, t: 0.5 },
    { f: 783.99, t: 1.0 },
  ];
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    let v = 0;
    for (const note of notes) {
      const dt = t - note.t;
      if (dt < 0) continue;
      v += Math.sin(2 * Math.PI * note.f * dt) * Math.exp(-dt * 1.6) * 0.3;
    }
    pcm.writeInt16LE(Math.max(-1, Math.min(1, v)) * 32767, i * 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + pcm.length, 4);
  head.write('WAVEfmt ', 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([head, pcm]);
}

export class AthanLibrary {
  private items: Athan[] = [];

  constructor() {
    if (existsSync(indexFile)) {
      try {
        this.items = JSON.parse(readFileSync(indexFile, 'utf8'));
      } catch {
        this.items = [];
      }
    }
    this.items = this.items.filter((a) => existsSync(path.join(AUDIO_DIR, a.filename)));
    if (!this.items.some((a) => a.id === CHIME_ID)) {
      const filename = 'test-chime.wav';
      const buf = synthesizeChime();
      writeFileSync(path.join(AUDIO_DIR, filename), buf);
      this.items.unshift({
        id: CHIME_ID,
        name: 'Test chime',
        muezzin: null,
        filename,
        mime: 'audio/wav',
        durationSec: 4,
        size: buf.length,
        builtin: true,
        addedAt: new Date().toISOString(),
        sourceUrl: null,
      });
    }
    this.save();
  }

  private save() {
    const tmp = `${indexFile}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.items, null, 2));
    renameSync(tmp, indexFile);
  }

  list(): Athan[] {
    return this.items;
  }

  get(id: string | null | undefined): Athan | undefined {
    return id ? this.items.find((a) => a.id === id) : undefined;
  }

  /** The athan to use: explicit choice, else the default, else first user-added, else the chime. */
  resolve(preferred: string | null, fallback: string | null): Athan {
    return this.get(preferred) ?? this.get(fallback) ?? this.items.find((a) => !a.builtin) ?? this.items[0];
  }

  filePath(a: Athan): string {
    return path.join(AUDIO_DIR, a.filename);
  }

  /** Register an audio file that already sits in AUDIO_DIR under `filename`. */
  async register(filename: string, name: string, opts: { muezzin?: string | null; sourceUrl?: string | null } = {}): Promise<Athan> {
    const file = path.join(AUDIO_DIR, filename);
    let durationSec = 0;
    try {
      const meta = await parseFile(file, { duration: true });
      durationSec = Math.round((meta.format.duration ?? 0) * 10) / 10;
    } catch {
      unlinkSync(file);
      throw new Error('That file does not look like playable audio.');
    }
    if (!durationSec) {
      unlinkSync(file);
      throw new Error('Could not determine the audio duration.');
    }
    const item: Athan = {
      id: randomUUID().slice(0, 8),
      name: name.trim() || path.parse(filename).name,
      muezzin: opts.muezzin ?? null,
      filename,
      mime: MIME[path.extname(filename).toLowerCase()] ?? 'application/octet-stream',
      durationSec,
      size: statSync(file).size,
      builtin: false,
      addedAt: new Date().toISOString(),
      sourceUrl: opts.sourceUrl ?? null,
    };
    this.items.push(item);
    this.save();
    return item;
  }

  static extensionOf(name: string): string | null {
    const ext = path.extname(name).toLowerCase();
    return ext in MIME ? ext : null;
  }

  newFilename(ext: string): string {
    return `${randomUUID()}${ext}`;
  }

  async addFromStream(stream: Readable, originalName: string, name?: string): Promise<Athan> {
    const ext = AthanLibrary.extensionOf(originalName);
    if (!ext) throw new Error('Unsupported file type. Use mp3, m4a, aac, wav, ogg or flac.');
    const filename = this.newFilename(ext);
    const file = path.join(AUDIO_DIR, filename);
    try {
      await pipeline(stream, createWriteStream(file));
      if ((stream as any).truncated) throw new Error(`File is larger than ${MAX_BYTES / 1024 / 1024} MB.`);
    } catch (err) {
      if (existsSync(file)) unlinkSync(file);
      throw err;
    }
    return this.register(filename, name || path.parse(originalName).name);
  }

  async addFromUrl(url: string, name?: string, muezzin?: string | null): Promise<Athan> {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http(s) URLs are supported.');
    const res = await fetch(u, { signal: AbortSignal.timeout(60_000), redirect: 'follow' });
    if (!res.ok || !res.body) throw new Error(`Download failed (HTTP ${res.status}).`);
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > MAX_BYTES) throw new Error(`File is larger than ${MAX_BYTES / 1024 / 1024} MB.`);
    const extFromPath = AthanLibrary.extensionOf(u.pathname);
    const ct = res.headers.get('content-type') ?? '';
    const extFromType = Object.entries(MIME).find(([, m]) => ct.startsWith(m))?.[0] ?? (ct.includes('mp3') ? '.mp3' : null);
    const ext = extFromPath ?? extFromType;
    if (!ext) throw new Error('The URL does not point to a supported audio file.');
    const filename = this.newFilename(ext);
    const file = path.join(AUDIO_DIR, filename);
    let bytes = 0;
    const limited = Readable.fromWeb(res.body as any).on('data', (c: Buffer) => {
      bytes += c.length;
      if (bytes > MAX_BYTES) limited.destroy(new Error(`File is larger than ${MAX_BYTES / 1024 / 1024} MB.`));
    });
    try {
      await pipeline(limited, createWriteStream(file));
    } catch (err) {
      if (existsSync(file)) unlinkSync(file);
      throw err;
    }
    return this.register(filename, name || path.parse(u.pathname).name || 'Athan', { muezzin, sourceUrl: url });
  }

  update(id: string, patch: { name?: string; muezzin?: string | null }): Athan {
    const a = this.get(id);
    if (!a) throw new Error('Not found');
    if (a.builtin) throw new Error('The built-in chime cannot be edited.');
    if (patch.name !== undefined && patch.name.trim()) a.name = patch.name.trim().slice(0, 80);
    if (patch.muezzin !== undefined) a.muezzin = patch.muezzin?.trim().slice(0, 80) || null;
    this.save();
    return a;
  }

  remove(id: string): void {
    const a = this.get(id);
    if (!a) throw new Error('Not found');
    if (a.builtin) throw new Error('The built-in chime cannot be deleted.');
    this.items = this.items.filter((x) => x.id !== id);
    try {
      unlinkSync(this.filePath(a));
    } catch {
      /* already gone */
    }
    this.save();
  }
}
