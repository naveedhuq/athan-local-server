import type { FastifyInstance } from 'fastify';
import os from 'node:os';
import { z, ZodError } from 'zod';
import { MAX_BYTES } from './athans.js';
import { CATALOG } from './catalog.js';
import { ART_KINDS, PRAYERS, type Prayer } from './config.js';
import type { AppContext } from './context.js';
import { locateByIp, makeLocation, searchPlaces } from './location.js';
import { lanAddress, baseUrl } from './net.js';
import { DATA_DIR } from './paths.js';
import { METHODS } from './prayer/methods.js';
import { isValidTimeZone } from './prayer/tz.js';
import { which } from './speakers/which.js';
import { speakerEnabled, speakerName, speakerVolume, type Speaker } from './speakers/types.js';

const httpError = (statusCode: number, message: string) => Object.assign(new Error(message), { statusCode });

export async function registerApi(app: FastifyInstance, ctx: AppContext) {
  const { store, bus, times, library, registry, player, scheduler } = ctx;

  app.setErrorHandler((err: any, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: err.issues.map((i) => `${i.path.join('.') || 'value'}: ${i.message}`).join('; ') });
    }
    const status = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    if (status === 500) app.log.error(err);
    return reply.status(status).send({ error: err.message || 'Unexpected error' });
  });

  const speakerView = async (s: Speaker) => {
    const cfg = store.get();
    return {
      ...s,
      online: registry.isOnline(s),
      displayName: speakerName(cfg, s),
      enabled: speakerEnabled(cfg, s),
      volume: speakerVolume(cfg, s),
      nickname: cfg.speakers[s.id]?.nickname ?? null,
      art: cfg.speakers[s.id]?.art ?? null,
    };
  };

  app.get('/api/health', async () => ({ ok: true, version: ctx.version }));

  /* ───────────── dashboard state ───────────── */
  app.get('/api/state', async () => {
    const cfg = store.get();
    const [today, next] = await Promise.all([times.getDay(), times.next()]);
    return {
      now: new Date().toISOString(),
      configured: !!cfg.location,
      enabled: cfg.enabled,
      pausedUntil: cfg.pausedUntil && new Date(cfg.pausedUntil) > new Date() ? cfg.pausedUntil : null,
      location: cfg.location,
      today,
      next,
      player: player.getState(),
      speakerCount: registry.list().filter((s) => speakerEnabled(cfg, s)).length,
    };
  });

  app.get('/api/times', async (req) => {
    const q = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(req.query);
    return times.getDay(q.date);
  });

  app.get('/api/times/month', async (req) => {
    const q = z.object({ year: z.coerce.number().int().min(2000).max(2100), month: z.coerce.number().int().min(1).max(12) }).parse(req.query);
    const count = new Date(Date.UTC(q.year, q.month, 0)).getUTCDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    const keys = Array.from({ length: count }, (_, i) => `${q.year}-${pad(q.month)}-${pad(i + 1)}`);
    const out: Array<Awaited<ReturnType<typeof times.getDay>>> = new Array(keys.length);
    let next = 0;
    // A few at a time: fast enough, gentle on the online API.
    await Promise.all(
      Array.from({ length: 6 }, async () => {
        while (next < keys.length) {
          const i = next++;
          out[i] = await times.getDay(keys[i]);
        }
      }),
    );
    return out.filter(Boolean);
  });

  /* ───────────── config ───────────── */
  app.get('/api/config', async () => store.getPublic());
  app.put('/api/config', async (req) => {
    const body = req.body as Record<string, any>;
    if (body?.location && !isValidTimeZone(body.location.timezone)) throw httpError(400, 'Unknown time zone');
    store.update(body);
    return store.getPublic();
  });
  app.get('/api/methods', async () => METHODS.map(({ key, label, region, aladhan, approximate }) => ({ key, label, region, aladhan, approximate: !!approximate })));

  /* ───────────── location ───────────── */
  app.get('/api/location/search', async (req) => {
    const { q } = z.object({ q: z.string().min(1) }).parse(req.query);
    try {
      return await searchPlaces(q);
    } catch (err) {
      throw httpError(502, `Place search needs internet access (${(err as Error).message}). You can enter coordinates manually instead.`);
    }
  });
  app.get('/api/location/ip', async () => {
    try {
      return await locateByIp();
    } catch (err) {
      throw httpError(502, `Could not detect your location (${(err as Error).message}).`);
    }
  });
  app.post('/api/location/coordinates', async (req) => {
    const b = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), name: z.string().optional() }).parse(req.body);
    return makeLocation(b.name || `${b.latitude.toFixed(3)}, ${b.longitude.toFixed(3)}`, b.latitude, b.longitude);
  });

  /* ───────────── speakers ───────────── */
  app.get('/api/speakers', async () => {
    const drivers: Record<string, { ok: boolean; reason?: string }> = {};
    for (const [type, d] of registry.drivers) drivers[type] = await d.status();
    return { speakers: await Promise.all(registry.list().map(speakerView)), drivers };
  });
  app.post('/api/speakers/scan', async () => {
    registry.rescan();
    return { ok: true };
  });
  app.post('/api/speakers/manual', async (req) => {
    const b = z.object({ type: z.enum(['sonos', 'cast', 'airplay']), host: z.string().min(3).max(120), name: z.string().max(60).optional() }).parse(req.body);
    const driver = registry.drivers.get(b.type);
    if (!driver?.probe) throw httpError(400, 'This speaker type cannot be added manually.');
    try {
      const found = await driver.probe(b.host.trim(), b.name);
      registry.upsert(found);
      return speakerView(registry.get(found.id)!);
    } catch (err) {
      throw httpError(502, `Could not reach a ${b.type} speaker at ${b.host}: ${(err as Error).message}`);
    }
  });
  app.delete('/api/speakers/:id', async (req) => {
    const { id } = req.params as { id: string };
    registry.remove(id);
    return { ok: true };
  });
  app.put('/api/speakers/:id', async (req) => {
    const { id } = req.params as { id: string };
    const sp = registry.get(id);
    if (!sp) throw httpError(404, 'Unknown speaker');
    const b = z
      .object({ enabled: z.boolean().optional(), volume: z.number().min(0).max(100).optional(), nickname: z.string().max(60).nullable().optional(), art: z.enum(ART_KINDS).nullable().optional() })
      .parse(req.body);
    store.update({ speakers: { [id]: b } });
    return speakerView(sp);
  });

  /* ───────────── athan library ───────────── */
  app.get('/api/athans', async () => library.list());
  app.post('/api/athans', async (req) => {
    const file = await req.file({ limits: { fileSize: MAX_BYTES } });
    if (!file) throw httpError(400, 'No file uploaded');
    const name = typeof (file.fields.name as any)?.value === 'string' ? (file.fields.name as any).value : undefined;
    const muezzin = typeof (file.fields.muezzin as any)?.value === 'string' ? (file.fields.muezzin as any).value : undefined;
    const item = await library.addFromStream(file.file, file.filename, name);
    if (muezzin) library.update(item.id, { muezzin });
    return library.get(item.id);
  });
  app.get('/api/catalog', async () => {
    const have = new Set(library.list().map((a) => a.sourceUrl));
    return CATALOG.map((c) => ({ ...c, installed: have.has(c.url) }));
  });
  app.post('/api/catalog/:id/install', async (req) => {
    const { id } = req.params as { id: string };
    const c = CATALOG.find((x) => x.id === id);
    if (!c) throw httpError(404, 'Unknown catalog entry');
    if (library.list().some((a) => a.sourceUrl === c.url)) throw httpError(409, 'Already in your library');
    try {
      return await library.addFromUrl(c.url, c.name, c.muezzin);
    } catch (err) {
      throw httpError(502, `Download failed: ${(err as Error).message}. Check this server's internet connection.`);
    }
  });
  app.post('/api/athans/from-url', async (req) => {
    const b = z.object({ url: z.url(), name: z.string().max(80).optional(), muezzin: z.string().max(80).nullable().optional() }).parse(req.body);
    try {
      return await library.addFromUrl(b.url, b.name, b.muezzin);
    } catch (err) {
      throw httpError(400, (err as Error).message);
    }
  });
  app.patch('/api/athans/:id', async (req) => {
    const { id } = req.params as { id: string };
    const b = z.object({ name: z.string().min(1).max(80).optional(), muezzin: z.string().max(80).nullable().optional() }).parse(req.body);
    try {
      return library.update(id, b);
    } catch (err) {
      throw httpError(400, (err as Error).message);
    }
  });
  app.delete('/api/athans/:id', async (req) => {
    const { id } = req.params as { id: string };
    try {
      library.remove(id);
    } catch (err) {
      throw httpError(400, (err as Error).message);
    }
    // Anything that pointed at it falls back to the default.
    const cfg = store.get();
    const patch: Record<string, any> = {};
    if (cfg.defaultAthanId === id) patch.defaultAthanId = null;
    for (const p of PRAYERS) if (cfg.prayers[p].athanId === id) (patch.prayers ??= {})[p] = { athanId: null };
    if (Object.keys(patch).length) store.update(patch);
    return { ok: true };
  });

  /* ───────────── playback ───────────── */
  app.post('/api/play', async (req) => {
    const b = z
      .object({
        prayer: z.enum(PRAYERS).optional(),
        athanId: z.string().nullable().optional(),
        speakerIds: z.array(z.string()).optional(),
        volume: z.number().min(0).max(100).nullable().optional(),
      })
      .parse(req.body ?? {});
    const cfg = store.get();
    const ps = b.prayer ? cfg.prayers[b.prayer as Prayer] : null;
    const athan = library.resolve(b.athanId ?? ps?.athanId ?? null, cfg.defaultAthanId);
    let speakers: Speaker[];
    if (b.speakerIds?.length) speakers = b.speakerIds.map((id) => registry.get(id)).filter((s): s is Speaker => !!s);
    else if (b.prayer) speakers = scheduler.targets(b.prayer);
    else speakers = registry.list().filter((s) => speakerEnabled(cfg, s) && registry.isOnline(s));
    if (!speakers.length) throw httpError(400, 'No speakers to play on. Enable a speaker on the Speakers page first.');
    return player.start({ athan, speakers, volume: b.volume ?? ps?.volume ?? null, prayer: b.prayer ?? null, trigger: 'manual' });
  });
  app.post('/api/stop', async () => {
    player.stop();
    return player.getState();
  });

  /* ───────────── integrations ───────────── */
  app.post('/api/integrations/webhook/test', async () => {
    try {
      await ctx.webhook.send({ kind: 'info', message: 'Test notification from your Athan server 🕌', ts: new Date().toISOString(), data: { test: true } });
      return { ok: true };
    } catch (err) {
      throw httpError(502, (err as Error).message);
    }
  });

  /* ───────────── daily sync ───────────── */
  app.get('/api/sync', async () => ctx.sync.status());
  app.post('/api/sync', async () => {
    if (ctx.sync.status().running) throw httpError(409, 'A sync is already running.');
    void ctx.sync.run('manual'); // runs in the background; the UI polls /api/sync
    return { ...ctx.sync.status(), running: true };
  });

  /* ───────────── activity + system ───────────── */
  app.get('/api/log', async () => bus.recent(50));

  app.get('/api/system', async () => {
    const cfg = store.get();
    const tools: Record<string, boolean> = {};
    for (const t of ['atvremote', 'mpv', 'ffplay', 'mpg123', 'cvlc']) tools[t] = !!(await which(t));
    return {
      version: ctx.version,
      node: process.version,
      platform: `${os.type()} ${os.release()} (${os.arch()})`,
      hostname: os.hostname(),
      uptimeSec: Math.round(process.uptime()),
      lanAddress: lanAddress(),
      baseUrl: baseUrl(cfg, ctx.port),
      dataDir: DATA_DIR,
      mock: process.env.ATHAN_MOCK === '1',
      tools,
    };
  });

  /* ───────────── live updates (Server-Sent Events) ───────────── */
  app.get('/api/stream', (req, reply) => {
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    const send = (event: string, data: unknown) => reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send('hello', { ok: true });
    const onLog = (e: unknown) => send('log', e);
    const onState = (s: unknown) => send('player', s);
    const onSpeakers = () => send('speakers', {});
    const onConfig = () => send('config', {});
    bus.on('log', onLog);
    player.on('state', onState);
    registry.on('change', onSpeakers);
    store.on('change', onConfig);
    const ping = setInterval(() => reply.raw.write(': ping\n\n'), 25_000);
    req.raw.on('close', () => {
      clearInterval(ping);
      bus.off('log', onLog);
      player.off('state', onState);
      registry.off('change', onSpeakers);
      store.off('change', onConfig);
    });
    return reply;
  });

}
