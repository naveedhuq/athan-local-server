import type { Athan } from '@server/api-types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Download, ExternalLink, Link2, Music2, Pause, Pencil, Play, Star, Trash2, Upload } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { usePreview } from '@/components/preview';
import { api, useAthans, useCatalog, useConfig, useSaveConfig, type CatalogItem } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtBytes, fmtDuration, LABEL, PRAYER_LIST } from '@/lib/format';
import { useToast } from '@/lib/toast';
import { Badge, Button, Card, Empty, Field, IconButton, Input, Modal, Notice, PageHeader, SectionTitle, Skeleton } from '@/ui';

export function Library() {
  const { data: athans, isLoading } = useAthans();
  const { data: cfg } = useConfig();
  const qc = useQueryClient();
  const toast = useToast();
  const save = useSaveConfig();
  const preview = usePreview();
  const [urlOpen, setUrlOpen] = useState(false);
  const [editing, setEditing] = useState<Athan | null>(null);
  const [deleting, setDeleting] = useState<Athan | null>(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ['athans'] });

  const upload = (file: File) => {
    const form = new FormData();
    form.append('name', file.name.replace(/\.[^.]+$/, ''));
    form.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/athans');
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setProgress(null);
      if (xhr.status < 300) {
        toast.success(`Added “${JSON.parse(xhr.responseText).name}”`);
        refresh();
      } else toast.error(JSON.parse(xhr.responseText || '{}').error ?? 'Upload failed');
    };
    xhr.onerror = () => {
      setProgress(null);
      toast.error('Upload failed – is the server reachable?');
    };
    setProgress(0);
    xhr.send(form);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) upload(f);
  };

  const remove = useMutation({
    mutationFn: (a: Athan) => api(`/athans/${a.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      refresh();
      qc.invalidateQueries({ queryKey: ['config'] });
      setDeleting(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const usedBy = (a: Athan) => PRAYER_LIST.filter((p) => cfg?.prayers[p].athanId === a.id);

  return (
    <div>
      <PageHeader title="Athan library" subtitle="Upload your own recordings or download them from a link. Files are stored on this server and streamed to your speakers." />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={cn('mb-3 flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed p-8 text-center transition', drag ? 'border-accent bg-accent-soft' : 'border-line bg-surface')}
      >
        <div className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Upload className="size-6" />
        </div>
        <div>
          <p className="font-medium">Drop an audio file here</p>
          <p className="text-sm text-muted">MP3, M4A, AAC, WAV, OGG or FLAC · up to 40 MB</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => fileRef.current?.click()} icon={<Upload className="size-4" />} loading={progress !== null}>
            {progress !== null ? `Uploading ${progress}%` : 'Choose file'}
          </Button>
          <Button variant="outline" icon={<Link2 className="size-4" />} onClick={() => setUrlOpen(true)}>
            Add from link
          </Button>
        </div>
        <input ref={fileRef} type="file" hidden accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
      </div>

      <div className="mt-8">
        <SectionTitle title="Your athans" className="mb-4" />
        {isLoading ? (
          <Skeleton className="h-28" />
        ) : (
          <div className="grid gap-3">
            {(athans ?? []).map((a) => {
              const isDefault = cfg?.defaultAthanId === a.id;
              const playing = preview.playingId === a.id;
              return (
                <Card key={a.id} className="flex items-center gap-4 p-4">
                  <button
                    onClick={() => preview.toggle(a)}
                    aria-label={playing ? `Stop ${a.name}` : `Preview ${a.name}`}
                    className={cn('flex size-14 shrink-0 items-center justify-center rounded-2xl transition active:scale-95', playing ? 'bg-accent text-accent-fg' : 'bg-accent-soft text-accent hover:brightness-95')}
                  >
                    {playing ? <Pause className="size-6" /> : <Play className="size-6 fill-current" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold">{a.name}</h3>
                      {a.builtin && <Badge>Built-in</Badge>}
                      {isDefault && <Badge tone="gold"><Star className="size-3 fill-current" /> Default</Badge>}
                      {usedBy(a).map((p) => (
                        <Badge key={p} tone="accent">{LABEL[p]}</Badge>
                      ))}
                    </div>
                    <p className="truncate text-sm text-muted">
                      {[a.muezzin, fmtDuration(a.durationSec), fmtBytes(a.size)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!isDefault && (
                      <IconButton label="Make default athan" onClick={() => save.mutate({ defaultAthanId: a.id })}>
                        <Star className="size-5" />
                      </IconButton>
                    )}
                    {!a.builtin && (
                      <>
                        <IconButton label="Edit details" onClick={() => setEditing(a)}>
                          <Pencil className="size-5" />
                        </IconButton>
                        <IconButton label="Delete" onClick={() => setDeleting(a)} className="text-danger">
                          <Trash2 className="size-5" />
                        </IconButton>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        {athans && athans.every((a) => a.builtin) && (
          <div className="mt-4">
            <Empty icon={<Music2 className="size-6" />} title="Add your first athan">
              Only the built-in test chime is here. Upload a recording or paste a link to one, then pick it on the Prayers page. Many families use a different athan for Fajr.
            </Empty>
          </div>
        )}
      </div>

      <Recommended onDone={refresh} />

      <section className="mt-10">
        <SectionTitle title="More places to find athans" hint="Pick recordings you have the right to use." className="mb-4" />
        <Card className="divide-y divide-line">
          {[
            ['IslamCan – Adhan audio', 'https://www.islamcan.com/audio/adhan/index.shtml', 'Free downloadable adhans from many muezzins, including Makkah and Madinah.'],
            ['Internet Archive', 'https://archive.org/search?query=adhan&sort=-downloads&and%5B%5D=mediatype%3A%22audio%22', 'Search for adhan and azan recordings; check each item’s license.'],
            ['Wikimedia Commons', 'https://commons.wikimedia.org/w/index.php?search=adhan&title=Special:MediaSearch&type=audio', 'Openly licensed (CC / public domain) audio recordings.'],
          ].map(([t, href, d]) => (
            <a key={href} href={href} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-5 py-4 transition hover:bg-surface-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{t}</div>
                <div className="text-sm text-muted">{d}</div>
              </div>
              <ExternalLink className="size-4 shrink-0 text-muted" />
            </a>
          ))}
        </Card>
        <Notice className="mt-4">
          Popular choices: <b>Makkah</b> and <b>Madinah</b> (Haramain), <b>Al-Aqsa</b>, <b>Mishary Alafasy</b>, <b>Nasser Al-Qatami</b>, <b>Abdul-Basit</b>, and for Fajr an athan that includes “as-salatu khayrun min an-nawm”. Most recordings are copyrighted – download from the site, then upload here for personal use.
        </Notice>
      </section>

      <AddFromUrl open={urlOpen} onClose={() => setUrlOpen(false)} onDone={refresh} />
      <EditAthan a={editing} onClose={() => setEditing(null)} onDone={refresh} />
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this athan?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => deleting && remove.mutate(deleting)} loading={remove.isPending}>Delete</Button>
          </>
        }
      >
        <p className="pb-2 text-sm text-muted">“{deleting?.name}” will be removed from this server. Prayers using it fall back to the default athan.</p>
      </Modal>
    </div>
  );
}

function AddFromUrl({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [muezzin, setMuezzin] = useState('');
  const add = useMutation({
    mutationFn: () => api<Athan>('/athans/from-url', { method: 'POST', json: { url: url.trim(), name: name.trim() || undefined, muezzin: muezzin.trim() || undefined } }),
    onSuccess: (a) => {
      toast.success(`Added “${a.name}”`);
      setUrl(''); setName(''); setMuezzin('');
      onDone();
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add from a link"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => add.mutate()} loading={add.isPending} disabled={!/^https?:\/\//.test(url.trim())}>Download</Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <Field label="Direct link to an audio file" hint="Must end in .mp3, .m4a, .wav … The server downloads and keeps its own copy.">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/azan.mp3" inputMode="url" autoFocus />
        </Field>
        <Field label="Name (optional)"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Makkah – Fajr" /></Field>
        <Field label="Muezzin (optional)"><Input value={muezzin} onChange={(e) => setMuezzin(e.target.value)} placeholder="Ali Ahmed Mulla" /></Field>
      </div>
    </Modal>
  );
}

function EditAthan({ a, onClose, onDone }: { a: Athan | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [muezzin, setMuezzin] = useState('');
  const [lastId, setLastId] = useState<string | null>(null);
  if (a && a.id !== lastId) {
    setLastId(a.id);
    setName(a.name);
    setMuezzin(a.muezzin ?? '');
  }
  const save = useMutation({
    mutationFn: () => api(`/athans/${a!.id}`, { method: 'PATCH', json: { name, muezzin: muezzin || null } }),
    onSuccess: () => { onDone(); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Modal open={!!a} onClose={onClose} title="Edit athan" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => save.mutate()} loading={save.isPending} disabled={!name.trim()}>Save</Button></>}>
      <div className="space-y-4 pb-2">
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
        <Field label="Muezzin"><Input value={muezzin} onChange={(e) => setMuezzin(e.target.value)} maxLength={80} /></Field>
      </div>
    </Modal>
  );
}

function Recommended({ onDone }: { onDone: () => void }) {
  const { data: items } = useCatalog();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const install = async (c: CatalogItem) => {
    setBusy(c.id);
    try {
      await api(`/catalog/${c.id}/install`, { method: 'POST' });
      toast.success(`Added “${c.name}”`);
      qc.invalidateQueries({ queryKey: ['catalog'] });
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  if (!items?.length) return null;
  return (
    <section className="mt-10">
      <SectionTitle title="Recommended athans" hint="One tap downloads the file to this server (needs internet once)." className="mb-4" />
      <Card className="divide-y divide-line">
        {items.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{c.name}</div>
              <div className="truncate text-sm text-muted">{[c.muezzin !== c.name ? c.muezzin : null, c.note].filter(Boolean).join(' · ') || 'Athan'}</div>
            </div>
            {c.installed ? (
              <Badge tone="ok"><Check className="size-3" /> Added</Badge>
            ) : (
              <Button size="sm" variant="soft" icon={<Download className="size-4" />} onClick={() => install(c)} loading={busy === c.id} disabled={busy !== null}>
                Add
              </Button>
            )}
          </div>
        ))}
      </Card>
      <p className="mt-3 text-xs text-muted">Source: github.com/abodehq/Athan-MP3. The project doesn’t publish a license, so use these for personal listening at home.</p>
    </section>
  );
}
