import type { DayTimes, TimeName } from '@server/api-types';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Moon, Sunrise as SunriseIcon, Utensils } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { KIND_STYLE, UpcomingEvents } from '@/components/UpcomingEvents';
import { PrayerIcon } from '@/components/icons';
import { useAppState, useConfig, useHijriAdjust, useMonth } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ARABIC, LABEL, TIME_LIST, fmtTime } from '@/lib/format';
import { eventsFor, hijriLabel, hijriOf, HIJRI_MONTHS, isRamadan } from '@server/hijri';
import { usePrefs } from '@/lib/prefs';
import { Badge, Button, Card, Empty, IconButton, PageHeader, Segmented, Skeleton } from '@/ui';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n: number) => String(n).padStart(2, '0');
const key = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

export function Calendar() {
  const { data: state } = useAppState();
  const { data: cfg } = useConfig();
  const { clock } = usePrefs();
  const tz = state?.location?.timezone;
  const todayKey = useMemo(() => (tz ? new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()) : null), [tz]);

  const [params] = useSearchParams();
  const qd = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? params.get('date') : null;
  const [cursor, setCursor] = useState<{ y: number; m: number } | null>(qd ? { y: Number(qd.slice(0, 4)), m: Number(qd.slice(5, 7)) } : null);
  const [selected, setSelected] = useState<string | null>(qd);
  const [view, setView] = useState<'calendar' | 'table'>('calendar');

  const base = todayKey ? { y: Number(todayKey.slice(0, 4)), m: Number(todayKey.slice(5, 7)) } : null;
  const cur = cursor ?? base;
  const { data: month, isLoading, isError } = useMonth(cur?.y ?? 2026, cur?.m ?? 1, !!cur);

  if (state && !state.configured) {
    return (
      <div>
        <PageHeader title="Calendar" />
        <Empty icon={<MapPin className="size-6" />} title="Set your location first" action={<Link to="/" className="inline-flex h-11 items-center rounded-2xl bg-accent px-5 text-sm font-medium text-accent-fg">Choose location</Link>}>
          Prayer times for the month depend on where you are.
        </Empty>
      </div>
    );
  }
  if (!cur || !tz || !todayKey) return <Skeleton className="h-[34rem]" />;

  const byDate = new Map((month ?? []).map((d) => [d.date, d]));
  const first = new Date(Date.UTC(cur.y, cur.m - 1, 1));
  const daysInMonth = new Date(Date.UTC(cur.y, cur.m, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
  const adj = cfg?.calendar.hijriAdjust ?? 0;
  const h1 = hijriOf(key(cur.y, cur.m, 1), adj);
  const h2 = hijriOf(key(cur.y, cur.m, daysInMonth), adj);
  const hijriRange = h1.month === h2.month ? `${HIJRI_MONTHS[h1.month - 1]} ${h1.year} AH` : `${HIJRI_MONTHS[h1.month - 1]} – ${HIJRI_MONTHS[h2.month - 1]} ${h2.year} AH`;

  const go = (delta: number) => {
    const d = new Date(Date.UTC(cur.y, cur.m - 1 + delta, 1));
    setCursor({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 });
    setSelected(null);
  };
  const goToday = () => {
    setCursor(null);
    setSelected(todayKey);
  };
  const activeKey = selected ?? (todayKey.startsWith(`${cur.y}-${pad(cur.m)}`) ? todayKey : key(cur.y, cur.m, 1));

  const fmt = (iso: string) => fmtTime(iso, tz, clock);
  const warn = month?.find((d) => d.warnings.length)?.warnings[0];

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="The month’s prayer times and Islamic dates."
        action={<Segmented value={view} onChange={setView} options={[{ value: 'calendar', label: 'Calendar' }, { value: 'table', label: 'Table' }]} />}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-2xl border border-line bg-surface p-1">
          <IconButton label="Previous month" onClick={() => go(-1)}><ChevronLeft className="size-5" /></IconButton>
          <div className="min-w-[10.5rem] text-center">
            <div className="text-lg font-semibold leading-tight">{monthName}</div>
            <div className="text-xs text-muted">{hijriRange}</div>
          </div>
          <IconButton label="Next month" onClick={() => go(1)}><ChevronRight className="size-5" /></IconButton>
        </div>
        <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
        {warn && <Badge tone="gold" title={warn}>Some days use offline calculation</Badge>}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_21rem]">
        <div className="min-w-0">
          {view === 'calendar' ? (
            <Card className="overflow-hidden p-2 sm:p-3">
              <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted">
                {WEEKDAYS.map((w) => <div key={w} className={cn('py-2', w === 'Fri' && 'text-accent')}>{w}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {Array.from({ length: lead }).map((_, i) => <div key={`l${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const k = key(cur.y, cur.m, i + 1);
                  return <DayCell key={k} k={k} day={byDate.get(k)} isToday={k === todayKey} isSel={k === activeKey} loading={isLoading} fmt={fmt} onSelect={() => setSelected(k)} />;
                })}
              </div>
              {isError && <p className="p-4 text-sm text-danger">Couldn’t load this month. Check the server and try again.</p>}
            </Card>
          ) : (
            <TimesTable cur={cur} days={month ?? []} loading={isLoading} todayKey={todayKey} activeKey={activeKey} fmt={fmt} onSelect={setSelected} />
          )}
          <p className="mt-3 text-xs text-muted">Hijri dates follow the Umm al-Qura calendar and can differ by a day from your local moon sighting. Times use your chosen calculation method.</p>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <DayDetail k={activeKey} day={byDate.get(activeKey)} fmt={fmt} isToday={activeKey === todayKey} prayers={cfg?.prayers} />
          <UpcomingEvents todayKey={todayKey} onPick={(date) => { setCursor({ y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)) }); setSelected(date); }} />
        </aside>
      </div>
    </div>
  );
}

function DayCell({ k, day, isToday, isSel, loading, fmt, onSelect }: { k: string; day?: DayTimes; isToday: boolean; isSel: boolean; loading: boolean; fmt: (iso: string) => string; onSelect: () => void }) {
  const adj = useHijriAdjust();
  const h = hijriOf(k, adj);
  const events = eventsFor(h);
  const wd = new Date(`${k}T12:00:00Z`).getUTCDay();
  const ram = isRamadan(h);
  const top = events[0];
  return (
    <button
      onClick={onSelect}
      aria-label={`${k}${top ? `, ${top.name}` : ''}`}
      aria-pressed={isSel}
      className={cn(
        'relative flex min-h-[3.75rem] flex-col items-stretch gap-0.5 rounded-xl border p-1.5 text-left transition sm:min-h-[8.5rem] sm:p-2',
        isSel ? 'border-accent bg-accent-soft ring-2 ring-accent/30' : 'border-transparent bg-surface-2/60 hover:border-line hover:bg-surface-2',
        ram && !isSel && 'bg-gold-soft/70',
        wd === 5 && !isSel && !ram && 'bg-accent-soft/40',
      )}
    >
      <span className="flex items-start justify-between">
        <span className={cn('flex size-6 items-center justify-center rounded-full text-sm font-semibold sm:size-7', isToday && 'bg-accent text-accent-fg')}>{Number(k.slice(8))}</span>
        <span className="text-[10px] text-muted sm:text-xs">{h.day === 1 ? hijriLabel(h, true) : h.day}</span>
      </span>
      {top && (
        <span className={cn('truncate rounded-md px-1 py-0.5 text-[9px] font-semibold leading-tight sm:text-[11px]', KIND_STYLE[top.kind])}>
          <span className="hidden sm:inline">{top.name}</span>
          <span className="sm:hidden">●</span>
        </span>
      )}
      {day ? (
        <span className="mt-auto hidden space-y-px text-[10.5px] leading-tight text-muted tabular md:block">
          {(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as TimeName[]).map((n) => (
            <span key={n} className="flex justify-between gap-1">
              <span>{LABEL[n].slice(0, 3)}</span>
              <span className="text-ink/80">{fmt(day.times[n].time).replace(' AM', 'a').replace(' PM', 'p')}</span>
            </span>
          ))}
        </span>
      ) : (
        loading && <span className="skeleton mt-auto hidden h-12 md:block" />
      )}
    </button>
  );
}

function DayDetail({ k, day, fmt, isToday, prayers }: { k: string; day?: DayTimes; fmt: (iso: string) => string; isToday: boolean; prayers?: Record<string, { enabled: boolean }> }) {
  const adj = useHijriAdjust();
  const h = hijriOf(k, adj);
  const events = eventsFor(h);
  const date = new Date(`${k}T12:00:00Z`);
  const ramadan = isRamadan(h);
  return (
    <Card className="overflow-hidden">
      <div className={cn('border-b border-line p-5', ramadan ? 'bg-linear-to-br from-gold-soft to-transparent' : 'bg-linear-to-br from-accent-soft to-transparent')}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">{isToday ? 'Today' : new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(date)}</div>
            <div className="text-2xl font-semibold tracking-tight">{new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)}</div>
            <div className="mt-0.5 text-sm text-muted">{hijriLabel(h)}</div>
          </div>
          {ramadan && <Badge tone="gold"><Moon className="size-3" /> Ramadan {h.day}</Badge>}
        </div>
        {events.map((e) => (
          <div key={e.name} className="mt-3 rounded-2xl bg-surface/70 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className={cn('size-2.5 rounded-full', e.kind === 'eid' ? 'bg-gold' : 'bg-accent')} /> {e.name}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">{e.about}</p>
          </div>
        ))}
      </div>

      <div className="p-5">
        {!day ? (
          <Skeleton className="h-52" />
        ) : (
          <ul className="divide-y divide-line">
            {TIME_LIST.map((n) => {
              const off = n !== 'sunrise' && prayers && prayers[n]?.enabled === false;
              return (
                <li key={n} className="flex items-center gap-3 py-2.5">
                  <PrayerIcon name={n} className="size-5 text-accent" />
                  <span className="flex-1">
                    <span className="font-medium">{LABEL[n]}</span> <span className="font-arabic text-sm text-muted">{ARABIC[n]}</span>
                  </span>
                  {off && <Badge>Skipped</Badge>}
                  {day.times[n].fixed && <Badge tone="gold">Fixed</Badge>}
                  <span className="text-lg font-semibold tabular">{fmt(day.times[n].time)}</span>
                </li>
              );
            })}
          </ul>
        )}
        {day && ramadan && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-gold-soft p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted"><SunriseIcon className="size-3.5" /> Suhoor ends</div>
              <div className="text-lg font-semibold tabular">{fmt(day.times.fajr.time)}</div>
            </div>
            <div className="rounded-2xl bg-gold-soft p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted"><Utensils className="size-3.5" /> Iftar</div>
              <div className="text-lg font-semibold tabular">{fmt(day.times.maghrib.time)}</div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function TimesTable({ cur, days, loading, todayKey, activeKey, fmt, onSelect }: { cur: { y: number; m: number }; days: DayTimes[]; loading: boolean; todayKey: string; activeKey: string; fmt: (iso: string) => string; onSelect: (k: string) => void }) {
  const adj = useHijriAdjust();
  if (loading) return <Skeleton className="h-[34rem]" />;
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/60 text-left text-xs uppercase tracking-wider text-muted">
              <th className="sticky left-0 z-10 bg-surface-2 px-4 py-3 font-semibold">Date</th>
              {TIME_LIST.map((n) => <th key={n} className="px-3 py-3 text-right font-semibold">{LABEL[n]}</th>)}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const h = hijriOf(d.date, adj);
              const ev = eventsFor(h)[0];
              const wd = new Date(`${d.date}T12:00:00Z`).getUTCDay();
              const isToday = d.date === todayKey;
              return (
                <tr
                  key={d.date}
                  onClick={() => onSelect(d.date)}
                  className={cn('cursor-pointer border-b border-line/60 transition last:border-0 hover:bg-surface-2', isRamadan(h) && 'bg-gold-soft/50', wd === 5 && 'bg-accent-soft/40', d.date === activeKey && 'bg-accent-soft', isToday && 'font-semibold')}
                >
                  <td className={cn('sticky left-0 z-10 px-4 py-2.5', d.date === activeKey ? 'bg-accent-soft' : 'bg-surface')}>
                    <div className="flex items-center gap-2">
                      <span className={cn('flex size-8 items-center justify-center rounded-full text-sm', isToday ? 'bg-accent text-accent-fg' : 'bg-surface-2')}>{Number(d.date.slice(8))}</span>
                      <span>
                        <span className="block leading-tight">{WEEKDAYS[wd]}{wd === 5 && <span className="ml-1 text-[10px] font-semibold uppercase text-accent">Jumu‘ah</span>}</span>
                        <span className="block text-xs font-normal text-muted">{hijriLabel(h, true)}</span>
                      </span>
                    </div>
                    {ev && <span className={cn('mt-1 inline-block max-w-[11rem] truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold', KIND_STYLE[ev.kind])}>{ev.name}</span>}
                  </td>
                  {TIME_LIST.map((n) => <td key={n} className={cn('px-3 py-2.5 text-right tabular', n === 'sunrise' && 'text-muted')}>{fmt(d.times[n].time)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <span className="sr-only">{cur.y}-{cur.m}</span>
    </Card>
  );
}
