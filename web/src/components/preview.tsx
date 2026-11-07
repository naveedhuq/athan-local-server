import type { Athan } from '@server/api-types';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

interface PreviewApi {
  playingId: string | null;
  toggle: (a: Athan) => void;
  stop: () => void;
}
const Ctx = createContext<PreviewApi | null>(null);

/** One shared <audio> element so only a single athan previews at a time. */
export function PreviewProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    const el = new Audio();
    el.preload = 'none';
    el.addEventListener('ended', () => setPlayingId(null));
    el.addEventListener('pause', () => setPlayingId(null));
    audio.current = el;
    return () => {
      el.pause();
      el.src = '';
    };
  }, []);

  const stop = useCallback(() => audio.current?.pause(), []);
  const toggle = useCallback(
    (a: Athan) => {
      const el = audio.current;
      if (!el) return;
      if (playingId === a.id) return el.pause();
      el.pause();
      el.src = `/audio/${encodeURIComponent(a.filename)}`;
      el.currentTime = 0;
      el.play().then(() => setPlayingId(a.id)).catch(() => setPlayingId(null));
    },
    [playingId],
  );
  const value = useMemo(() => ({ playingId, toggle, stop }), [playingId, toggle, stop]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePreview(): PreviewApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('PreviewProvider missing');
  return c;
}
