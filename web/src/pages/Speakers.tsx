import type { SpeakerType, SpeakerView } from '@server/api-types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Play, Plus, RefreshCw, Trash2, Volume2, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { SPEAKER_META, SpeakerIcon } from '@/components/icons';
import { ART_LABEL, SpeakerArt, brandOf, pickKind, type ArtKind } from '@/components/SpeakerArt';
import { TestPlayDialog } from '@/components/TestPlayDialog';
import { api, useAppState, useSaveConfig, useSpeakers } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/toast';
import { Badge, Button, Card, Empty, Field, IconButton, Input, Modal, Notice, PageHeader, Select, Skeleton, Slider, Switch } from '@/ui';

const ORDER: SpeakerType[] = ['sonos', 'cast', 'airplay', 'local'];

export function Speakers() {
  const { data, isLoading } = useSpeakers();
  const { data: state } = useAppState();
  const qc = useQueryClient();
  const toast = useToast();
  const [scanning, setScanning] = useState(false);
  const [adding, setAdding] = useState(false);
  const [testIds, setTestIds] = useState<string[] | null>(null);
  const [editing, setEditing] = useState<SpeakerView | null>(null);

  const scan = async () => {
    setScanning(true);
    try {
      await api('/speakers/scan', { method: 'POST' });
      // discovery answers trickle in over a few seconds
      for (const ms of [1500, 4000, 8000]) setTimeout(() => qc.invalidateQueries({ queryKey: ['speakers'] }), ms);
      await new Promise((r) => setTimeout(r, 4000));
      toast.info('Scan finished. New speakers show up as they respond.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setScanning(false);
    }
  };

  const speakers = data?.speakers ?? [];
  const playingIds = new Set(state?.player.status === 'playing' ? state.player.speakers.filter((x) => x.state === 'playing').map((x) => x.id) : []);
  const drivers = data?.drivers ?? {};

  return (
    <div>
      <PageHeader
        title="Speakers"
        subtitle="Sonos, Google Cast / Nest and AirPlay speakers on your network are found automatically."
        action={
          <div className="flex gap-2">
            <Button variant="outline" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
              Add by IP
            </Button>
            <Button icon={<RefreshCw className={cn('size-4', scanning && 'animate-spin')} />} onClick={scan} disabled={scanning}>
              {scanning ? 'Scanning…' : 'Scan network'}
            </Button>
          </div>
        }
      />

      {drivers.airplay && !drivers.airplay.ok && speakers.some((s) => s.type === 'airplay') && <Notice tone="warn" className="mb-4">{drivers.airplay.reason}</Notice>}
      {drivers.local && !drivers.local.ok && speakers.some((s) => s.type === 'local' && s.enabled) && <Notice tone="warn" className="mb-4">{drivers.local.reason}</Notice>}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      ) : speakers.length === 0 ? (
        <Empty icon={<WifiOff className="size-6" />} title="No speakers found yet" action={<Button onClick={scan}>Scan network</Button>}>
          Your speakers and this server must be on the same network (and VLAN). If you run this in Docker, use host networking so discovery works. You can also add a speaker by its IP address.
        </Empty>
      ) : (
        <div className="space-y-8">
          {ORDER.map((type) => {
            const list = speakers.filter((s) => s.type === type);
            if (!list.length) return null;
            return (
              <section key={type}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
                  <SpeakerIcon type={type} className="size-4" /> {SPEAKER_META[type].plural}
                  <Badge>{list.length}</Badge>
                </h2>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((s) => (
                    <SpeakerCard key={s.id} s={s} playing={playingIds.has(s.id)} onTest={() => setTestIds([s.id])} onEdit={() => setEditing(s)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {state && state.speakerCount > 0 && speakers.length > 0 && (
        <p className="mt-8 text-xs text-muted">Tip: Sonos speakers that are grouped play together. Ungroup them in the Sonos app if you want separate rooms per prayer. Sonos and Cast return to what they were playing afterwards.</p>
      )}

      <TestPlayDialog open={testIds !== null} onClose={() => setTestIds(null)} initialSpeakerIds={testIds ?? []} />
      <AddSpeaker open={adding} onClose={() => setAdding(false)} />
      <EditSpeaker s={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

const HUE: Record<SpeakerType, string> = { sonos: '#f2b84b', cast: '#4f8df7', airplay: '#a78bfa', local: '#2dd4bf' };

function SpeakerCard({ s, playing, onTest, onEdit }: { s: SpeakerView; playing: boolean; onTest: () => void; onEdit: () => void }) {
  const save = useSaveConfig();
  const set = (patch: { enabled?: boolean; volume?: number }) => save.mutate({ speakers: { [s.id]: patch } });
  const kind = (s.art as ArtKind | null) ?? pickKind(s.type, s.name, s.model);
  const brand = brandOf(s.name, s.model);
  const off = !s.enabled || !s.online;
  return (
    <Card className={cn('group flex min-w-0 flex-col overflow-hidden p-0 transition hover:-translate-y-0.5', playing && 'ring-2 ring-accent')}>
      <div
        className="relative flex h-44 items-center justify-center overflow-hidden"
        style={{ background: `radial-gradient(90% 90% at 50% 0%, color-mix(in oklab, ${HUE[s.type]} 26%, transparent), transparent 72%), var(--surface-2)` }}
      >
        {playing && (
          <>
            <span className="ring-wave absolute size-28 rounded-full border-2 border-accent" />
            <span className="ring-wave absolute size-28 rounded-full border-2 border-accent [animation-delay:.8s]" />
          </>
        )}
        <SpeakerArt kind={kind} size={128} active={playing} dim={off} className="relative drop-shadow-[0_10px_14px_rgba(0,0,0,.28)] transition group-hover:scale-105" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-surface/80 px-2.5 py-1 text-xs font-medium backdrop-blur">
          <SpeakerIcon type={s.type} className="size-3.5" style={{ color: HUE[s.type] }} />
          {brand ?? SPEAKER_META[s.type].label}
        </span>
        <div className="absolute right-3 top-3">
          <Switch checked={s.enabled} onChange={(v) => set({ enabled: v })} label={`Use ${s.displayName}`} />
        </div>
        <span className={cn('absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-surface/80 px-2.5 py-1 text-xs font-medium backdrop-blur', s.online ? 'text-ok' : 'text-muted')}>
          <span className={cn('size-1.5 rounded-full', s.online ? 'bg-ok' : 'bg-muted')} />
          {playing ? 'Playing' : s.online ? 'Online' : 'Not seen recently'}
        </span>
        {s.mock && <Badge tone="gold" className="absolute bottom-3 right-3">Demo</Badge>}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold leading-tight">{s.displayName}</h3>
          <p className="truncate text-xs text-muted">{[s.model, s.type !== 'local' ? s.host : null].filter(Boolean).join(' · ')}</p>
        </div>

        <div className="flex items-center gap-3">
          <Volume2 className="size-4 shrink-0 text-muted" />
          <Slider label={`${s.displayName} volume`} value={s.volume} onCommit={(v) => set({ volume: v })} />
          <span className="w-10 text-right text-sm font-medium tabular">{s.volume}%</span>
        </div>

        <div className="mt-auto flex gap-2">
          <Button variant="soft" size="sm" className="flex-1" icon={<Play className="size-4 fill-current" />} onClick={onTest}>
            Test
          </Button>
          <IconButton label="Rename or remove" variant="outline" className="size-9" onClick={onEdit}>
            <Pencil className="size-4" />
          </IconButton>
        </div>
      </div>
    </Card>
  );
}

function AddSpeaker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [type, setType] = useState<'sonos' | 'cast' | 'airplay'>('sonos');
  const [host, setHost] = useState('');
  const [name, setName] = useState('');
  const add = useMutation({
    mutationFn: () => api('/speakers/manual', { method: 'POST', json: { type, host, name: name || undefined } }),
    onSuccess: () => {
      toast.success('Speaker added');
      qc.invalidateQueries({ queryKey: ['speakers'] });
      setHost('');
      setName('');
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a speaker by IP address"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => add.mutate()} loading={add.isPending} disabled={host.trim().length < 3}>
            Add speaker
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <p className="text-sm text-muted">Useful when your router blocks discovery between networks (VLANs, guest Wi-Fi, mesh isolation).</p>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="sonos">Sonos</option>
            <option value="cast">Google Cast / Nest</option>
            <option value="airplay">AirPlay</option>
          </Select>
        </Field>
        <Field label="IP address">
          <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.1.50" inputMode="decimal" />
        </Field>
        <Field label="Name (optional)">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kitchen" />
        </Field>
      </div>
    </Modal>
  );
}

function EditSpeaker({ s, onClose }: { s: SpeakerView | null; onClose: () => void }) {
  const save = useSaveConfig();
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [art, setArt] = useState<ArtKind | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  if (s && s.id !== lastId) {
    setLastId(s.id);
    setName(s.nickname ?? '');
    setArt((s.art as ArtKind | null) ?? null);
  }
  const remove = useMutation({
    mutationFn: () => api(`/speakers/${encodeURIComponent(s!.id)}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['speakers'] });
      onClose();
      toast.info('Removed. It will reappear if it’s still on your network.');
    },
  });
  return (
    <Modal
      open={!!s}
      onClose={onClose}
      title={s?.name ?? ''}
      footer={
        <>
          <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => remove.mutate()} className="mr-auto">
            Forget
          </Button>
          <Button
            onClick={() => {
              save.mutate({ speakers: { [s!.id]: { nickname: name.trim() || null, art } } });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <Field label="Display name" hint={`Leave empty to use “${s?.name}”.`}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={s?.name} maxLength={60} />
        </Field>
        <Field label="Picture" hint={s ? `Detected automatically as “${ART_LABEL[pickKind(s.type, s.name, s.model)]}”. Pick another if it looks wrong.` : undefined}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <button onClick={() => setArt(null)} className={cn('flex h-24 flex-col items-center justify-center gap-1 rounded-2xl border text-xs font-medium transition', art === null ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line bg-surface-2 text-muted hover:text-ink')}>
              {s && <SpeakerArt kind={pickKind(s.type, s.name, s.model)} size={52} />}
              Automatic
            </button>
            {(Object.keys(ART_LABEL) as ArtKind[]).filter((k) => k !== 'pi' || s?.type === 'local').map((k) => (
              <button key={k} onClick={() => setArt(k)} aria-label={ART_LABEL[k]} title={ART_LABEL[k]} className={cn('flex h-24 flex-col items-center justify-center gap-1 rounded-2xl border px-1 text-center text-[11px] leading-tight font-medium transition', art === k ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line bg-surface-2 text-muted hover:text-ink')}>
                <SpeakerArt kind={k} size={52} />
                {ART_LABEL[k]}
              </button>
            ))}
          </div>
        </Field>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Type</dt>
          <dd>{s && SPEAKER_META[s.type].label}</dd>
          <dt className="text-muted">Address</dt>
          <dd className="tabular">{s?.host}{s?.port ? `:${s.port}` : ''}</dd>
          <dt className="text-muted">Model</dt>
          <dd>{s?.model ?? '—'}</dd>
          <dt className="text-muted">ID</dt>
          <dd className="truncate text-xs text-muted">{s?.id}</dd>
        </dl>
      </div>
    </Modal>
  );
}
