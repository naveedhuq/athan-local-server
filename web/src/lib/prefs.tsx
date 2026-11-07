import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Clock } from './format';

export type Theme = 'system' | 'light' | 'dark';
interface Prefs {
  theme: Theme;
  clock: Clock;
  setTheme: (t: Theme) => void;
  setClock: (c: Clock) => void;
}

const Ctx = createContext<Prefs | null>(null);

const read = <T extends string>(key: string, fallback: T): T => {
  try {
    return (localStorage.getItem(key) as T) || fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
};

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => read('athan.theme', 'system'));
  const [clock, setClockState] = useState<Clock>(() => read('athan.clock', '12h'));

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && mq.matches));
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    write('athan.theme', t);
    setThemeState(t);
  }, []);
  const setClock = useCallback((c: Clock) => {
    write('athan.clock', c);
    setClockState(c);
  }, []);
  const value = useMemo(() => ({ theme, clock, setTheme, setClock }), [theme, clock, setTheme, setClock]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const c = useContext(Ctx);
  if (!c) throw new Error('PrefsProvider missing');
  return c;
}
