import { spawn } from 'node:child_process';
import { firstIPv4, mdns, txtOf } from './mdns.js';
import { which } from './which.js';
import type { DriverStatus, PlayRequest, Speaker, SpeakerDriver } from './types.js';

/**
 * AirPlay (HomePod, Apple TV, AirPlay 2 speakers, shairport-sync…).
 * Discovery is pure Node (mDNS); streaming is delegated to pyatv's `atvremote`
 * (install with `pipx install pyatv`) because AirPlay audio streaming has no mature Node library.
 */
export class AirPlayDriver implements SpeakerDriver {
  readonly type = 'airplay' as const;
  private browser?: { update(): void; stop(): void };
  private timer?: NodeJS.Timeout;

  async status(): Promise<DriverStatus> {
    return (await which('atvremote'))
      ? { ok: true }
      : { ok: false, reason: 'AirPlay playback needs pyatv. Install it with: pipx install pyatv' };
  }

  start(found: (s: Omit<Speaker, 'lastSeen'>) => void) {
    this.browser = mdns().find({ type: 'airplay' }, (svc) => {
      const txt = txtOf(svc.txt);
      const model = txt.model ?? txt.am ?? null;
      // Sonos speakers also advertise AirPlay; we control them natively instead.
      if (/sonos/i.test(txt.manufacturer ?? '') || /sonos/i.test(model ?? '')) return;
      const id = txt.deviceid || txt.pi || svc.name;
      found({
        id: `airplay:${id}`,
        type: 'airplay',
        name: svc.name.replace(/\._airplay.*$/, ''),
        host: firstIPv4(svc.addresses, svc.host),
        port: svc.port || 7000,
        model,
      });
    });
    this.timer = setInterval(() => this.rescan(), 60_000);
    return () => {
      clearInterval(this.timer);
      this.browser?.stop();
    };
  }

  rescan() {
    this.browser?.update();
  }

  async probe(host: string, name?: string): Promise<Omit<Speaker, 'lastSeen'>> {
    return { id: `airplay:manual-${host}`, type: 'airplay', name: name || `AirPlay speaker (${host})`, host, port: 7000, model: null, manual: true };
  }

  async play(sp: Speaker, req: PlayRequest): Promise<void> {
    const bin = await which('atvremote');
    if (!bin) throw new Error('pyatv (atvremote) is not installed. Run: pipx install pyatv');
    await new Promise<void>((resolve, reject) => {
      const child = spawn(bin, ['--scan-hosts', sp.host, '--protocol', 'raop', `set_volume=${req.volume}`, `stream_file=${req.file}`], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stderr = '';
      child.stderr.on('data', (d) => (stderr += d));
      const kill = () => child.kill('SIGTERM');
      req.signal.addEventListener('abort', kill, { once: true });
      const guard = setTimeout(kill, (req.durationSec + 45) * 1000);
      child.on('error', reject);
      child.on('close', (code) => {
        clearTimeout(guard);
        req.signal.removeEventListener('abort', kill);
        if (code === 0 || req.signal.aborted) resolve();
        else reject(new Error(stderr.trim().split('\n').pop() || `atvremote exited with code ${code}`));
      });
    });
  }
}
