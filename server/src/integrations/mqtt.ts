import mqtt, { type MqttClient } from 'mqtt';
import type { Config, ConfigStore } from '../config.js';
import type { EventBus, LogEntry } from '../events.js';
import { upcomingEvents } from '../hijri.js';
import type { Player } from '../player.js';
import type { PrayerTimeService } from '../prayer/service.js';

/** Publishes state/events to MQTT and (optionally) announces itself to Home Assistant. */
export class MqttBridge {
  private client: MqttClient | null = null;
  private signature = '';
  private nextTimer?: NodeJS.Timeout;

  constructor(
    private readonly store: ConfigStore,
    private readonly bus: EventBus,
    private readonly player: Player,
    private readonly times: PrayerTimeService,
    private readonly version: string,
  ) {
    store.on('change', () => this.sync());
    bus.on('log', (e: LogEntry) => this.onLog(e));
    player.on('state', () => this.publishState());
  }

  start() {
    this.sync();
  }

  stop() {
    clearInterval(this.nextTimer);
    this.client?.end(true);
    this.client = null;
  }

  private get cfg() {
    return this.store.get().integrations.mqtt;
  }

  private sync() {
    const c = this.cfg;
    const sig = c.enabled ? JSON.stringify([c.url, c.username, c.password, c.topicPrefix, c.homeAssistantDiscovery]) : '';
    if (sig === this.signature) {
      if (c.enabled) this.publishState();
      return;
    }
    this.signature = sig;
    this.stop();
    if (!c.enabled || !c.url) return;
    const p = c.topicPrefix;
    try {
      const client = mqtt.connect(c.url, {
        username: c.username || undefined,
        password: c.password || undefined,
        reconnectPeriod: 10_000,
        connectTimeout: 10_000,
        will: { topic: `${p}/availability`, payload: Buffer.from('offline'), retain: true, qos: 1 },
      });
      this.client = client;
      client.on('connect', () => {
        this.bus.log('info', `MQTT connected to ${c.url}`);
        client.publish(`${p}/availability`, 'online', { retain: true });
        client.subscribe([`${p}/enabled/set`, `${p}/stop/set`]);
        if (c.homeAssistantDiscovery) this.discovery();
        this.publishState();
        this.nextTimer = setInterval(() => this.publishState(), 60_000);
      });
      client.on('error', (err) => this.bus.log('error', `MQTT: ${err.message}`, undefined, 'warn'));
      client.on('message', (topic, payload) => {
        const msg = payload.toString().trim().toUpperCase();
        if (topic === `${p}/enabled/set`) this.store.update({ enabled: msg === 'ON' });
        else if (topic === `${p}/stop/set`) this.player.stop();
      });
    } catch (err) {
      this.bus.log('error', `MQTT: ${(err as Error).message}`);
    }
  }

  private discovery() {
    const c = this.cfg;
    const p = c.topicPrefix;
    const device = { identifiers: ['athan_local_server'], name: 'Athan Server', manufacturer: 'athan-local-server', sw_version: this.version };
    const common = { availability_topic: `${p}/availability`, device };
    const pub = (component: string, id: string, payload: object) =>
      this.client?.publish(`homeassistant/${component}/athan_${id}/config`, JSON.stringify({ ...common, unique_id: `athan_${id}`, ...payload }), { retain: true });
    pub('sensor', 'next_prayer', { name: 'Next prayer', state_topic: `${p}/state`, value_template: '{{ value_json.next_prayer }}', icon: 'mdi:mosque' });
    pub('sensor', 'next_prayer_time', { name: 'Next prayer time', state_topic: `${p}/state`, value_template: '{{ value_json.next_prayer_at }}', device_class: 'timestamp' });
    pub('sensor', 'next_islamic_event', { name: 'Next Islamic event', state_topic: `${p}/state`, value_template: '{{ value_json.next_event }}', icon: 'mdi:calendar-star' });
    pub('sensor', 'next_islamic_event_date', { name: 'Next Islamic event date', state_topic: `${p}/state`, value_template: '{{ value_json.next_event_date }}', icon: 'mdi:calendar' });
    pub('binary_sensor', 'playing', { name: 'Athan playing', state_topic: `${p}/state`, value_template: '{{ "ON" if value_json.playing else "OFF" }}', icon: 'mdi:volume-high' });
    pub('switch', 'enabled', { name: 'Athan enabled', state_topic: `${p}/state`, value_template: '{{ "ON" if value_json.enabled else "OFF" }}', command_topic: `${p}/enabled/set`, icon: 'mdi:bell-ring' });
    pub('button', 'stop', { name: 'Stop athan', command_topic: `${p}/stop/set`, payload_press: 'PRESS', icon: 'mdi:stop' });
  }

  private async publishState() {
    if (!this.client?.connected) return;
    const cfg: Config = this.store.get();
    const next = await this.times.next().catch(() => null);
    const ps = this.player.getState();
    const tz = cfg.location?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
    const ev = upcomingEvents(todayKey, 1, cfg.calendar.hijriAdjust)[0];
    this.client.publish(
      `${cfg.integrations.mqtt.topicPrefix}/state`,
      JSON.stringify({ enabled: cfg.enabled, playing: ps.status === 'playing', prayer: ps.prayer, next_prayer: next?.prayer ?? null, next_prayer_at: next?.at ?? null, next_event: ev?.event.name ?? null, next_event_date: ev?.date ?? null }),
      { retain: true },
    );
  }

  private onLog(e: LogEntry) {
    if (!this.client?.connected || e.kind === 'info') return;
    this.client.publish(`${this.cfg.topicPrefix}/event`, JSON.stringify({ type: e.kind, message: e.message, ts: e.ts, ...e.data }));
  }
}
