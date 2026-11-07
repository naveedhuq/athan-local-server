import type { ConfigStore } from '../config.js';
import type { EventBus, LogEntry } from '../events.js';

/** POSTs athan events to a URL (ntfy, Gotify, Home Assistant webhooks, Discord relays, …). */
export class WebhookNotifier {
  constructor(private readonly store: ConfigStore, bus: EventBus) {
    bus.on('log', (e: LogEntry) => void this.onLog(e));
  }

  private async onLog(e: LogEntry) {
    const w = this.store.get().integrations.webhook;
    if (!w.enabled || !w.url || e.kind === 'info' || !w.events.includes(e.kind)) return;
    await this.send(e).catch(() => undefined);
  }

  async send(e: Pick<LogEntry, 'kind' | 'message' | 'ts' | 'data'>): Promise<void> {
    const w = this.store.get().integrations.webhook;
    const body = w.format === 'json' ? JSON.stringify({ event: e.kind, message: e.message, ts: e.ts, ...e.data }) : e.message;
    const headers: Record<string, string> = w.format === 'json' ? { 'content-type': 'application/json' } : { 'content-type': 'text/plain', Title: 'Athan', Tags: 'mosque' };
    const res = await fetch(w.url, { method: 'POST', body, headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Webhook responded with HTTP ${res.status}`);
  }
}
