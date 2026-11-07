import type { SpeakerType, SpeakerView } from '@server/api-types';
import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { SPEAKER_META } from './icons';
import { SpeakerArt, brandOf, pickKind, type ArtKind } from './SpeakerArt';
import { Button, Modal, Segmented } from '@/ui';

export const artFor = (s: SpeakerView): ArtKind => (s.art as ArtKind | null) ?? pickKind(s.type, s.name, s.model);

/** Overlapping circular thumbnails of speakers. */
export function SpeakerAvatars({ speakers, max = 5, size = 40 }: { speakers: SpeakerView[]; max?: number; size?: number }) {
  const shown = speakers.slice(0, max);
  const extra = speakers.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((s, i) => (
        <span
          key={s.id}
          title={s.displayName}
          style={{ width: size, height: size, marginLeft: i ? -size * 0.28 : 0, zIndex: shown.length - i }}
          className="relative flex items-center justify-center rounded-full border-2 border-surface bg-surface-2"
        >
          <SpeakerArt kind={artFor(s)} size={size * 0.78} dim={!s.online} />
        </span>
      ))}
      {extra > 0 && (
        <span style={{ width: size, height: size, marginLeft: -size * 0.28 }} className="relative flex items-center justify-center rounded-full border-2 border-surface bg-accent-soft text-xs font-semibold text-accent-strong">
          +{extra}
        </span>
      )}
    </div>
  );
}

const ORDER: SpeakerType[] = ['sonos', 'cast', 'airplay', 'local'];

/** Choose "all enabled speakers" or an explicit set, shown as picture tiles. */
export function SpeakerPickerDialog({ open, onClose, speakers, value, onSave, title = 'Choose speakers' }: { open: boolean; onClose: () => void; speakers: SpeakerView[]; value: string[]; onSave: (ids: string[]) => void; title?: string }) {
  const [mode, setMode] = useState<'all' | 'some'>('all');
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => {
    if (open) {
      setMode(value.length ? 'some' : 'all');
      setSel(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (id: string) => setSel((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const canSave = mode === 'all' || sel.length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!canSave} onClick={() => { onSave(mode === 'all' ? [] : sel); onClose(); }}>
            {mode === 'all' ? 'Use all enabled speakers' : `Use ${sel.length} speaker${sel.length === 1 ? '' : 's'}`}
          </Button>
        </>
      }
    >
      <div className="space-y-5 pb-2">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[{ value: 'all', label: 'All enabled speakers' }, { value: 'some', label: 'Choose specific' }]}
        />
        {mode === 'all' ? (
          <p className="text-sm text-muted">Plays on every speaker that is switched on in the Speakers page ({speakers.filter((s) => s.enabled).length} right now). New speakers are included automatically.</p>
        ) : (
          <div className="space-y-5">
            {ORDER.map((type) => {
              const list = speakers.filter((s) => s.type === type);
              if (!list.length) return null;
              return (
                <div key={type}>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{SPEAKER_META[type].plural}</h3>
                    <button className="text-xs font-medium text-accent hover:underline" onClick={() => setSel((l) => (list.every((s) => l.includes(s.id)) ? l.filter((id) => !list.some((s) => s.id === id)) : [...new Set([...l, ...list.map((s) => s.id)])]))}>
                      {list.every((s) => sel.includes(s.id)) ? 'Clear' : 'Select all'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {list.map((s) => {
                      const on = sel.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggle(s.id)}
                          aria-pressed={on}
                          className={cn('relative flex min-w-0 flex-col items-center gap-1 rounded-2xl border p-3 text-center transition active:scale-[.98]', on ? 'border-accent bg-accent-soft' : 'border-line bg-surface-2 hover:bg-surface')}
                        >
                          <span className={cn('absolute right-2 top-2 flex size-5 items-center justify-center rounded-full border transition', on ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-surface')}>
                            {on && <Check className="size-3" strokeWidth={3} />}
                          </span>
                          <SpeakerArt kind={artFor(s)} size={64} dim={!s.enabled || !s.online} />
                          <span className="w-full truncate text-sm font-medium">{s.displayName}</span>
                          <span className="w-full truncate text-xs text-muted">{!s.enabled ? 'Switched off' : !s.online ? 'Not seen recently' : (brandOf(s.name, s.model) ?? SPEAKER_META[s.type].label)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
