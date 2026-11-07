import type { Athan, Prayer, SpeakerView } from '@server/api-types';
import type { PrayerSettings } from '@server/schema';
import { Check, Minus, Play, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AthanSelect, SpeakerChips } from '@/components/pickers';
import { PrayerIcon } from '@/components/icons';
import { api, useAppState, useAthans, useConfig, useSaveConfig, useSpeakers } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ARABIC, LABEL, PRAYER_LIST, fmtTime } from '@/lib/format';
import { usePrefs } from '@/lib/prefs';
import { useToast } from '@/lib/toast';
import { Button, Card, Chip, Field, IconButton, PageHeader, Row, Skeleton, Slider, Switch } from '@/ui';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function Prayers() {
  const { data: cfg } = useConfig();
  const { data: athans = [] } = useAthans();
  const { data: sp } = useSpeakers();
  const { data: state } = useAppState();
  const save = useSaveConfig();

  if (!cfg) return <Skeleton className="h-96" />;
  const speakers = sp?.speakers ?? [];

  return (
    <div>
      <PageHeader title="Prayers" subtitle="Choose which prayers play, which athan, and where. Each prayer can use different speakers and volume." />

      <Card className="mb-6 p-5">
        <Field label="Default athan" hint="Used by every prayer that doesn’t have its own choice below.">
          <AthanSelect athans={athans} value={cfg.defaultAthanId} onChange={(v) => save.mutate({ defaultAthanId: v })} defaultLabel="Automatic (first athan in your library)" />
        </Field>
        {athans.every((a) => a.builtin) && (
          <p className="mt-3 flex items-start gap-2 rounded-2xl bg-gold-soft px-3.5 py-2.5 text-sm">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-gold" />
            <span>
              Only the test chime is available. Add a real athan in the <Link className="font-medium text-accent underline" to="/library">Library</Link>.
            </span>
          </p>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {PRAYER_LIST.map((p) => (
          <PrayerCard key={p} prayer={p} s={cfg.prayers[p]} speakers={speakers} athans={athans} time={state?.today?.times[p]?.time} tz={state?.location?.timezone} onPatch={(patch) => save.mutate({ prayers: { [p]: patch } })} hasQuiet={cfg.quietHours.enabled} />
        ))}
      </div>
    </div>
  );
}

function PrayerCard({
  prayer,
  s,
  speakers,
  athans,
  time,
  tz,
  onPatch,
  hasQuiet,
}: {
  prayer: Prayer;
  s: PrayerSettings;
  speakers: SpeakerView[];
  athans: Athan[];
  time?: string;
  tz?: string;
  onPatch: (p: Partial<PrayerSettings>) => void;
  hasQuiet: boolean;
}) {
  const toast = useToast();
  const { clock } = usePrefs();
  const [testing, setTesting] = useState(false);
  const [custom, setCustom] = useState(s.volume !== null);
  const allDays = s.days.length === 7;

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
    <Card className={cn('overflow-hidden transition', !s.enabled && 'opacity-80')}>
      <div className="flex items-center gap-4 border-b border-line p-5">
        <div className={cn('flex size-12 items-center justify-center rounded-2xl', s.enabled ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted')}>
          <PrayerIcon name={prayer} className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h2 className="text-xl font-semibold">{LABEL[prayer]}</h2>
            <span className="font-arabic text-lg text-muted">{ARABIC[prayer]}</span>
          </div>
          <div className="text-sm text-muted tabular">{time && tz ? `Today ${fmtTime(time, tz, clock)}` : '—'}</div>
        </div>
        <Switch checked={s.enabled} onChange={(v) => onPatch({ enabled: v })} label={`Play ${LABEL[prayer]} athan`} />
      </div>

      <div className={cn('space-y-5 p-5', !s.enabled && 'pointer-events-none select-none opacity-50')} aria-disabled={!s.enabled}>
        <Field label="Athan">
          <AthanSelect athans={athans} value={s.athanId} onChange={(v) => onPatch({ athanId: v })} defaultLabel="Use default athan" />
        </Field>

        <Field label="Play on">
          <SpeakerChips speakers={speakers} value={s.speakerIds} onChange={(ids) => onPatch({ speakerIds: ids })} />
        </Field>

        <div>
          <Row title="Volume" hint={custom ? 'Same volume on every speaker for this prayer.' : 'Each speaker uses its own volume from the Speakers page.'} className="py-0 pb-2">
            <Switch checked={custom} onChange={(v) => { setCustom(v); onPatch({ volume: v ? 40 : null }); }} label="Override volume" />
          </Row>
          {custom && (
            <div className="flex items-center gap-3">
              <Slider label={`${LABEL[prayer]} volume`} value={s.volume ?? 40} onCommit={(v) => onPatch({ volume: v })} />
              <span className="w-10 text-right text-sm font-medium tabular">{s.volume ?? 40}%</span>
            </div>
          )}
        </div>

        <Row title="Adjust time" hint="Shift the call earlier or later than the calculated time.">
          <div className="flex items-center gap-1 rounded-2xl border border-line bg-surface-2 p-1">
            <IconButton label="Earlier by 1 minute" className="size-9" onClick={() => onPatch({ offsetMinutes: Math.max(-60, s.offsetMinutes - 1) })}>
              <Minus className="size-4" />
            </IconButton>
            <span className="w-16 text-center text-sm font-medium tabular">{s.offsetMinutes > 0 ? '+' : ''}{s.offsetMinutes} min</span>
            <IconButton label="Later by 1 minute" className="size-9" onClick={() => onPatch({ offsetMinutes: Math.min(60, s.offsetMinutes + 1) })}>
              <Plus className="size-4" />
            </IconButton>
          </div>
        </Row>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Days</span>
            <button className="text-xs font-medium text-accent hover:underline" onClick={() => onPatch({ days: [0, 1, 2, 3, 4, 5, 6] })} hidden={allDays}>
              Every day
            </button>
          </div>
          <div className="flex gap-1.5">
            {DAYS.map((d, i) => (
              <Chip key={i} active={s.days.includes(i)} onClick={() => toggleDay(i)} aria-label={DAY_NAMES[i]} className="size-10 justify-center px-0">
                {d}
              </Chip>
            ))}
          </div>
        </div>

        <Row title="Respect quiet hours" hint={hasQuiet ? 'Skip this prayer if it falls inside your quiet hours.' : 'Quiet hours are off. Set them in Settings.'}>
          <Switch checked={s.respectQuietHours} onChange={(v) => onPatch({ respectQuietHours: v })} label="Respect quiet hours" />
        </Row>

        <Button variant="soft" className="w-full" icon={testing ? <Check className="size-4" /> : <Play className="size-4 fill-current" />} onClick={test} loading={testing}>
          Test {LABEL[prayer]} now
        </Button>
      </div>
    </Card>
  );
}
