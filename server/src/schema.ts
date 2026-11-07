import { z } from 'zod';

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type Prayer = (typeof PRAYERS)[number];
export const TIME_NAMES = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type TimeName = (typeof TIME_NAMES)[number];

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');

const prayerSettings = z.object({
  enabled: z.boolean().default(true),
  /** null = use the default athan */
  athanId: z.string().nullable().default(null),
  /** empty = every enabled speaker */
  speakerIds: z.array(z.string()).default([]),
  /** null = use each speaker's own volume */
  volume: z.number().min(0).max(100).nullable().default(null),
  offsetMinutes: z.number().int().min(-60).max(60).default(0),
  /** 0 = Sunday … 6 = Saturday */
  days: z.array(z.number().int().min(0).max(6)).default([0, 1, 2, 3, 4, 5, 6]),
  respectQuietHours: z.boolean().default(true),
});

const speakerSettings = z.object({
  enabled: z.boolean().default(true),
  volume: z.number().min(0).max(100).default(40),
  nickname: z.string().max(60).nullable().default(null),
});

const location = z.object({
  name: z.string().max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string(),
  country: z.string().nullable().default(null),
});

export const configSchema = z.object({
  enabled: z.boolean().default(true),
  /** ISO timestamp; scheduled athans are skipped until then */
  pausedUntil: z.string().nullable().default(null),
  location: location.nullable().default(null),
  calculation: z
    .object({
      /** tried in order; "offline" never needs the network */
      sources: z.array(z.enum(['aladhan', 'offline'])).min(1).default(['aladhan', 'offline']),
      method: z.string().default('mwl'),
      madhab: z.enum(['shafi', 'hanafi']).default('shafi'),
      highLatitudeRule: z.enum(['auto', 'middleOfTheNight', 'seventhOfTheNight', 'twilightAngle']).default('auto'),
      /** Fixed HH:mm that replaces the computed time (e.g. your mosque's timetable) */
      fixedTimes: z.partialRecord(z.enum(TIME_NAMES), hhmm.nullable()).default({}),
    })
    .prefault({}),
  defaultAthanId: z.string().nullable().default(null),
  prayers: z
    .object({
      fajr: prayerSettings.prefault({}),
      dhuhr: prayerSettings.prefault({}),
      asr: prayerSettings.prefault({}),
      maghrib: prayerSettings.prefault({}),
      isha: prayerSettings.prefault({}),
    })
    .prefault({}),
  speakers: z.record(z.string(), speakerSettings).default({}),
  quietHours: z
    .object({ enabled: z.boolean().default(false), start: hhmm.default('22:00'), end: hhmm.default('06:00') })
    .prefault({}),
  integrations: z
    .object({
      mqtt: z
        .object({
          enabled: z.boolean().default(false),
          url: z.string().default('mqtt://homeassistant.local:1883'),
          username: z.string().default(''),
          password: z.string().default(''),
          topicPrefix: z.string().default('athan'),
          homeAssistantDiscovery: z.boolean().default(true),
        })
        .prefault({}),
      webhook: z
        .object({
          enabled: z.boolean().default(false),
          url: z.string().default(''),
          /** json = machine readable; text = plain message (ntfy, Gotify, Discord-compatible proxies…) */
          format: z.enum(['json', 'text']).default('json'),
          events: z.array(z.enum(['started', 'finished', 'skipped', 'error'])).default(['started', 'skipped', 'error']),
        })
        .prefault({}),
    })
    .prefault({}),
  server: z.object({ publicUrl: z.string().nullable().default(null) }).prefault({}),
});

export type Config = z.infer<typeof configSchema>;
export type PrayerSettings = z.infer<typeof prayerSettings>;
export type SpeakerSettings = z.infer<typeof speakerSettings>;
export type Location = z.infer<typeof location>;
