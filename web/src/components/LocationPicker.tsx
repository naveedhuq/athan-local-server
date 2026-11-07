import type { Location } from '@server/api-types';
import { useMutation } from '@tanstack/react-query';
import { Crosshair, Globe, MapPin, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Button, Field, Input, Spinner } from '@/ui';

/** Search a city, auto-detect from IP / device, or enter coordinates. */
export function LocationPicker({ onPick, busy }: { onPick: (l: Location) => void; busy?: boolean }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Location[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [manual, setManual] = useState(false);
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        setResults(await api<Location[]>(`/location/search?q=${encodeURIComponent(q.trim())}`));
      } catch (e) {
        setResults([]);
        toast.error((e as Error).message);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const detect = useMutation({
    mutationFn: () => api<Location>('/location/ip'),
    onSuccess: onPick,
    onError: (e) => toast.error((e as Error).message),
  });

  const fromDevice = () => {
    if (!navigator.geolocation) return toast.error('This browser cannot share its location.');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          onPick(await api<Location>('/location/coordinates', { method: 'POST', json: { latitude: pos.coords.latitude, longitude: pos.coords.longitude, name: 'My location' } }));
        } catch (e) {
          toast.error((e as Error).message);
        }
      },
      () => toast.error('Could not get your device location. Browsers only allow this on https:// or localhost – try search or manual coordinates instead.'),
      { timeout: 10_000 },
    );
  };

  const useManual = async () => {
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return toast.error('Enter valid latitude (−90…90) and longitude (−180…180).');
    try {
      onPick(await api<Location>('/location/coordinates', { method: 'POST', json: { latitude, longitude } }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for your city…" className="pl-10" aria-label="Search for your city" autoComplete="off" />
        {searching && <Spinner className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2" />}
      </div>

      {results && (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {results.length === 0 && !searching && <li className="px-4 py-3 text-sm text-muted">No places found. Try a nearby larger city, or enter coordinates.</li>}
          {results.map((r) => (
            <li key={`${r.latitude},${r.longitude}`}>
              <button disabled={busy} onClick={() => onPick(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2 disabled:opacity-60">
                <MapPin className="size-4 shrink-0 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.name}</span>
                  <span className="block text-xs text-muted">
                    {r.latitude.toFixed(2)}°, {r.longitude.toFixed(2)}° · {r.timezone}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="soft" size="sm" icon={<Globe className="size-4" />} onClick={() => detect.mutate()} loading={detect.isPending}>
          Detect from internet connection
        </Button>
        <Button variant="outline" size="sm" icon={<Crosshair className="size-4" />} onClick={fromDevice}>
          Use this device’s location
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setManual((m) => !m)}>
          {manual ? 'Hide coordinates' : 'Enter coordinates'}
        </Button>
      </div>

      {manual && (
        <div className="animate-fade grid grid-cols-2 gap-3 rounded-2xl bg-surface-2 p-4">
          <Field label="Latitude">
            <Input inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="21.4225" />
          </Field>
          <Field label="Longitude">
            <Input inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="39.8262" />
          </Field>
          <Button className="col-span-2" onClick={useManual}>
            Use these coordinates
          </Button>
          <p className="col-span-2 text-xs text-muted">The time zone is worked out from the coordinates automatically, no internet needed.</p>
        </div>
      )}
    </div>
  );
}
