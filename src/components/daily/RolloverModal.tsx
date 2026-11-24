import { useState } from 'react';
import { ArrowRight, RotateCcw, Trash2 } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import type { EnrichedScheduleBlock } from '@/types/database';
import { addDaysISO, formatDuration, formatTime12 } from '@/utils/time';

interface Props {
  open: boolean;
  onClose: () => void;
  date: string;
  blocks: EnrichedScheduleBlock[];
  onMoveNextDay: (block: EnrichedScheduleBlock) => Promise<void>;
  onReturnToIntentions: (block: EnrichedScheduleBlock) => Promise<void>;
  onDismiss: (block: EnrichedScheduleBlock) => Promise<void>;
}

/** End-of-day review: each pending planned block can move to tomorrow,
 * return to the intentions backlog (block deleted), or be dismissed. */
export function RolloverModal({ open, onClose, date, blocks, onMoveNextDay, onReturnToIntentions, onDismiss }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const nextDate = addDaysISO(date, 1);

  const run = async (id: string, action: () => Promise<void>) => {
    setBusyId(id);
    try { await action(); } finally { setBusyId(null); }
  };

  return (
    <Modal open={open} onClose={onClose} title="End-of-Day Rollover" subtitle="Decide where unfulfilled intent lives next — no guilt required." wide>
      {blocks.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">No pending planned blocks need review.</p>
      ) : (
        <div className="space-y-3">
          {blocks.map((block) => (
            <div key={block.id} className="rounded-xl border border-border bg-surface-low p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-text">{block.task?.title ?? 'Planned block'}</div>
                  <div className="text-xs text-text-muted">{formatTime12(block.startTime)} – {formatTime12(block.endTime)} • {formatDuration(block.plannedDurationMins)}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="primary" disabled={busyId === block.id} onClick={() => run(block.id, () => onMoveNextDay(block))}>
                    <ArrowRight size={14} /> Move to {nextDate}
                  </Button>
                  <Button size="sm" variant="secondary" disabled={busyId === block.id} onClick={() => run(block.id, () => onReturnToIntentions(block))}>
                    <RotateCcw size={14} /> Return
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busyId === block.id} onClick={() => run(block.id, () => onDismiss(block))}>
                    <Trash2 size={14} /> Dismiss
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-5 flex justify-end">
        <Button variant="secondary" onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}
