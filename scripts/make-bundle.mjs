#!/usr/bin/env node
// Builds a self-contained, cross-platform release bundle in ./release/athan-server
// (pure JavaScript dependencies, so the same bundle runs on Windows, macOS and Linux with Node 20+).
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'release', 'athan-server');
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit' });

if (!process.argv.includes('--skip-build')) run('npm run build');

rmSync(path.join(root, 'release'), { recursive: true, force: true });
mkdirSync(path.join(out, 'server'), { recursive: true });
mkdirSync(path.join(out, 'web'), { recursive: true });

cpSync(path.join(root, 'package.json'), path.join(out, 'package.json'));
cpSync(path.join(root, 'package-lock.json'), path.join(out, 'package-lock.json'));
cpSync(path.join(root, 'server', 'package.json'), path.join(out, 'server', 'package.json'));
cpSync(path.join(root, 'web', 'package.json'), path.join(out, 'web', 'package.json'));
cpSync(path.join(root, 'server', 'dist'), path.join(out, 'server', 'dist'), { recursive: true });
cpSync(path.join(root, 'web', 'dist'), path.join(out, 'web', 'dist'), { recursive: true });
cpSync(path.join(root, 'scripts', 'launcher.mjs'), path.join(out, 'athan.mjs'));
cpSync(path.join(root, 'deploy', 'service'), path.join(out, 'service'), { recursive: true });
cpSync(path.join(root, 'LICENSE'), path.join(out, 'LICENSE'));
writeFileSync(
  path.join(out, 'README.txt'),
  'Athan Server\n\nStart:    node athan.mjs   (or start.sh / start.cmd)\nAuto-start: see the service/ folder\nDocs:     https://github.com/naveedhuq/athan-local-server#readme\nLicense:  MIT (see LICENSE)\n',
);

// The bundle's root package.json must not try to build anything.
const pkg = JSON.parse(readFileSync(path.join(out, 'package.json'), 'utf8'));
pkg.scripts = { start: 'node athan.mjs' };
delete pkg.devDependencies;
writeFileSync(path.join(out, 'package.json'), JSON.stringify(pkg, null, 2));

run('npm ci --omit=dev --workspaces --include-workspace-root --ignore-scripts', out);

writeFileSync(path.join(out, 'start.sh'), '#!/usr/bin/env sh\ncd "$(dirname "$0")" && exec node athan.mjs\n', { mode: 0o755 });
writeFileSync(path.join(out, 'start.cmd'), '@echo off\r\ncd /d "%~dp0"\r\nnode athan.mjs\r\n');

console.log(`\nBundle ready: ${out}`);
