import type { AthanLibrary } from './athans.js';
import type { ConfigStore } from './config.js';
import type { EventBus } from './events.js';
import type { WebhookNotifier } from './integrations/webhook.js';
import type { Player } from './player.js';
import type { PrayerTimeService } from './prayer/service.js';
import type { Scheduler } from './scheduler.js';
import type { SpeakerRegistry } from './speakers/registry.js';

export interface AppContext {
  port: number;
  version: string;
  store: ConfigStore;
  bus: EventBus;
  times: PrayerTimeService;
  library: AthanLibrary;
  registry: SpeakerRegistry;
  player: Player;
  scheduler: Scheduler;
  webhook: WebhookNotifier;
}
