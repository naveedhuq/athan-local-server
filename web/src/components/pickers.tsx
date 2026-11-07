import type { Athan, SpeakerView } from '@server/api-types';
import { Check, Pause, Play } from 'lucide-react';
import { fmtDuration } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Chip, IconButton, Select } from '@/ui';
import { usePreview } from './preview';
import { SpeakerIcon } from './icons';

/** Dropdown of athans with an inline preview button. */
export function AthanSelect({ athans, value, onChange, defaultLabel }: { athans: Athan[]; value: string | null; onChange: (v: string | null) => void; defaultLabel?: string }) {
  const preview = usePreview();
  const current = athans.find((a) => a.id === value);
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <Select aria-label="Athan" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
          {defaultLabel && <option value="">{defaultLabel}</option>}
          {athans.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.muezzin ? ` — ${a.muezzin}` : ''} ({fmtDuration(a.durationSec)})
            </option>
          ))}
        </Select>
      </div>
      {current && (
        <IconButton label={preview.playingId === current.id ? 'Stop preview' : 'Preview in this browser'} variant="soft" className="size-11 rounded-2xl" onClick={() => preview.toggle(current)}>
          {preview.playingId === current.id ? <Pause className="size-5" /> : <Play className="size-5" />}
        </IconButton>
      )}
    </div>
  );
}

/** Multi-select chips of speakers. Empty selection = "all enabled". */
export function SpeakerChips({
  speakers,
  value,
  onChange,
  allLabel = 'All enabled speakers',
}: {
  speakers: SpeakerView[];
  value: string[];
  onChange: (ids: string[]) => void;
  allLabel?: string;
}) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <div className="flex flex-wrap gap-2">
      <Chip active={value.length === 0} onClick={() => onChange([])}>
        {value.length === 0 && <Check className="size-3.5" />}
        {allLabel}
      </Chip>
      {speakers.map((s) => (
        <Chip key={s.id} active={value.includes(s.id)} onClick={() => toggle(s.id)} className={cn(!s.enabled && 'opacity-60')} title={s.enabled ? undefined : 'Disabled on the Speakers page'}>
          <SpeakerIcon type={s.type} className="size-3.5" />
          {s.displayName}
          {!s.online && <span className="size-1.5 rounded-full bg-danger" title="Not seen recently" />}
        </Chip>
      ))}
    </div>
  );
}
