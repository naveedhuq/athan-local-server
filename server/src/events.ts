import { EventEmitter } from 'node:events';
import type { LogEntry } from './api-types.js';

export type { LogEntry };
export type LogKind = LogEntry['kind'];

/** In-memory activity log + fan-out to SSE clients and integrations. */
export class EventBus extends EventEmitter {
  private seq = 0;
  private entries: LogEntry[] = [];

  log(kind: LogKind, message: string, data?: Record<string, unknown>, level?: LogEntry['level']): LogEntry {
    const entry: LogEntry = {
      id: ++this.seq,
      ts: new Date().toISOString(),
      level: level ?? (kind === 'error' ? 'error' : kind === 'skipped' ? 'warn' : 'info'),
      kind,
      message,
      data,
    };
    this.entries.push(entry);
    if (this.entries.length > 200) this.entries.shift();
    this.emit('log', entry);
    return entry;
  }

  recent(limit = 50): LogEntry[] {
    return this.entries.slice(-limit).reverse();
  }
}
