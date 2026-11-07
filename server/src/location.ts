import tzlookup from 'tz-lookup';
import type { Location } from './config.js';
import { isValidTimeZone } from './prayer/tz.js';

/** Offline time zone for any coordinate pair. */
export function timezoneFor(lat: number, lon: number): string {
  try {
    const tz = tzlookup(lat, lon);
    if (isValidTimeZone(tz)) return tz;
  } catch {
    /* fall through */
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function makeLocation(name: string, latitude: number, longitude: number, country: string | null = null, timezone?: string): Location {
  return { name, latitude, longitude, country, timezone: timezone && isValidTimeZone(timezone) ? timezone : timezoneFor(latitude, longitude) };
}

/** City search via the free Open-Meteo geocoding API (no key needed). */
export async function searchPlaces(query: string, fetchFn: typeof fetch = fetch): Promise<Location[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', q);
  url.searchParams.set('count', '8');
  url.searchParams.set('language', 'en');
  const res = await fetchFn(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Geocoder HTTP ${res.status}`);
  const body = (await res.json()) as { results?: Array<{ name: string; admin1?: string; country?: string; latitude: number; longitude: number; timezone?: string }> };
  return (body.results ?? []).map((r) =>
    makeLocation([r.name, r.admin1, r.country].filter(Boolean).join(', '), r.latitude, r.longitude, r.country ?? null, r.timezone),
  );
}

/** Rough location from the server's public IP (city level). */
export async function locateByIp(fetchFn: typeof fetch = fetch): Promise<Location> {
  const res = await fetchFn('https://ipwho.is/', { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`IP lookup HTTP ${res.status}`);
  const b = (await res.json()) as { success?: boolean; city?: string; region?: string; country?: string; latitude?: number; longitude?: number; timezone?: { id?: string } };
  if (b.success === false || typeof b.latitude !== 'number' || typeof b.longitude !== 'number') throw new Error('IP lookup failed');
  return makeLocation([b.city, b.region, b.country].filter(Boolean).join(', ') || 'My location', b.latitude, b.longitude, b.country ?? null, b.timezone?.id);
}
