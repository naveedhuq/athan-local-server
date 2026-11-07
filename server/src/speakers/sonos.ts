import sonosLib from 'sonos';
import { sleep, type DriverStatus, type PlayRequest, type Speaker, type SpeakerDriver } from './types.js';

const { Sonos, DeviceDiscovery } = sonosLib as any;

const uuidOf = (udn: string) => String(udn).replace(/^uuid:/, '');

async function describe(host: string, port = 1400) {
  const dev = new Sonos(host, port);
  const d = await dev.deviceDescription();
  const uuid = uuidOf(d.UDN);
  return {
    id: `sonos:${uuid}`,
    type: 'sonos' as const,
    name: String(d.roomName || d.friendlyName || host),
    host,
    port,
    model: d.modelName ? String(d.modelName) : null,
  };
}

export class SonosDriver implements SpeakerDriver {
  readonly type = 'sonos' as const;
  private timer?: NodeJS.Timeout;
  private found?: (s: Omit<Speaker, 'lastSeen'>) => void;
  /** group coordinator host -> playback in progress (several members of one group share one stream) */
  private inflight = new Map<string, Promise<void>>();

  async status(): Promise<DriverStatus> {
    return { ok: true };
  }

  start(found: (s: Omit<Speaker, 'lastSeen'>) => void) {
    this.found = found;
    this.rescan();
    this.timer = setInterval(() => this.rescan(), 2 * 60_000);
    return () => clearInterval(this.timer);
  }

  rescan() {
    const found = this.found;
    if (!found) return;
    try {
      const d = new DeviceDiscovery({ timeout: 6000 });
      d.on('DeviceAvailable', (dev: any) => {
        describe(dev.host, dev.port).then(found).catch(() => undefined);
      });
      d.on('error', () => undefined);
      setTimeout(() => {
        try {
          d.destroy();
        } catch {
          /* already closed */
        }
      }, 7000);
    } catch {
      /* multicast unavailable */
    }
  }

  async probe(host: string): Promise<Omit<Speaker, 'lastSeen'>> {
    return { ...(await describe(host)), manual: true };
  }

  async play(sp: Speaker, req: PlayRequest): Promise<void> {
    const member = new Sonos(sp.host, sp.port);
    const myUuid = sp.id.replace(/^sonos:/, '');
    // Audio has to be started on the group coordinator.
    let coordinator = member;
    let coordHost = sp.host;
    try {
      const groups: any[] = await member.getAllGroups();
      const group = groups.find((g) => g.ZoneGroupMember.some((m: any) => m.UUID === myUuid));
      if (group?.host && group.host !== sp.host) {
        coordinator = new Sonos(group.host, group.port);
        coordHost = group.host;
      }
    } catch {
      /* single speaker or topology unavailable: use the speaker directly */
    }

    const prevVolume: number | null = await member.getVolume().catch(() => null);
    await member.setVolume(req.volume);

    const running = this.inflight.get(coordHost);
    const run =
      running ??
      this.playOnCoordinator(coordinator, req).finally(() => {
        this.inflight.delete(coordHost);
      });
    if (!running) this.inflight.set(coordHost, run);
    try {
      await run;
    } finally {
      if (prevVolume !== null) await member.setVolume(prevVolume).catch(() => undefined);
    }
  }

  private async playOnCoordinator(dev: any, req: PlayRequest): Promise<void> {
    // Snapshot what was playing so we can resume it afterwards.
    const wasState: string = await dev.getCurrentState().catch(() => 'stopped');
    const wasPlaying = wasState === 'playing' || wasState === 'transitioning';
    const av = dev.avTransportService();
    const media = await av.GetMediaInfo().catch(() => null);
    const pos = await av.GetPositionInfo().catch(() => null);

    await dev.setAVTransportURI(req.url);

    const startedAt = Date.now();
    let started = false;
    while (!req.signal.aborted) {
      await sleep(1000, req.signal);
      const st: string = await dev.getCurrentState().catch(() => 'unknown');
      const elapsed = (Date.now() - startedAt) / 1000;
      if (st === 'playing' || st === 'transitioning') started = true;
      else if ((started && elapsed > 2) || elapsed > 12) break;
      if (elapsed > req.durationSec + 20) break;
    }
    if (req.signal.aborted) await dev.stop().catch(() => undefined);

    // Put things back the way they were.
    try {
      if (media?.CurrentURI) {
        await dev.setAVTransportURI({ uri: media.CurrentURI, metadata: media.CurrentURIMetaData, onlySetUri: true });
        if (pos?.Track && pos.Track > 1 && media.NrTracks > 1) await dev.selectTrack(pos.Track).catch(() => undefined);
        if (pos?.RelTime && pos.TrackDuration && pos.TrackDuration !== '0:00:00') {
          await av.Seek({ InstanceID: 0, Unit: 'REL_TIME', Target: pos.RelTime }).catch(() => undefined);
        }
        if (wasPlaying) await dev.play();
      }
    } catch {
      /* best effort */
    }
  }
}
