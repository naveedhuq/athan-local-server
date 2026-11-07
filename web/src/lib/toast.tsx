import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { cn } from './cn';

interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}
interface ToastApi {
  success: (t: string) => void;
  error: (t: string) => void;
  info: (t: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (kind: Toast['kind'], text: string) => {
      const id = ++seq;
      setItems((l) => [...l.slice(-3), { id, kind, text }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 3500);
    },
    [dismiss],
  );
  const api = useMemo<ToastApi>(() => ({ success: (t) => push('success', t), error: (t) => push('error', t), info: (t) => push('info', t) }), [push]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4 pt-safe pt-4 sm:items-end sm:pr-6" role="status" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              'animate-pop pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-surface px-4 py-3 text-sm shadow-card',
              t.kind === 'error' ? 'border-danger/40' : 'border-line',
            )}
          >
            {t.kind === 'success' ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" /> : t.kind === 'error' ? <TriangleAlert className="mt-0.5 size-5 shrink-0 text-danger" /> : <Info className="mt-0.5 size-5 shrink-0 text-accent" />}
            <p className="flex-1 leading-snug">{t.text}</p>
            <button onClick={() => dismiss(t.id)} className="-m-1 rounded-lg p-1 text-muted hover:text-ink" aria-label="Dismiss">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('ToastProvider missing');
  return c;
}
