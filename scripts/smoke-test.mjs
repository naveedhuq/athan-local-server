#!/usr/bin/env node
// Starts the built bundle (release/athan-server) and checks it serves the API and the web UI.
// Works on Linux, macOS and Windows.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'release', 'athan-server');
const port = 18080 + Math.floor(Math.random() * 500);
const data = mkdtempSync(path.join(os.tmpdir(), 'athan-smoke-'));

const child = spawn(process.execPath, ['athan.mjs'], { cwd: dir, env: { ...process.env, PORT: String(port), DATA_DIR: data }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
child.stdout.on('data', (d) => (log += d));
child.stderr.on('data', (d) => (log += d));

const get = async (p) => (await fetch(`http://127.0.0.1:${port}${p}`, { signal: AbortSignal.timeout(3000) }));
let ok = false;
for (let i = 0; i < 40 && !ok; i++) {
  await new Promise((r) => setTimeout(r, 500));
  try {
    ok = (await get('/api/health')).ok;
  } catch {
    /* not up yet */
  }
}
let failure = null;
try {
  if (!ok) throw new Error('server did not become healthy');
  const sys = await (await get('/api/system')).json();
  if (!sys.version) throw new Error('/api/system returned no version');
  const html = await (await get('/')).text();
  if (!html.includes('<div id="root">')) throw new Error('web UI was not served');
  for (const f of ['/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/apple-touch-icon.png', '/favicon.ico', '/icon.svg']) {
    const r = await get(f);
    if (!r.ok) throw new Error(`${f} was not served`);
  }
  const audio = await get('/audio/test-chime.wav');
  if (!audio.ok) throw new Error('built-in chime was not served');
} catch (e) {
  failure = e;
}
child.kill();
if (failure) {
  console.error(`SMOKE TEST FAILED: ${failure.message}\n--- server log ---\n${log}`);
  process.exit(1);
}
console.log(`Smoke test passed on ${process.platform} (port ${port}).`);
process.exit(0);
