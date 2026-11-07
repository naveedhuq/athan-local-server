import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerApi } from './api.js';
import { AthanLibrary } from './athans.js';
import { ConfigStore } from './config.js';
import type { AppContext } from './context.js';
import { EventBus } from './events.js';
import { MqttBridge } from './integrations/mqtt.js';
import { WebhookNotifier } from './integrations/webhook.js';
import { AUDIO_DIR, DATA_DIR, WEB_DIR } from './paths.js';
import { Player } from './player.js';
import { PrayerTimeService } from './prayer/service.js';
import { Scheduler } from './scheduler.js';
import { AirPlayDriver } from './speakers/airplay.js';
import { CastDriver } from './speakers/cast.js';
import { LocalDriver } from './speakers/local.js';
import { MOCK_SPEAKERS } from './speakers/mock.js';
import { SpeakerRegistry } from './speakers/registry.js';
import { SonosDriver } from './speakers/sonos.js';
import { SyncService } from './sync.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const version = (() => {
  try {
    return JSON.parse(readFileSync(path.join(here, '..', 'package.json'), 'utf8')).version as string;
  } catch {
    return '0.0.0';
  }
})();

const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? '0.0.0.0';

const store = new ConfigStore();
const bus = new EventBus();
const library = new AthanLibrary();
const registry = new SpeakerRegistry();
const times = new PrayerTimeService(store);
const player = new Player(store, registry, library, bus, port);
const scheduler = new Scheduler(store, times, player, library, registry, bus);
const webhook = new WebhookNotifier(store, bus);
const sync = new SyncService(store, times, registry, scheduler, bus);
const mqttBridge = new MqttBridge(store, bus, player, times, version);

const ctx: AppContext = { port, version, store, bus, times, library, registry, player, scheduler, webhook, sync };

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, bodyLimit: 1024 * 1024 });
await app.register(fastifyMultipart);

// Speakers fetch the athan files from here, so Range requests matter (Sonos/Cast seek).
await app.register(fastifyStatic, { root: AUDIO_DIR, prefix: '/audio/', index: false, list: false, acceptRanges: true, cacheControl: false });

await registerApi(app, ctx);

if (existsSync(path.join(WEB_DIR, 'index.html'))) {
  await app.register(fastifyStatic, { root: WEB_DIR, prefix: '/', decorateReply: false, wildcard: false });
  // Single-page app: unknown non-API paths load the UI.
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/audio/')) return reply.status(404).send({ error: 'Not found' });
    return reply.type('text/html').send(readFileSync(path.join(WEB_DIR, 'index.html')));
  });
} else {
  app.get('/', async (_req, reply) => reply.type('text/html').send('<h1>Athan server is running</h1><p>The web UI has not been built yet. Run <code>npm run build</code>.</p>'));
}

// Speaker drivers + discovery
registry.register(new SonosDriver());
registry.register(new CastDriver());
registry.register(new AirPlayDriver());
registry.register(new LocalDriver());
if (process.env.ATHAN_MOCK === '1') for (const s of MOCK_SPEAKERS) registry.upsert(s);

scheduler.start();
sync.start();
mqttBridge.start();

await app.listen({ port, host });
bus.log('info', `Athan server ${version} listening on port ${port} (data: ${DATA_DIR})`);

const shutdown = () => {
  scheduler.stop();
  sync.stop();
  mqttBridge.stop();
  registry.stop();
  player.stop();
  void app.close().finally(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
