import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, useAthans, useConfig, useSpeakers } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Button, Empty, Field, Modal, Notice } from '@/ui';
import { AthanSelect, SpeakerChips } from './pickers';

/** Play any athan on any speakers right now. */
export function TestPlayDialog({ open, onClose, initialSpeakerIds = [] }: { open: boolean; onClose: () => void; initialSpeakerIds?: string[] }) {
  const { data: athans = [] } = useAthans();
  const { data: cfg } = useConfig();
  const { data: sp } = useSpeakers();
  const toast = useToast();
  const qc = useQueryClient();
  const [athanId, setAthanId] = useState<string | null>(null);
  const [ids, setIds] = useState<string[]>(initialSpeakerIds);

  useEffect(() => {
    if (open) {
      setIds(initialSpeakerIds);
      setAthanId(cfg?.defaultAthanId ?? athans.find((a) => !a.builtin)?.id ?? athans[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const play = useMutation({
    mutationFn: () => api('/play', { method: 'POST', json: { athanId, speakerIds: ids.length ? ids : undefined } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['state'] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const speakers = sp?.speakers ?? [];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Play an athan now"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={<Play className="size-4 fill-current" />} onClick={() => play.mutate()} loading={play.isPending} disabled={speakers.length === 0}>
            Play
          </Button>
        </>
      }
    >
      {speakers.length === 0 ? (
        <Empty icon={<Play className="size-6" />} title="No speakers yet">
          Speakers appear automatically once they are found on your network. Open the Speakers page to scan.
        </Empty>
      ) : (
        <div className="space-y-5 pb-2">
          <Field label="Athan">
            <AthanSelect athans={athans} value={athanId} onChange={setAthanId} />
          </Field>
          <Field label="Speakers">
            <SpeakerChips speakers={speakers} value={ids} onChange={setIds} />
          </Field>
          <Notice>Plays at each speaker’s own volume. Sonos and Cast speakers return to what they were doing afterwards.</Notice>
        </div>
      )}
    </Modal>
  );
}
