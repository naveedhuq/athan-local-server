import type { Config, Location, Prayer, TimeName } from './schema.js';

export type { Config, Location, Prayer, TimeName };

export interface Athan {
  id: string;
  name: string;
  muezzin: string | null;
  filename: string;
  mime: string;
  durationSec: number;
  size: number;
  builtin: boolean;
  addedAt: string;
  sourceUrl: string | null;
}

export type SpeakerType = 'sonos' | 'cast' | 'airplay' | 'local';

export interface Speaker {
  id: string;
  type: SpeakerType;
  name: string;
  host: string;
  port: number;
  model: string | null;
  lastSeen: number;
  /** added by hand (IP address) rather than discovered */
  manual?: boolean;
  /** simulated speaker for demos / development */
  mock?: boolean;
}

export interface SpeakerView extends Speaker {
  online: boolean;
  displayName: string;
  enabled: boolean;
  volume: number;
  nickname: string | null;
  art: string | null;
}

export interface DriverStatus {
  ok: boolean;
  reason?: string;
}

export interface PlayerState {
  status: 'idle' | 'playing';
  prayer: Prayer | null;
  trigger: 'schedule' | 'manual' | null;
  athan: { id: string; name: string } | null;
  speakers: Array<{ id: string; name: string; state: 'playing' | 'done' | 'error'; error?: string }>;
  startedAt: string | null;
  endsAt: string | null;
}

export interface DayTimes {
  date: string;
  timezone: string;
  source: 'aladhan' | 'offline' | 'cache';
  warnings: string[];
  times: Record<TimeName, { time: string; fixed: boolean }>;
}

export interface NextPrayer {
  prayer: Prayer;
  at: string;
  date: string;
}

export interface LogEntry {
  id: number;
  ts: string;
  level: 'info' | 'warn' | 'error';
  kind: 'started' | 'finished' | 'skipped' | 'error' | 'info';
  message: string;
  data?: Record<string, unknown>;
}

export interface AppState {
  now: string;
  configured: boolean;
  enabled: boolean;
  pausedUntil: string | null;
  location: Location | null;
  today: DayTimes | null;
  next: NextPrayer | null;
  player: PlayerState;
  speakerCount: number;
}

export interface MethodView {
  key: string;
  label: string;
  region: string;
  aladhan: number;
  approximate: boolean;
}

export interface SystemInfo {
  version: string;
  node: string;
  platform: string;
  hostname: string;
  uptimeSec: number;
  lanAddress: string;
  baseUrl: string;
  dataDir: string;
  mock: boolean;
  tools: Record<string, boolean>;
}
