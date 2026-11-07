import type { LogEntry, TimeName } from '@server/api-types';
import { BellOff, CheckCircle2, CircleAlert, MapPin, Pause, Play, Radio, SkipForward, Volume2, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LocationPicker } from '@/components/LocationPicker';
import { QuickPlay } from '@/components/QuickPlay';
import { PrayerIcon } from '@/components/icons';
import { TestPlayDialog } from '@/components/TestPlayDialog';
import { useAppState, useConfig, useLog, useSaveConfig, useSpeakers } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ARABIC, LABEL, TIME_LIST, countdown, fmtDateLong, fmtHijri, fmtTime, humanDuration, relative } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { usePrefs } from '@/lib/prefs';
import { useToast } from '@/lib/toast';
import { Badge, Button, Card, Notice, SectionTitle, Select, Skeleton, Switch } from '@/ui';

export function Dashboard() {
  const { data: state, isLoading } = useAppState();
  const { data: cfg } = useConfig();
  const { data: log } = useLog();
  const { data: sp } = useSpeakers();
  const save = useSaveConfig();
  const toast = useToast();
  const { clock } = usePrefs();
  const now = useNow(1000);
  const [testOpen, setTestOpen] = useState(false);

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
          <LocationPicker
            busy={save.isPending}
            onPick={(location) =>
              save.mutate({ location }, { onSuccess: () => toast.success(`Location set to ${location.name}`) })
            }
          />
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
  const paused = !!state.pausedUntil;

  const pause = (value: string) => {
    if (value === 'resume') return save.mutate({ pausedUntil: null });
    const hours = Number(value);
    save.mutate({ pausedUntil: new Date(Date.now() + hours * 3600_000).toISOString() });
  };

  return (
    <div className="space-y-8">
      {/* ───── Hero ───── */}
      <section className="relative overflow-hidden rounded-[2rem] bg-linear-to-br from-[#0f766e] via-[#115e59] to-[#134e4a] p-6 text-white shadow-card sm:p-9 dark:from-[#0d4b49] dark:via-[#0f3b3f] dark:to-[#0d2b33]">
        <div className="pattern pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 text-sm text-white/80">
            <div className="flex items-center gap-1.5 font-medium text-white">
              <MapPin className="size-4" /> <span className="truncate">{state.location.name}</span>
            </div>
            <div className="mt-1">{fmtDateLong(date, tz)}</div>
            <div className="font-arabic text-white/70">{fmtHijri(date, tz)}</div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-black/20 px-3 py-2 backdrop-blur">
            <span className="text-sm font-medium">{state.enabled ? 'Athan on' : 'Athan off'}</span>
            <Switch checked={state.enabled} onChange={(v) => save.mutate({ enabled: v })} label="Enable athan" />
          </div>
        </div>

        {next ? (
          <div className="relative mt-8 grid items-end gap-6 sm:grid-cols-[1fr_auto]">
            <div>
              <div className="text-sm font-medium uppercase tracking-widest text-white/70">Next prayer</div>
              <div className="mt-1 flex items-baseline gap-3">
                <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">{LABEL[next.prayer]}</h1>
                <span className="font-arabic text-3xl text-white/80">{ARABIC[next.prayer]}</span>
              </div>
              <div className="mt-2 text-xl text-white/90 tabular">
                {fmtTime(next.at, tz, clock)}
                <span className="ml-2 text-base text-white/70">in {humanDuration(nextMs)}</span>
              </div>
            </div>
            <div className="flex items-end gap-2 tabular" aria-label={`Countdown ${cd.h} hours ${cd.m} minutes ${cd.s} seconds`}>
              {[
                [cd.h, 'hr'],
                [cd.m, 'min'],
                [cd.s, 'sec'],
              ].map(([v, u]) => (
                <div key={u} className="w-[4.4rem] rounded-2xl bg-black/20 py-2.5 text-center backdrop-blur">
                  <div className="text-3xl font-semibold leading-none">{v}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-wider text-white/60">{u}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="relative mt-8 text-2xl font-semibold">Calculating prayer times…</div>
        )}

        {(paused || !state.enabled) && (
          <div className="relative mt-6 flex flex-wrap items-center gap-2 rounded-2xl bg-black/25 px-4 py-3 text-sm backdrop-blur">
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
          <span>
            Using {today.source === 'offline' ? 'offline calculation' : today.source} – online source unavailable ({today.warnings[0]}). Times are still accurate; they’ll switch back when the connection returns.
          </span>
        </Notice>
      )}

      {/* ───── Quick actions ───── */}
      <div className="flex flex-wrap gap-3">
        <Button icon={<Play className="size-4 fill-current" />} onClick={() => setTestOpen(true)}>
          Play an athan now
        </Button>
        <div className="w-48">
          <Select aria-label="Pause athan" value="" onChange={(e) => e.target.value && pause(e.target.value)} className="bg-surface">
            <option value="">{paused ? 'Pause options…' : 'Pause athan…'}</option>
            <option value="1">For 1 hour</option>
            <option value="4">For 4 hours</option>
            <option value="24">For 24 hours</option>
            <option value="72">For 3 days</option>
            {paused && <option value="resume">Resume now</option>}
          </Select>
        </div>
        <Link to="/speakers" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-line bg-surface px-4 text-sm font-medium transition hover:bg-surface-2">
          <Volume2 className="size-4" /> {state.speakerCount} speaker{state.speakerCount === 1 ? '' : 's'}
        </Link>
      </div>

      <QuickPlay />

      {/* ───── Today ───── */}
      <section>
        <SectionTitle
          title="Today"
          hint={today ? `${today.source === 'cache' ? 'Aladhan (cached)' : today.source === 'aladhan' ? 'Aladhan' : 'Offline calculation'} · ${cfg.calculation.method.toUpperCase()} · ${cfg.calculation.madhab === 'hanafi' ? 'Hanafi' : 'Shafi’i/standard'} Asr` : undefined}
          action={
            <Link to="/prayers" className="whitespace-nowrap text-sm font-medium text-accent hover:underline">
              Edit prayers
            </Link>
          }
          className="mb-4"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {today
            ? TIME_LIST.map((name) => <TimeCard key={name} name={name} iso={today.times[name].time} fixed={today.times[name].fixed} tz={tz} isNext={next?.prayer === name && next.date === today.date} now={now} />)
            : TIME_LIST.map((n) => <Skeleton key={n} className="h-32" />)}
        </div>
      </section>

      {/* ───── Activity ───── */}
      <section>
        <SectionTitle title="Recent activity" hint="Everything the server did lately." className="mb-4" />
        <Card className="divide-y divide-line overflow-hidden">
          {(log ?? []).filter((e) => e.kind !== 'info' || e.message.startsWith('MQTT')).length === 0 ? (
            <div className="p-6 text-center text-sm text-muted">Nothing yet. Played and skipped athans will show up here.</div>
          ) : (
            (log ?? [])
              .filter((e) => e.kind !== 'info' || e.message.startsWith('MQTT'))
              .slice(0, 8)
              .map((e) => <LogRow key={e.id} e={e} />)
          )}
        </Card>
        {sp && sp.speakers.length === 0 && (
          <Notice className="mt-4">
            No speakers found yet. Make sure this server and your speakers are on the same network, then open <Link to="/speakers" className="font-medium text-accent underline">Speakers</Link> to scan.
          </Notice>
        )}
      </section>

      <TestPlayDialog open={testOpen} onClose={() => setTestOpen(false)} />
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
      to={isPrayer ? '/prayers' : '/settings'}
      className={cn(
        'group relative flex flex-col justify-between gap-4 overflow-hidden rounded-3xl border p-4 transition hover:-translate-y-0.5 hover:shadow-card',
        isNext ? 'border-accent bg-accent-soft ring-2 ring-accent/30' : 'border-line bg-surface',
        passed && !isNext && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between">
        <PrayerIcon name={name} className={cn('size-6', isNext ? 'text-accent' : 'text-muted')} />
        <span className="font-arabic text-lg text-muted">{ARABIC[name]}</span>
      </div>
      <div>
        <div className="text-sm font-medium text-muted">{LABEL[name]}</div>
        <div className="text-2xl font-semibold tracking-tight tabular">{fmtTime(iso, tz, clock)}</div>
      </div>
      <div className="flex min-h-6 flex-wrap items-center gap-1.5 text-xs">
        {isNext && <Badge tone="accent">Next</Badge>}
        {passed && !isNext && <CheckCircle2 className="size-4 text-muted" />}
        {fixed && <Badge tone="gold">Fixed</Badge>}
        {ps && !ps.enabled && <Badge><SkipForward className="size-3" /> Skipped</Badge>}
        {ps?.enabled && !isNext && !passed && <Radio className="size-3.5 text-muted" />}
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
      <time className="shrink-0 text-xs text-muted" dateTime={e.ts}>
        {relative(e.ts)}
      </time>
    </div>
  );
}
