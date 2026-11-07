import { access, constants } from 'node:fs/promises';
import path from 'node:path';

const cache = new Map<string, string | null>();
const isWin = process.platform === 'win32';

/** Find an executable on PATH (also checks ~/.local/bin where pipx installs). Works on Windows (PATHEXT). */
export async function which(cmd: string): Promise<string | null> {
  if (cache.get(cmd)) return cache.get(cmd)!;
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  const dirs = [...(process.env.PATH ?? process.env.Path ?? '').split(path.delimiter), path.join(home, '.local', 'bin')];
  const exts = isWin ? ['', ...(process.env.PATHEXT ?? '.EXE;.CMD;.BAT').toLowerCase().split(';')] : [''];
  for (const dir of dirs) {
    if (!dir) continue;
    for (const ext of exts) {
      const p = path.join(dir, cmd + ext);
      try {
        await access(p, isWin ? constants.F_OK : constants.X_OK);
        cache.set(cmd, p);
        return p;
      } catch {
        /* keep looking */
      }
    }
  }
  cache.set(cmd, null);
  return null;
}
