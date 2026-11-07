#!/usr/bin/env node
// Cross-platform launcher: `node athan.mjs`
// Picks a sensible per-OS data folder, then starts the server.
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function defaultDataDir() {
  const home = os.homedir();
  switch (process.platform) {
    case 'win32':
      return path.join(process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming'), 'Athan');
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', 'Athan');
    default:
      return path.join(process.env.XDG_DATA_HOME ?? path.join(home, '.local', 'share'), 'athan');
  }
}

process.env.DATA_DIR ??= defaultDataDir();
process.env.PORT ??= '8080';
process.env.NODE_ENV ??= 'production';
process.env.WEB_DIR ??= path.join(here, 'web', 'dist');

const major = Number(process.versions.node.split('.')[0]);
if (major < 20) {
  console.error(`Athan needs Node.js 20 or newer (found ${process.versions.node}). Get it from https://nodejs.org`);
  process.exit(1);
}

console.log(`Athan server starting — data folder: ${process.env.DATA_DIR}`);
await import(pathToFileURL(path.join(here, 'server', 'dist', 'index.js')).href);
