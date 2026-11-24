import { useMemo, useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import type { Intention, ScheduleBlock } from '@/types/database';
import type { WeeklyCapacity } from '@/utils/capacity';
import { computeHabitDistribution, type HabitProposal } from '@/utils/habitDistribution';
import { formatDuration, formatTime12, isoWeekdayISO } from '@/utils/time';
import { WEEKDAY_LABELS } from '@/utils/capacity';

interface Props {
  open: boolean;
  onClose: () => void;
  weekDates: string[];
  intentions: Intention[];
  existingBlocks: ScheduleBlock[];
  capacity: WeeklyCapacity;
  dayStartHour: number;
  dayEndHour: number;
  snapInterval: number;
  onApply: (proposals: HabitProposal[]) => Promise<void>;
}

/** Preview + apply for the greedy habit scheduler: shows proposed blocks and
 * unmet targets before writing anything to the plan. */
export function HabitDistributionModal({ open, onClose, weekDates, intentions, existingBlocks, capacity, dayStartHour, dayEndHour, snapInterval, onApply }: Props) {
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  // Recomputed live so the preview always reflects current blocks/capacity;
  // `open` in deps forces recompute each time the modal is shown.
  const result = useMemo(
    () => computeHabitDistribution(intentions, { weekDates, existingBlocks, capacity, dayStartHour, dayEndHour, snapInterval }),
    [intentions, weekDates, existingBlocks, capacity, dayStartHour, dayEndHour, snapInterval, open],
  );

  const handleClose = () => {
    setApplied(false);
    onClose();
  };

  const apply = async () => {
    setApplying(true);
    try {
      await onApply(result.proposals);
      setApplied(true);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Distribute Habits" subtitle="Preview proposed blocks for this week before writing them to the plan." wide>
      {applied ? (
        <p className="py-6 text-center text-sm text-text-muted">Distribution applied. Re-open to check for remaining deficits.</p>
      ) : result.proposals.length === 0 && result.skips.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">No recurring intentions have a weekly target set. Edit an intention to add target sessions per week.</p>
      ) : (
        <div className="space-y-4">
          {result.proposals.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-text-subtle">{result.proposals.length} proposed block{result.proposals.length === 1 ? '' : 's'}</div>
              <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {result.proposals.map((proposal, index) => (
                  <div key={index} className="flex items-center justify-between rounded-lg border border-border bg-surface-low px-3 py-2 text-xs">
                    <span className="font-semibold text-text">{proposal.task.title}</span>
                    <span className="text-text-muted">
                      {proposal.scheduledDate} ({WEEKDAY_LABELS[isoWeekdayISO(proposal.scheduledDate)]}) {formatTime12(proposal.startTime)}–{formatTime12(proposal.endTime)} • {formatDuration(proposal.plannedDurationMins)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.skips.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-text-subtle">Unmet targets</div>
              <div className="space-y-1.5">
                {result.skips.map((skip) => (
                  <div key={skip.task.id} className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-xs">
                    <span className="font-semibold text-text">{skip.task.title}</span>
                    <span className="text-text-muted"> — placed {skip.placed} of {skip.requested} sessions. {skip.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={handleClose}>{applied ? 'Close' : 'Cancel'}</Button>
        {!applied && result.proposals.length > 0 && (
          <Button variant="primary" disabled={applying} onClick={apply}>{applying ? 'Applying…' : `Create ${result.proposals.length} block${result.proposals.length === 1 ? '' : 's'}`}</Button>
        )}
      </div>
    </Modal>
  );
}
