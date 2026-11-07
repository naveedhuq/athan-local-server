import { access, constants } from 'node:fs/promises';
import path from 'node:path';

const cache = new Map<string, string | null>();

/** Find an executable on PATH (also checks ~/.local/bin where pipx installs). */
export async function which(cmd: string): Promise<string | null> {
  if (cache.has(cmd) && cache.get(cmd)) return cache.get(cmd)!;
  const dirs = [...(process.env.PATH ?? '').split(path.delimiter), path.join(process.env.HOME ?? '', '.local', 'bin')];
  for (const dir of dirs) {
    if (!dir) continue;
    const p = path.join(dir, cmd);
    try {
      await access(p, constants.X_OK);
      cache.set(cmd, p);
      return p;
    } catch {
      /* keep looking */
    }
  }
  cache.set(cmd, null);
  return null;
}
