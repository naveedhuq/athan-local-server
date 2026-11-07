import castv2 from 'castv2-client';
import { firstIPv4, mdns, txtOf } from './mdns.js';
import { sleep, type DriverStatus, type PlayRequest, type Speaker, type SpeakerDriver } from './types.js';

const { Client, DefaultMediaReceiver } = castv2 as any;

const call = <T>(fn: (cb: (err: Error | null, res?: T) => void) => void) =>
  new Promise<T>((resolve, reject) => fn((err, res) => (err ? reject(err) : resolve(res as T))));

export class CastDriver implements SpeakerDriver {
  readonly type = 'cast' as const;
  private browser?: { update(): void; stop(): void };
  private timer?: NodeJS.Timeout;

  async status(): Promise<DriverStatus> {
    return { ok: true };
  }

  start(found: (s: Omit<Speaker, 'lastSeen'>) => void) {
    this.browser = mdns().find({ type: 'googlecast' }, (svc) => {
      const txt = txtOf(svc.txt);
      const id = txt.id;
      if (!id) return;
      found({
        id: `cast:${id}`,
        type: 'cast',
        name: txt.fn || svc.name,
        host: firstIPv4(svc.addresses, svc.host),
        port: svc.port || 8009,
        model: txt.md ?? null,
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
    const client = new Client();
    try {
      await call((cb) => client.connect({ host, port: 8009 }, cb));
    } finally {
      try {
        client.close();
      } catch {
        /* ignore */
      }
    }
    return { id: `cast:manual-${host}`, type: 'cast', name: name || `Cast speaker (${host})`, host, port: 8009, model: null, manual: true };
  }

  async play(sp: Speaker, req: PlayRequest): Promise<void> {
    const client = new Client();
    client.on('error', () => undefined);
    await call((cb) => client.connect({ host: sp.host, port: sp.port }, cb));
    let prevVolume: number | null = null;
    try {
      const vol = await call<{ level?: number }>((cb) => client.getVolume(cb)).catch(() => null);
      if (typeof vol?.level === 'number') prevVolume = vol.level;
      await call((cb) => client.setVolume({ level: req.volume / 100, muted: false }, cb));

      const player = await call<any>((cb) => client.launch(DefaultMediaReceiver, cb));
      const finished = new Promise<void>((resolve) => {
        player.on('status', (s: any) => {
          if (s?.playerState === 'IDLE' && s.idleReason) resolve();
        });
        client.on('close', () => resolve());
      });
      await call((cb) =>
        player.load(
          { contentId: req.url, contentType: req.mime, streamType: 'BUFFERED', metadata: { type: 0, metadataType: 3, title: 'Athan' } },
          { autoplay: true },
          cb,
        ),
      );
      const abort = new Promise<void>((resolve) => req.signal.addEventListener('abort', () => resolve(), { once: true }));
      const timeout = sleep((req.durationSec + 20) * 1000, req.signal);
      await Promise.race([finished, abort, timeout]);
      await call((cb) => client.stop(player, cb)).catch(() => undefined);
    } finally {
      if (prevVolume !== null) await call((cb) => client.setVolume({ level: prevVolume }, cb)).catch(() => undefined);
      try {
        client.close();
      } catch {
        /* ignore */
      }
    }
  }
}
