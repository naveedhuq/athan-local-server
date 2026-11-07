import { spawn } from 'node:child_process';
import { which } from './which.js';
import type { DriverStatus, PlayRequest, Speaker, SpeakerDriver } from './types.js';

type Builder = (file: string, volume: number) => string[];
/** Command-line players in order of preference. */
const PLAYERS: Array<{ bin: string; args: Builder; wavOk?: boolean }> = [
  { bin: 'mpv', args: (f, v) => ['--no-video', '--really-quiet', `--volume=${v}`, f], wavOk: true },
  { bin: 'ffplay', args: (f, v) => ['-nodisp', '-autoexit', '-loglevel', 'quiet', '-volume', String(v), f], wavOk: true },
  { bin: 'mpg123', args: (f, v) => ['-q', '-f', String(Math.round((v / 100) * 32768)), f] },
  { bin: 'cvlc', args: (f, v) => ['--play-and-exit', '--no-video', '--gain', String(v / 100), f], wavOk: true },
  { bin: 'paplay', args: (f, v) => [`--volume=${Math.round((v / 100) * 65536)}`, f], wavOk: true },
  { bin: 'aplay', args: (_f) => ['-q', _f], wavOk: true },
];

async function findPlayer(file: string) {
  const isWav = file.toLowerCase().endsWith('.wav');
  for (const p of PLAYERS) {
    if (isWav && !p.wavOk) continue;
    const bin = await which(p.bin);
    if (bin) return { bin, build: p.args };
  }
  return null;
}

/** Plays through the Raspberry Pi's own audio output (3.5mm, HDMI, USB DAC, Bluetooth…). */
export class LocalDriver implements SpeakerDriver {
  readonly type = 'local' as const;

  async status(): Promise<DriverStatus> {
    for (const p of PLAYERS) if (await which(p.bin)) return { ok: true };
    return { ok: false, reason: 'No audio player found. Install one with: sudo apt install mpv' };
  }

  start(found: (s: Omit<Speaker, 'lastSeen'>) => void) {
    const announce = () => found({ id: 'local:this-device', type: 'local', name: 'This device (Pi audio output)', host: 'localhost', port: 0, model: 'Local audio' });
    announce();
    const t = setInterval(announce, 60_000);
    return () => clearInterval(t);
  }

  rescan() {
    /* always present */
  }

  async play(_sp: Speaker, req: PlayRequest): Promise<void> {
    const player = await findPlayer(req.file);
    if (!player) throw new Error('No audio player installed. Run: sudo apt install mpv');
    await new Promise<void>((resolve, reject) => {
      const child = spawn(player.bin, player.build(req.file, req.volume), { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', (d) => (stderr += d));
      const kill = () => child.kill('SIGTERM');
      req.signal.addEventListener('abort', kill, { once: true });
      const guard = setTimeout(kill, (req.durationSec + 30) * 1000);
      child.on('error', reject);
      child.on('close', (code) => {
        clearTimeout(guard);
        req.signal.removeEventListener('abort', kill);
        if (code === 0 || req.signal.aborted) resolve();
        else reject(new Error(stderr.trim().split('\n').pop() || `${player.bin} exited with code ${code}`));
      });
    });
  }
}
