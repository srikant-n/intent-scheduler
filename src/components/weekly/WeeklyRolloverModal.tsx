import { useMemo, useState } from 'react';
import { ArrowRight, CalendarClock, RotateCcw, Trash2 } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Field, Input } from '@/components/common/Field';
import type { EnrichedScheduleBlock } from '@/types/database';
import { formatDuration, formatTime12, todayISO } from '@/utils/time';

export type WeeklyRolloverAction = 'next-day' | 'next-monday' | 'reschedule' | 'dismiss' | 'return';

export interface RolloverBatchResult {
  succeeded: number;
  failed: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  blocks: EnrichedScheduleBlock[];
  onApply: (action: WeeklyRolloverAction, blocks: EnrichedScheduleBlock[], reschedule?: { date: string; startTime: string }) => Promise<RolloverBatchResult>;
}

export function WeeklyRolloverModal({ open, onClose, blocks, onApply }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rescheduleDate, setRescheduleDate] = useState(todayISO());
  const [rescheduleTime, setRescheduleTime] = useState('09:00');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RolloverBatchResult | null>(null);

  const allSelected = blocks.length > 0 && selected.size === blocks.length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const chosen = useMemo(() => blocks.filter((b) => selected.has(b.id)), [blocks, selected]);

  const run = async (action: WeeklyRolloverAction) => {
    if (chosen.length === 0) return;
    setBusy(true);
    try {
      const res = await onApply(action, chosen, { date: rescheduleDate, startTime: rescheduleTime });
      setResult(res);
      if (res.failed === 0) setSelected(new Set());
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Weekly Rollover" subtitle="Move, reschedule, dismiss, or return unfulfilled planned blocks. Moves keep lineage via rolled_from_block_id." wide>
      {blocks.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">No pending planned blocks need review this week.</p>
      ) : (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-xs font-bold text-text-muted">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(blocks.map((b) => b.id)))}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Select all ({blocks.length})
          </label>
          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {blocks.map((block) => (
              <label key={block.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-low px-3 py-2">
                <input
                  type="checkbox"
                  checked={selected.has(block.id)}
                  onChange={() => toggle(block.id)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-text">{block.task?.title ?? 'Planned block'}</div>
                  <div className="text-[10px] text-text-muted">
                    {block.scheduledDate} • {formatTime12(block.startTime)}–{formatTime12(block.endTime)} • {formatDuration(block.plannedDurationMins)}
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-surface-low p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-subtle">Batch actions ({chosen.length} selected)</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="primary" disabled={busy || chosen.length === 0} onClick={() => run('next-day')}>
                <ArrowRight size={13} /> +1 day
              </Button>
              <Button size="sm" variant="secondary" disabled={busy || chosen.length === 0} onClick={() => run('next-monday')}>
                <CalendarClock size={13} /> Next Monday
              </Button>
              <Button size="sm" variant="secondary" disabled={busy || chosen.length === 0} onClick={() => run('dismiss')}>
                <Trash2 size={13} /> Dismiss
              </Button>
              <Button size="sm" variant="ghost" disabled={busy || chosen.length === 0} onClick={() => run('return')}>
                <RotateCcw size={13} /> Return to intentions
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Field label="Reschedule date">
                <Input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} className="w-36" />
              </Field>
              <Field label="Start time">
                <Input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} className="w-28" />
              </Field>
              <Button size="sm" variant="secondary" disabled={busy || chosen.length === 0} onClick={() => run('reschedule')}>
                Move selected here
              </Button>
            </div>
          </div>

          {result && (
            <p className="text-xs text-text-muted">
              Applied: {result.succeeded} succeeded{result.failed > 0 ? `, ${result.failed} failed` : ''}.
            </p>
          )}
        </div>
      )}
      <div className="mt-5 flex justify-end">
        <Button variant="secondary" onClick={handleClose}>Done</Button>
      </div>
    </Modal>
  );
}
