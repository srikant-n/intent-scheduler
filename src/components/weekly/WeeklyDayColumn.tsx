import { useState } from 'react';
import { Plus } from 'lucide-react';
import clsx from 'clsx';
import type { Category, EnrichedScheduleBlock, Intention } from '@/types/database';
import type { WeeklyDaySummary } from '@/utils/weekly';
import { WeeklyBlockCard, type BoardMode } from './WeeklyBlockCard';
import { formatDateShort, formatDuration, formatSignedDuration, todayISO } from '@/utils/time';
import { setDragSourceHeight, BLOCK_DRAG_MIME } from '@/utils/dragContext';

const BLOCK_MIME = BLOCK_DRAG_MIME;

interface Props {
  summary: WeeklyDaySummary;
  blocks: EnrichedScheduleBlock[];
  actualByBlock: Map<string, number>;
  categoryOf: (block: EnrichedScheduleBlock) => Category | undefined;
  mode: BoardMode;
  onAdd: () => void;
  onBlockClick: (block: EnrichedScheduleBlock) => void;
  onDropTask: (task: Intention) => void;
  onDropBlock: (block: EnrichedScheduleBlock) => void;
}

// Priority-ordered status pill: rollover warnings first, then plan-vs-actual
// variance, capacity overflow, allocation state, or "Ready" for future days.
function statusPill(summary: WeeklyDaySummary): { text: string; className: string } | null {
  if (summary.capacityMins <= 0 && summary.plannedMins === 0 && summary.actualMins === 0) {
    return { text: 'No capacity set', className: 'bg-surface-high text-text-subtle' };
  }
  if (summary.pendingRolloverCount > 0) {
    return { text: `${summary.pendingRolloverCount} pending rollover`, className: 'bg-warning-soft text-warning' };
  }
  if (summary.actualMins > 0 && summary.plannedMins > 0) {
    const diff = summary.actualMins - summary.plannedMins;
    if (Math.abs(diff) <= 15) return { text: 'Spot-on', className: 'bg-success-soft text-success' };
    return { text: `${formatSignedDuration(diff)} ${diff > 0 ? 'over' : 'under'}`, className: diff > 0 ? 'bg-warning-soft text-warning' : 'bg-accent-soft text-accent' };
  }
  if (summary.utilizationPct != null && summary.utilizationPct >= 100) {
    return { text: 'Over capacity', className: 'bg-danger-soft text-danger' };
  }
  if (summary.plannedMins > 0) {
    const free = summary.capacityMins - summary.plannedMins;
    return { text: free > 0 ? `${formatDuration(free)} unallocated` : 'Fully allocated', className: 'bg-surface-high text-text-muted' };
  }
  if (summary.date > todayISO()) return { text: 'Ready', className: 'bg-surface-high text-text-subtle' };
  return null;
}

/** One day column on the weekly board: capacity bar, block cards, drop target
 * for intentions/blocks, add-task button, and a status pill. */
export function WeeklyDayColumn({ summary, blocks, actualByBlock, categoryOf, mode, onAdd, onBlockClick, onDropTask, onDropBlock }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const isToday = summary.date === todayISO();
  const isWeekend = summary.isoWeekday >= 6;
  const utilization = summary.utilizationPct ?? 0;
  const pill = statusPill(summary);
  const dayLabel = formatDateShort(summary.date); // e.g. "Sat, Nov 22"
  const dayNum = summary.date.slice(8, 10);
  const weekdayShort = dayLabel.split(',')[0];

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const blockRaw = event.dataTransfer.getData(BLOCK_MIME);
    if (blockRaw) {
      try {
        const payload = JSON.parse(blockRaw) as EnrichedScheduleBlock;
        onDropBlock(payload);
        return;
      } catch {
        // fall through to intention payload
      }
    }
    const taskRaw = event.dataTransfer.getData('application/x-intent-scheduler-task');
    if (taskRaw) {
      try {
        onDropTask(JSON.parse(taskRaw) as Intention);
      } catch {
        // Ignore malformed drag payloads.
      }
    }
  };

  return (
    <div
      className={clsx(
        'flex min-h-140 w-42 shrink-0 flex-col rounded-xl p-2 shadow-sm transition',
        isToday
          ? 'border-2 border-accent/40 bg-surface ring-2 ring-accent/20'
          : clsx('border', isWeekend ? 'border-border/60 bg-surface-low/75' : 'border-border bg-surface-low'),
        dragOver && 'border-accent bg-accent-soft/40',
      )}
      onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="mb-2 px-1 pb-2">
        <div className="flex items-baseline justify-between">
          <span className={clsx('text-sm font-bold', isToday ? 'text-accent' : 'text-text')}>
            {weekdayShort} {Number(dayNum)}
          </span>
          {isToday && <span className="rounded bg-accent px-1.5 py-0.5 text-[9px] font-bold text-accent-contrast">Today</span>}
          <span className="text-[11px] font-medium text-text-subtle">{formatDuration(summary.plannedMins)}</span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-high">
          <div
            className={clsx('h-full rounded-full', utilization > 100 ? 'bg-danger' : isToday ? 'bg-accent' : 'bg-text-subtle/60')}
            style={{ width: `${Math.min(100, utilization)}%` }}
          />
        </div>
        <div className={clsx('mt-1 text-[10px]', isToday ? 'font-medium text-accent' : 'text-text-subtle')}>
          Cap: {formatDuration(summary.capacityMins)} ({utilization}%{summary.capacityMins > 0 && summary.plannedMins > summary.capacityMins ? ' allocated' : ''})
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        {blocks.map((block) => (
          <WeeklyBlockCard
            key={block.id}
            block={block}
            category={categoryOf(block)}
            actualMins={actualByBlock.get(block.id) ?? 0}
            mode={mode}
            onClick={() => onBlockClick(block)}
            onDragStart={(event) => {
              setDragSourceHeight(event.currentTarget.getBoundingClientRect().height);
              event.dataTransfer.setData(BLOCK_MIME, JSON.stringify(block));
              event.dataTransfer.effectAllowed = 'move';
            }}
          />
        ))}
        {blocks.length === 0 && (
          <div className="rounded-lg border border-dashed border-border-strong/60 px-2 py-6 text-center text-[11px] text-text-subtle">
            Drop intentions here
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-1.5 pt-2">
        <button
          type="button"
          onClick={onAdd}
          className={clsx(
            'flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold shadow-sm transition',
            isToday
              ? 'border-transparent bg-accent text-accent-contrast hover:bg-accent-strong'
              : 'border-border-strong/60 bg-surface text-text hover:bg-surface-high',
          )}
        >
          <Plus size={12} /> Add Task
        </button>
        {pill && (
          <div className={clsx('rounded-full px-2 py-0.5 text-center text-[10px] font-semibold', pill.className)}>
            {pill.text}
          </div>
        )}
      </div>
    </div>
  );
}

// Re-exported so WeeklyPage can use the same MIME key for drag payloads.
export { BLOCK_MIME };
