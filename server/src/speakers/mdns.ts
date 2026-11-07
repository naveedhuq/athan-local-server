import { Bonjour } from 'bonjour-service';

let instance: Bonjour | null = null;
/** One shared mDNS instance for all drivers (Cast, AirPlay). */
export function mdns(): Bonjour {
  instance ??= new Bonjour();
  return instance;
}

export function firstIPv4(addresses: string[] | undefined, fallback: string): string {
  return addresses?.find((a) => /^\d+\.\d+\.\d+\.\d+$/.test(a)) ?? fallback;
}

export function txtOf(txt: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (txt && typeof txt === 'object') for (const [k, v] of Object.entries(txt as Record<string, unknown>)) out[k.toLowerCase()] = String(v);
  return out;
}
