import { Square } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppState, api } from '@/lib/api';
import { LABEL } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { Button, Equalizer } from '@/ui';

/** Floating bar that appears on every page while an athan is playing. */
export function NowPlayingBar() {
  const { data } = useAppState();
  const qc = useQueryClient();
  const stop = useMutation({ mutationFn: () => api('/stop', { method: 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['state'] }) });
  const p = data?.player;
  const now = useNow(500);
  if (!p || p.status !== 'playing' || !p.startedAt || !p.endsAt) return null;

  const start = new Date(p.startedAt).getTime();
  const end = new Date(p.endsAt).getTime();
  const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  const title = p.prayer ? `${LABEL[p.prayer]} athan` : 'Test playback';
  const failed = p.speakers.filter((s) => s.state === 'error').length;

  return (
    <div className="animate-pop pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-3 lg:bottom-6 lg:left-64">
      <div className="pointer-events-auto w-full max-w-xl overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_20px_50px_-12px_rgb(0_0_0/0.45)]">
        <div className="flex items-center gap-3 p-3 pr-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-fg">
            <Equalizer className="h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{title}</div>
            <div className="truncate text-xs text-muted">
              {p.athan?.name} · {p.speakers.map((s) => s.name).join(', ') || 'no speakers'}
              {failed > 0 && <span className="text-danger"> · {failed} failed</span>}
            </div>
          </div>
          <Button variant="danger" size="sm" icon={<Square className="size-3.5 fill-current" />} onClick={() => stop.mutate()} loading={stop.isPending}>
            Stop
          </Button>
        </div>
        <div className="h-1 bg-surface-2">
          <div className="h-full bg-accent transition-[width] duration-500 ease-linear" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
