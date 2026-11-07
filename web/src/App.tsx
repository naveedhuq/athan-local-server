import { useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Home, Library as LibraryIcon, Moon as MoonIcon, Settings as SettingsIcon, Speaker, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { NowPlayingBar } from '@/components/NowPlayingBar';
import { useAppState } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Dashboard } from '@/pages/Dashboard';
import { Library } from '@/pages/Library';
import { Prayers } from '@/pages/Prayers';
import { Settings } from '@/pages/Settings';
import { Speakers } from '@/pages/Speakers';

const NAV = [
  { to: '/', label: 'Today', Icon: Home },
  { to: '/prayers', label: 'Prayers', Icon: CalendarClock },
  { to: '/speakers', label: 'Speakers', Icon: Speaker },
  { to: '/library', label: 'Library', Icon: LibraryIcon },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
];

/** Keeps data fresh: the server pushes events and we refetch what changed. */
function useLiveUpdates(setConnected: (v: boolean) => void) {
  const qc = useQueryClient();
  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout>;
    const connect = () => {
      es = new EventSource('/api/stream');
      es.addEventListener('hello', () => setConnected(true));
      es.addEventListener('log', () => qc.invalidateQueries({ queryKey: ['log'] }));
      es.addEventListener('player', () => qc.invalidateQueries({ queryKey: ['state'] }));
      es.addEventListener('speakers', () => qc.invalidateQueries({ queryKey: ['speakers'] }));
      es.addEventListener('config', () => {
        qc.invalidateQueries({ queryKey: ['config'] });
        qc.invalidateQueries({ queryKey: ['state'] });
      });
      es.onerror = () => {
        setConnected(false);
        es?.close();
        retry = setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      clearTimeout(retry);
      es?.close();
    };
  }, [qc, setConnected]);
}

export default function App() {
  const [connected, setConnected] = useState(true);
  const { pathname } = useLocation();
  const { data: state } = useAppState();
  useLiveUpdates(setConnected);
  useEffect(() => window.scrollTo({ top: 0 }), [pathname]);

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface/80 p-5 backdrop-blur-xl lg:flex">
        <Brand />
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn('flex h-11 items-center gap-3 rounded-2xl px-3.5 text-sm font-medium transition', isActive ? 'bg-accent-soft text-accent-strong' : 'text-muted hover:bg-surface-2 hover:text-ink')
              }
            >
              <Icon className="size-5" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl bg-surface-2 p-3.5 text-xs text-muted">
          <div className="flex items-center gap-2 font-medium text-ink">
            <span className={cn('size-2 rounded-full', state?.enabled ? 'bg-ok' : 'bg-muted')} />
            {state?.enabled ? 'Athan is on' : 'Athan is off'}
          </div>
          <div className="mt-1 truncate">{state?.location?.name ?? 'No location set'}</div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="pt-safe sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Brand compact />
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', state?.enabled ? 'bg-accent-soft text-accent-strong' : 'bg-surface-2 text-muted')}>
            <span className={cn('size-1.5 rounded-full', state?.enabled ? 'bg-ok' : 'bg-muted')} />
            {state?.enabled ? 'On' : 'Off'}
          </span>
        </div>
      </header>

      {!connected && (
        <div className="flex items-center justify-center gap-2 bg-danger-soft px-4 py-2 text-sm text-danger" role="alert">
          <WifiOff className="size-4" /> Lost connection to the server. Retrying…
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 pb-40 pt-6 sm:px-6 lg:px-10 lg:pb-32 lg:pt-10">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/prayers" element={<Prayers />} />
          <Route path="/speakers" element={<Speakers />} />
          <Route path="/library" element={<Library />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>

      <NowPlayingBar />

      {/* Mobile bottom tab bar */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 backdrop-blur-xl lg:hidden" aria-label="Main">
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {NAV.map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink to={to} end={to === '/'} className={({ isActive }) => cn('flex h-[4.25rem] flex-col items-center justify-center gap-1 text-[11px] font-medium transition', isActive ? 'text-accent' : 'text-muted')}>
                {({ isActive }) => (
                  <>
                    <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition', isActive && 'bg-accent-soft')}>
                      <Icon className="size-5" />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-10 items-center justify-center rounded-2xl bg-linear-to-br from-teal-400 to-teal-700 text-white shadow-card">
        <MoonIcon className="size-5 fill-amber-100 text-amber-100" />
      </div>
      <div className="leading-tight">
        <div className="text-base font-semibold tracking-tight">Athan</div>
        {!compact && <div className="text-xs text-muted">Home prayer calls</div>}
      </div>
    </div>
  );
}
