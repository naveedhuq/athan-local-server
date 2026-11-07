import type { LogEntry, TimeName } from '@server/api-types';
import { BellOff, CheckCircle2, ChevronDown, CircleAlert, MapPin, Moon, Pause, Play, SkipForward, Sunrise as SunriseIcon, Utensils, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LocationPicker } from '@/components/LocationPicker';
import { PrayerIcon } from '@/components/icons';
import { QuickPlay } from '@/components/QuickPlay';
import { UpcomingEvents } from '@/components/UpcomingEvents';
import { useAppState, useConfig, useLog, useSaveConfig, useSpeakers } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ARABIC, LABEL, TIME_LIST, countdown, fmtDateLong, fmtTime, humanDuration, relative } from '@/lib/format';
import { eventsFor, hijriLabel, hijriOf, isRamadan } from '@/lib/hijri';
import { useNow } from '@/lib/hooks';
import { usePrefs } from '@/lib/prefs';
import { useToast } from '@/lib/toast';
import { Badge, Button, Card, Notice, SectionTitle, Skeleton, Switch } from '@/ui';

export function Dashboard() {
  const { data: state, isLoading } = useAppState();
  const { data: cfg } = useConfig();
  const { data: log } = useLog();
  const { data: sp } = useSpeakers();
  const save = useSaveConfig();
  const toast = useToast();
  const { clock } = usePrefs();
  const now = useNow(1000);

  if (isLoading || !state || !cfg) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  /* ── First run: pick a location ── */
  if (!state.configured || !state.location) {
    return (
      <div className="mx-auto max-w-xl space-y-6 pt-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-3xl bg-accent text-accent-fg shadow-card">
            <MapPin className="size-8" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Welcome 👋</h1>
          <p className="mt-2 text-muted">Let’s start with where you are, so prayer times are accurate for your location.</p>
        </div>
        <Card className="p-5">
          <LocationPicker busy={save.isPending} onPick={(location) => save.mutate({ location }, { onSuccess: () => toast.success(`Location set to ${location.name}`) })} />
        </Card>
        <ol className="space-y-2 text-sm text-muted">
          <li className="flex gap-3"><Badge tone="accent">1</Badge> Pick your location</li>
          <li className="flex gap-3"><Badge>2</Badge> Check your speakers on the Speakers page</li>
          <li className="flex gap-3"><Badge>3</Badge> Add an athan to the Library and choose it per prayer</li>
        </ol>
      </div>
    );
  }

  const tz = state.location.timezone;
  const today = state.today;
  const next = state.next;
  const nextMs = next ? new Date(next.at).getTime() - now : 0;
  const cd = countdown(nextMs);
  const date = new Date(now);
  const todayKey = today?.date ?? new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(date);
  const hijri = hijriOf(todayKey);
  const todaysEvents = eventsFor(hijri);
  const paused = !!state.pausedUntil;

  const pause = (value: string) => {
    if (value === 'resume') return save.mutate({ pausedUntil: null });
    save.mutate({ pausedUntil: new Date(Date.now() + Number(value) * 3600_000).toISOString() });
  };
  const events = (log ?? []).filter((e) => e.kind !== 'info' || e.message.startsWith('MQTT'));

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* ───── Hero ───── */}
      <section className="relative overflow-hidden rounded-[2rem] bg-linear-to-br from-[#0f766e] via-[#115e59] to-[#134e4a] p-5 text-white shadow-card sm:p-8 dark:from-[#0d4b49] dark:via-[#0f3b3f] dark:to-[#0d2b33]">
        <div className="pattern pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 text-sm text-white/80">
            <div className="flex items-center gap-1.5 font-medium text-white">
              <MapPin className="size-4 shrink-0" /> <span className="truncate">{state.location.name}</span>
            </div>
            <div className="mt-1">{fmtDateLong(date, tz)}</div>
            <div className="font-arabic text-white/70">{hijriLabel(hijri)}</div>
          </div>
          <div className="flex items-center gap-2">
            <label className="relative">
              <span className="sr-only">Pause athan</span>
              <select
                value=""
                onChange={(e) => e.target.value && pause(e.target.value)}
                className="h-10 cursor-pointer appearance-none rounded-2xl bg-black/20 pl-3.5 pr-8 text-sm font-medium text-white backdrop-blur transition hover:bg-black/30 focus:outline-none"
              >
                <option value="" className="text-black">{paused ? 'Paused…' : 'Pause…'}</option>
                <option value="1" className="text-black">For 1 hour</option>
                <option value="4" className="text-black">For 4 hours</option>
                <option value="24" className="text-black">For 24 hours</option>
                <option value="72" className="text-black">For 3 days</option>
                {paused && <option value="resume" className="text-black">Resume now</option>}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-white/70" />
            </label>
            <div className="flex h-10 items-center gap-2.5 rounded-2xl bg-black/20 pl-3.5 pr-2 backdrop-blur">
              <span className="text-sm font-medium">{state.enabled ? 'Athan on' : 'Athan off'}</span>
              <Switch checked={state.enabled} onChange={(v) => save.mutate({ enabled: v })} label="Enable athan" />
            </div>
          </div>
        </div>

        {next ? (
          <div className="relative mt-7 grid items-end gap-5 sm:grid-cols-[1fr_auto]">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Next prayer</div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
                <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">{LABEL[next.prayer]}</h1>
                <span className="font-arabic text-3xl text-white/80">{ARABIC[next.prayer]}</span>
              </div>
              <div className="mt-2 text-xl text-white/90 tabular">
                {fmtTime(next.at, tz, clock)}
                <span className="ml-2 text-base text-white/70">in {humanDuration(nextMs)}</span>
              </div>
            </div>
            <div className="flex items-end gap-2 tabular" role="timer" aria-label={`Countdown ${cd.h} hours ${cd.m} minutes ${cd.s} seconds`}>
              {[[cd.h, 'hr'], [cd.m, 'min'], [cd.s, 'sec']].map(([v, u]) => (
                <div key={u} className="w-[4.2rem] rounded-2xl bg-black/20 py-2.5 text-center backdrop-blur">
                  <div className="text-3xl font-semibold leading-none">{v}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-wider text-white/60">{u}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="relative mt-7 text-2xl font-semibold">Calculating prayer times…</div>
        )}

        {todaysEvents.length > 0 && (
          <div className="relative mt-5 inline-flex items-center gap-2 rounded-full bg-gold/90 px-3.5 py-1.5 text-sm font-semibold text-[#2b1d00]">
            <Moon className="size-4" /> {todaysEvents[0].name}
          </div>
        )}

        {(paused || !state.enabled) && (
          <div className="relative mt-5 flex flex-wrap items-center gap-2 rounded-2xl bg-black/25 px-4 py-3 text-sm backdrop-blur">
            <BellOff className="size-4" />
            {paused ? <>Paused until {fmtTime(state.pausedUntil!, tz, clock)}. Athans are skipped until then.</> : <>The athan is switched off – nothing will play.</>}
            {paused && (
              <Button size="sm" variant="outline" className="ml-auto border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => pause('resume')}>
                Resume now
              </Button>
            )}
          </div>
        )}
      </section>

      {today && today.warnings.length > 0 && (
        <Notice tone="warn" className="flex items-start gap-3">
          <WifiOff className="mt-0.5 size-4 shrink-0" />
          <span>Using {today.source === 'offline' ? 'offline calculation' : today.source} – online source unavailable. Times are still accurate and will switch back when the connection returns.</span>
        </Notice>
      )}

      {/* ───── Today ───── */}
      <section>
        <SectionTitle
          title="Today"
          hint={today ? `${today.source === 'cache' ? 'Aladhan (cached)' : today.source === 'aladhan' ? 'Aladhan' : 'Offline calculation'} · ${cfg.calculation.method.toUpperCase()}` : undefined}
          action={<Link to="/calendar" className="whitespace-nowrap text-sm font-medium text-accent hover:underline">Month view</Link>}
          className="mb-4"
        />
        {today && <DayTimeline times={today.times} now={now} />}
        <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3 xl:grid-cols-6">
          {today
            ? TIME_LIST.map((name) => <TimeCard key={name} name={name} iso={today.times[name].time} fixed={today.times[name].fixed} tz={tz} isNext={next?.prayer === name && next.date === today.date} now={now} />)
            : TIME_LIST.map((n) => <Skeleton key={n} className="h-28" />)}
        </div>
      </section>

      {/* ───── Play + events ───── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_21rem] xl:gap-8">
        <div className="min-w-0 space-y-6 lg:space-y-8">
          <QuickPlay />
          <Card className="overflow-hidden">
            <div className="p-5 pb-3 sm:px-6">
              <h2 className="text-lg font-semibold tracking-tight">Recent activity</h2>
              <p className="mt-0.5 text-sm text-muted">Everything the server did lately.</p>
            </div>
            <div className="divide-y divide-line border-t border-line">
              {events.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted">Nothing yet. Played and skipped athans will show up here.</div>
              ) : (
                events.slice(0, 6).map((e) => <LogRow key={e.id} e={e} />)
              )}
            </div>
            {sp && sp.speakers.length === 0 && (
              <div className="border-t border-line p-4">
                <Notice>
                  No speakers found yet. Make sure this server and your speakers are on the same network, then open <Link to="/speakers" className="font-medium text-accent underline">Speakers</Link> to scan.
                </Notice>
              </div>
            )}
          </Card>
        </div>

        <aside className="min-w-0 space-y-6 xl:sticky xl:top-6 xl:self-start">
          {isRamadan(hijri) && today && (
            <Card className="overflow-hidden">
              <div className="bg-linear-to-br from-gold-soft to-transparent p-5">
                <div className="flex items-center gap-2 text-sm font-semibold"><Moon className="size-4 text-gold" /> Ramadan · day {hijri.day}</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-surface/70 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted"><SunriseIcon className="size-3.5" /> Suhoor ends</div>
                    <div className="text-lg font-semibold tabular">{fmtTime(today.times.fajr.time, tz, clock)}</div>
                  </div>
                  <div className="rounded-2xl bg-surface/70 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted"><Utensils className="size-3.5" /> Iftar</div>
                    <div className="text-lg font-semibold tabular">{fmtTime(today.times.maghrib.time, tz, clock)}</div>
                  </div>
                </div>
              </div>
            </Card>
          )}
          <UpcomingEvents todayKey={todayKey} limit={5} />
        </aside>
      </div>
    </div>
  );
}

/** A slim bar for the day: dots at each prayer, filled up to "now". */
function DayTimeline({ times, now }: { times: Record<TimeName, { time: string }>; now: number }) {
  const t = (n: TimeName) => new Date(times[n].time).getTime();
  const start = t('fajr') - 40 * 60_000;
  const end = t('isha') + 40 * 60_000;
  const pct = (ms: number) => Math.min(100, Math.max(0, ((ms - start) / (end - start)) * 100));
  const nowPct = pct(now);
  return (
    <div className="relative h-6" aria-hidden>
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-2" />
      <div className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent transition-[width] duration-1000" style={{ width: `${nowPct}%` }} />
      {TIME_LIST.map((n) => {
        const left = pct(t(n));
        const passed = t(n) < now;
        return (
          <span
            key={n}
            className={cn('absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface', n === 'sunrise' ? 'size-2.5' : 'size-4', passed ? 'bg-accent' : 'bg-line')}
            style={{ left: `${left}%` }}
          />
        );
      })}
      {now > start && now < end && (
        <span className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/25" style={{ left: `${nowPct}%` }}>
          <span className="absolute inset-1 animate-pulse rounded-full bg-accent" />
        </span>
      )}
    </div>
  );
}

function TimeCard({ name, iso, fixed, tz, isNext, now }: { name: TimeName; iso: string; fixed: boolean; tz: string; isNext: boolean; now: number }) {
  const { data: cfg } = useConfig();
  const { clock } = usePrefs();
  const passed = new Date(iso).getTime() < now;
  const isPrayer = name !== 'sunrise';
  const ps = isPrayer ? cfg?.prayers[name as Exclude<TimeName, 'sunrise'>] : null;
  return (
    <Link
      to={isPrayer ? '/prayers' : '/calendar'}
      className={cn(
        'group relative flex flex-col justify-between gap-3 overflow-hidden rounded-3xl border p-3 transition hover:-translate-y-0.5 hover:shadow-card sm:gap-4 sm:p-4',
        isNext ? 'border-accent bg-accent-soft ring-2 ring-accent/30' : 'border-line bg-surface',
        passed && !isNext && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between">
        <PrayerIcon name={name} className={cn('size-5 sm:size-6', isNext ? 'text-accent' : 'text-muted')} />
        <span className="font-arabic text-base text-muted sm:text-lg">{ARABIC[name]}</span>
      </div>
      <div>
        <div className="text-xs font-medium text-muted sm:text-sm">{LABEL[name]}</div>
        <div className="text-lg font-semibold tracking-tight tabular sm:text-2xl">{fmtTime(iso, tz, clock)}</div>
      </div>
      <div className="flex min-h-5 flex-wrap items-center gap-1.5 text-xs">
        {isNext && <Badge tone="accent">Next</Badge>}
        {passed && !isNext && <CheckCircle2 className="size-4 text-muted" />}
        {fixed && <Badge tone="gold">Fixed</Badge>}
        {ps && !ps.enabled && <Badge><SkipForward className="size-3" /> Skipped</Badge>}
        {!isPrayer && <span className="text-muted">No athan</span>}
      </div>
    </Link>
  );
}

function LogRow({ e }: { e: LogEntry }) {
  const Icon = e.kind === 'error' ? CircleAlert : e.kind === 'skipped' ? SkipForward : e.kind === 'finished' ? CheckCircle2 : e.kind === 'started' ? Play : Pause;
  const tone = e.kind === 'error' ? 'text-danger' : e.kind === 'skipped' ? 'text-gold' : 'text-accent';
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Icon className={cn('mt-0.5 size-4 shrink-0', tone)} />
      <p className="min-w-0 flex-1 text-sm leading-snug">{e.message}</p>
      <time className="shrink-0 text-xs text-muted" dateTime={e.ts}>{relative(e.ts)}</time>
    </div>
  );
}
