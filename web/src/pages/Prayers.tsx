import type { Athan, Prayer, SpeakerView } from '@server/api-types';
import type { PrayerSettings } from '@server/schema';
import { CalendarDays, Copy, Minus, Moon, Play, Plus, Sparkles, Speaker as SpeakerIcon2, Volume2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PrayerIcon } from '@/components/icons';
import { AthanSelect } from '@/components/pickers';
import { SpeakerAvatars, SpeakerPickerDialog } from '@/components/SpeakerPicker';
import { api, useAppState, useAthans, useConfig, useSaveConfig, useSpeakers } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ARABIC, LABEL, PRAYER_LIST, fmtTime } from '@/lib/format';
import { usePrefs } from '@/lib/prefs';
import { useToast } from '@/lib/toast';
import { Badge, Button, Card, Chip, IconButton, PageHeader, Skeleton, Slider, Switch } from '@/ui';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function Prayers() {
  const { data: cfg } = useConfig();
  const { data: athans = [] } = useAthans();
  const { data: sp } = useSpeakers();
  const { data: state } = useAppState();
  const save = useSaveConfig();
  const toast = useToast();
  const { clock } = usePrefs();
  const [sel, setSel] = useState<Prayer | null>(null);

  if (!cfg) return <Skeleton className="h-96" />;
  const speakers = sp?.speakers ?? [];
  const active: Prayer = sel ?? (state?.next?.prayer as Prayer | undefined) ?? 'fajr';
  const tz = state?.location?.timezone;
  const patch = (p: Prayer, v: Partial<PrayerSettings>) => save.mutate({ prayers: { [p]: v } });

  const copyToAll = () => {
    const s = cfg.prayers[active];
    const shared = { athanId: s.athanId, speakerIds: s.speakerIds, volume: s.volume, days: s.days, respectQuietHours: s.respectQuietHours };
    save.mutate({ prayers: Object.fromEntries(PRAYER_LIST.filter((p) => p !== active).map((p) => [p, shared])) }, { onSuccess: () => toast.success(`Applied ${LABEL[active]}’s athan, speakers, volume and days to all prayers`) });
  };

  return (
    <div>
      <PageHeader title="Prayers" subtitle="Pick a prayer to choose its athan, speakers, volume and schedule." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[17rem_1fr]">
        {/* ── Prayer list / tabs ── */}
        <div className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0" role="tablist" aria-label="Prayers">
          {PRAYER_LIST.map((p) => {
            const s = cfg.prayers[p];
            const time = state?.today?.times[p]?.time;
            const athan = athans.find((a) => a.id === (s.athanId ?? cfg.defaultAthanId));
            return (
              <button
                key={p}
                role="tab"
                aria-selected={active === p}
                onClick={() => setSel(p)}
                className={cn(
                  'flex min-w-[9.5rem] shrink-0 snap-start items-center gap-3 rounded-2xl border p-3.5 text-left transition lg:min-w-0',
                  active === p ? 'border-accent bg-accent-soft shadow-card' : 'border-line bg-surface hover:bg-surface-2',
                  !s.enabled && 'opacity-70',
                )}
              >
                <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', active === p ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted')}>
                  <PrayerIcon name={p} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <span className="font-semibold">{LABEL[p]}</span>
                    <span className="font-arabic text-sm text-muted">{ARABIC[p]}</span>
                  </span>
                  <span className="block truncate text-xs text-muted tabular">
                    {time && tz ? fmtTime(time, tz, clock) : '—'} · {s.enabled ? (athan?.name ?? 'Test chime') : 'Off'}
                  </span>
                </span>
                <span className="hidden lg:block" onClick={(e) => e.stopPropagation()}>
                  <Switch checked={s.enabled} onChange={(v) => patch(p, { enabled: v })} label={`Play ${LABEL[p]} athan`} />
                </span>
              </button>
            );
          })}

          <Card className="hidden p-4 lg:block">
            <div className="mb-2 text-sm font-medium">Default athan</div>
            <AthanSelect athans={athans} value={cfg.defaultAthanId} onChange={(v) => save.mutate({ defaultAthanId: v })} defaultLabel="Automatic" />
            <p className="mt-2 text-xs text-muted">Used by prayers that don’t pick their own.</p>
          </Card>
        </div>

        {/* ── Detail ── */}
        <PrayerDetail
          key={active}
          prayer={active}
          s={cfg.prayers[active]}
          speakers={speakers}
          athans={athans}
          time={state?.today?.times[active]?.time}
          tz={tz}
          quietOn={cfg.quietHours.enabled}
          onPatch={(v) => patch(active, v)}
          onCopy={copyToAll}
          defaultAthan={
            <div className="lg:hidden">
              <Card className="p-4">
                <div className="mb-2 text-sm font-medium">Default athan</div>
                <AthanSelect athans={athans} value={cfg.defaultAthanId} onChange={(v) => save.mutate({ defaultAthanId: v })} defaultLabel="Automatic" />
              </Card>
            </div>
          }
          noRealAthan={athans.every((a) => a.builtin)}
        />
      </div>
    </div>
  );
}

function Panel({ icon, title, children, className }: { icon: ReactNode; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-3xl border border-line bg-surface-2/60 p-5', className)}>
      <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
        {icon} {title}
      </h3>
      {children}
    </section>
  );
}

function PrayerDetail({
  prayer, s, speakers, athans, time, tz, quietOn, onPatch, onCopy, defaultAthan, noRealAthan,
}: {
  prayer: Prayer; s: PrayerSettings; speakers: SpeakerView[]; athans: Athan[]; time?: string; tz?: string; quietOn: boolean;
  onPatch: (p: Partial<PrayerSettings>) => void; onCopy: () => void; defaultAthan: ReactNode; noRealAthan: boolean;
}) {
  const toast = useToast();
  const { clock } = usePrefs();
  const [testing, setTesting] = useState(false);
  const [picking, setPicking] = useState(false);
  const custom = s.volume !== null;
  const targets = s.speakerIds.length ? speakers.filter((x) => s.speakerIds.includes(x.id)) : speakers.filter((x) => x.enabled);

  const test = async () => {
    setTesting(true);
    try {
      await api('/play', { method: 'POST', json: { prayer } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  };
  const toggleDay = (d: number) => {
    const next = s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d].sort();
    if (next.length === 0) return toast.info('Turn the prayer off instead of deselecting every day.');
    onPatch({ days: next });
  };

  return (
    <div className="min-w-0 space-y-5">
      {defaultAthan}
      <Card className="overflow-hidden">
        <div className="relative flex flex-wrap items-center gap-4 border-b border-line bg-linear-to-br from-accent-soft to-transparent p-5 sm:p-6">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-card">
            <PrayerIcon name={prayer} className="size-7" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2.5">
              <h2 className="text-2xl font-semibold tracking-tight">{LABEL[prayer]}</h2>
              <span className="font-arabic text-xl text-muted">{ARABIC[prayer]}</span>
            </div>
            <p className="text-sm text-muted tabular">{time && tz ? `Today at ${fmtTime(time, tz, clock)}` : '—'}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{s.enabled ? 'Plays' : 'Skipped'}</span>
            <Switch checked={s.enabled} onChange={(v) => onPatch({ enabled: v })} label={`Play ${LABEL[prayer]} athan`} />
          </div>
        </div>

        {noRealAthan && (
          <p className="mx-5 mt-5 flex items-start gap-2 rounded-2xl bg-gold-soft px-3.5 py-2.5 text-sm sm:mx-6">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-gold" />
            <span>Only the test chime is available. Add real athans in the <Link className="font-medium text-accent underline" to="/library">Library</Link>.</span>
          </p>
        )}

        <div className={cn('grid gap-4 p-5 sm:p-6 md:grid-cols-2', !s.enabled && 'pointer-events-none select-none opacity-50')} aria-disabled={!s.enabled}>
          <Panel icon={<Moon className="size-3.5" />} title="Athan">
            <AthanSelect athans={athans} value={s.athanId} onChange={(v) => onPatch({ athanId: v })} defaultLabel="Use default athan" />
          </Panel>

          <Panel icon={<Volume2 className="size-3.5" />} title="Volume">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm">{custom ? 'Same volume on every speaker' : 'Each speaker’s own volume'}</span>
              <Switch checked={custom} onChange={(v) => onPatch({ volume: v ? 40 : null })} label="Override volume" />
            </div>
            {custom ? (
              <div className="flex items-center gap-3">
                <Slider label={`${LABEL[prayer]} volume`} value={s.volume ?? 40} onCommit={(v) => onPatch({ volume: v })} />
                <span className="w-12 text-right text-lg font-semibold tabular">{s.volume}%</span>
              </div>
            ) : (
              <p className="text-xs text-muted">Set per speaker on the <Link to="/speakers" className="font-medium text-accent underline">Speakers</Link> page.</p>
            )}
          </Panel>

          <Panel icon={<SpeakerIcon2 className="size-3.5" />} title="Play on" className="md:col-span-2">
            <button onClick={() => setPicking(true)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition hover:border-accent">
              {targets.length ? <SpeakerAvatars speakers={targets} max={4} size={40} /> : <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-muted"><SpeakerIcon2 className="size-5" /></span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {s.speakerIds.length === 0 ? 'All enabled speakers' : targets.length === 1 ? targets[0].displayName : `${targets.length} speakers`}
                </span>
                <span className="block truncate text-xs text-muted">{s.speakerIds.length === 0 ? `${targets.length} on right now` : targets.map((x) => x.displayName).join(', ')}</span>
              </span>
              <span className="text-sm font-medium text-accent">Change</span>
            </button>
          </Panel>

          <Panel icon={<CalendarDays className="size-3.5" />} title="Schedule" className="md:col-span-2">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <div className="mb-2 text-sm font-medium">Adjust time</div>
                <div className="inline-flex items-center gap-1 rounded-2xl border border-line bg-surface p-1">
                  <IconButton label="Earlier by 1 minute" className="size-9" onClick={() => onPatch({ offsetMinutes: Math.max(-60, s.offsetMinutes - 1) })}><Minus className="size-4" /></IconButton>
                  <span className="w-20 text-center text-sm font-semibold tabular">{s.offsetMinutes > 0 ? '+' : ''}{s.offsetMinutes} min</span>
                  <IconButton label="Later by 1 minute" className="size-9" onClick={() => onPatch({ offsetMinutes: Math.min(60, s.offsetMinutes + 1) })}><Plus className="size-4" /></IconButton>
                </div>
                <p className="mt-1.5 text-xs text-muted">Earlier or later than the calculated time.</p>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Days</span>
                  {s.days.length < 7 && <button className="text-xs font-medium text-accent hover:underline" onClick={() => onPatch({ days: [0, 1, 2, 3, 4, 5, 6] })}>Every day</button>}
                </div>
                <div className="flex gap-1.5">
                  {DAYS.map((d, i) => (
                    <Chip key={i} active={s.days.includes(i)} onClick={() => toggleDay(i)} aria-label={DAY_NAMES[i]} className="size-9 justify-center px-0">{d}</Chip>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between gap-4 border-t border-line pt-4">
              <div>
                <div className="text-sm font-medium">Respect quiet hours</div>
                <div className="text-xs text-muted">{quietOn ? 'Skip this prayer if it falls inside quiet hours.' : 'Quiet hours are off – set them in Settings.'}</div>
              </div>
              <Switch checked={s.respectQuietHours} onChange={(v) => onPatch({ respectQuietHours: v })} label="Respect quiet hours" />
            </div>
          </Panel>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line p-5 sm:px-6">
          <Button icon={<Play className="size-4 fill-current" />} onClick={test} loading={testing}>Test {LABEL[prayer]} now</Button>
          <Button variant="outline" icon={<Copy className="size-4" />} onClick={onCopy}>Copy to all prayers</Button>
          {!s.enabled && <Badge>Turned off</Badge>}
        </div>
      </Card>

      <SpeakerPickerDialog open={picking} onClose={() => setPicking(false)} speakers={speakers} value={s.speakerIds} onSave={(ids) => onPatch({ speakerIds: ids })} title={`${LABEL[prayer]} – play on`} />
    </div>
  );
}
