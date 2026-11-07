import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, useAppState, useAthans, useConfig, useSpeakers } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/toast';
import { Button, Card, Equalizer, SectionTitle } from '@/ui';
import { SpeakerArt, pickKind, type ArtKind } from './SpeakerArt';
import { AthanSelect } from './pickers';

const KEY = 'athan.quickplay.athan';
const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

/** Homepage panel: pick an athan, then tap a speaker to play on it right away. */
export function QuickPlay() {
  const { data: athans = [] } = useAthans();
  const { data: cfg } = useConfig();
  const { data: sp } = useSpeakers();
  const { data: state } = useAppState();
  const qc = useQueryClient();
  const toast = useToast();
  const [athanId, setAthanId] = useState<string | null>(read);
  const [all, setAll] = useState(false);

  // Fall back to the default athan if nothing (valid) is remembered.
  const valid = athans.some((a) => a.id === athanId);
  useEffect(() => {
    if (athans.length && !valid) setAthanId(cfg?.defaultAthanId ?? athans.find((a) => !a.builtin)?.id ?? athans[0].id);
  }, [athans, valid, cfg?.defaultAthanId]);

  const choose = (id: string | null) => {
    setAthanId(id);
    try {
      if (id) localStorage.setItem(KEY, id);
    } catch {
      /* private mode */
    }
  };

  const play = useMutation({
    mutationFn: (speakerIds: string[] | undefined) => api('/play', { method: 'POST', json: { athanId, speakerIds } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['state'] }),
    onError: (e) => toast.error((e as Error).message),
  });
  const stop = useMutation({ mutationFn: () => api('/stop', { method: 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['state'] }) });

  const speakers = sp?.speakers ?? [];
  const playing = state?.player.status === 'playing' ? state.player : null;
  const activeIds = new Set(playing?.speakers.filter((s) => s.state === 'playing').map((s) => s.id));

  return (
    <section>
      <SectionTitle title="Play on a speaker" hint="Pick an athan, then tap a speaker to play it there right now." className="mb-4" />
      <Card className="space-y-5 p-5">
        <div className="max-w-xl">
          <AthanSelect athans={athans} value={athanId} onChange={choose} />
        </div>

        {speakers.length === 0 ? (
          <p className="text-sm text-muted">No speakers found yet. Open the Speakers page to scan.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(all ? speakers : speakers.slice(0, 6)).map((s) => {
              const active = activeIds.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => (active ? stop.mutate() : play.mutate([s.id]))}
                  disabled={!athanId || play.isPending}
                  aria-label={active ? `Stop ${s.displayName}` : `Play on ${s.displayName}`}
                  className={cn(
                    'flex min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[.98] disabled:opacity-50',
                    active ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-surface-2',
                  )}
                >
                  <span className={cn('relative flex size-14 shrink-0 items-center justify-center rounded-xl bg-surface-2', active && 'bg-accent-soft')}>
                    <SpeakerArt kind={(s.art as ArtKind | null) ?? pickKind(s.type, s.name, s.model)} size={46} active={active} dim={!s.online} />
                    {active && <Equalizer className="absolute -right-1 -top-1 h-4 rounded-md bg-accent px-1 py-0.5 text-accent-fg" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{s.displayName}</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <span className={cn('size-1.5 rounded-full', s.online ? 'bg-ok' : 'bg-muted')} />
                      {active ? 'Playing – tap to stop' : s.online ? 'Tap to play' : 'Not seen recently'}
                    </span>
                  </span>
                  {active && <Square className="size-4 shrink-0 fill-current text-accent" />}
                </button>
              );
            })}
          </div>
        )}

        {speakers.length > 6 && (
          <Button variant="ghost" size="sm" className="mr-2" onClick={() => setAll((v) => !v)}>
            {all ? 'Show fewer' : `Show all ${speakers.length} speakers`}
          </Button>
        )}
        {speakers.length > 1 && (
          <Button variant="outline" size="sm" onClick={() => play.mutate(undefined)} disabled={!athanId} loading={play.isPending && play.variables === undefined}>
            Play on all enabled speakers
          </Button>
        )}
      </Card>
    </section>
  );
}
