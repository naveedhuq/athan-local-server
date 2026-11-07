import type { SpeakerType, TimeName } from '@server/api-types';
import { Airplay, Cast, Cpu, Moon, MoonStar, Speaker, Sun, SunMedium, Sunrise, Sunset } from 'lucide-react';
import type { ComponentProps } from 'react';

export function PrayerIcon({ name, ...p }: { name: TimeName } & ComponentProps<typeof Sun>) {
  const Icon = { fajr: MoonStar, sunrise: Sunrise, dhuhr: Sun, asr: SunMedium, maghrib: Sunset, isha: Moon }[name];
  return <Icon {...p} />;
}

export const SPEAKER_META: Record<SpeakerType, { label: string; plural: string; Icon: typeof Speaker }> = {
  sonos: { label: 'Sonos', plural: 'Sonos', Icon: Speaker },
  cast: { label: 'Google Cast', plural: 'Google Cast & Nest', Icon: Cast },
  airplay: { label: 'AirPlay', plural: 'AirPlay', Icon: Airplay },
  local: { label: 'This device', plural: 'This device', Icon: Cpu },
};

export function SpeakerIcon({ type, ...p }: { type: SpeakerType } & ComponentProps<typeof Speaker>) {
  const Icon = SPEAKER_META[type].Icon;
  return <Icon {...p} />;
}
