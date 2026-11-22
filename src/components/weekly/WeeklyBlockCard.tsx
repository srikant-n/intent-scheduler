import { AlertCircle, CheckCircle2, Circle, Repeat } from 'lucide-react';
import clsx from 'clsx';
import type { Category, EnrichedScheduleBlock } from '@/types/database';
import { CategoryBadge } from '@/components/common/Badge';
import { formatDuration, formatSignedDuration, formatTime12 } from '@/utils/time';

export type BoardMode = 'draft' | 'reality';

interface Props {
  block: EnrichedScheduleBlock;
  category?: Category;
  actualMins: number;
  mode: BoardMode;
  onClick: () => void;
  onDragStart?: (event: React.DragEvent) => void;
}

function StatusIcon({ status }: { status: EnrichedScheduleBlock['status'] }) {
  if (status === 'completed') return <CheckCircle2 size={14} className="text-success" fill="currentColor" fillOpacity={0.25} />;
  if (status === 'missed') return <AlertCircle size={14} className="text-warning" />;
  return <Circle size={13} className="text-text-subtle" />;
}

export function WeeklyBlockCard({ block, category, actualMins, mode, onClick, onDragStart }: Props) {
  const variance = actualMins > 0 ? actualMins - block.plannedDurationMins : null;
  const completed = block.status === 'completed';

  return (
    <button
      type="button"
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onClick={(event) => { event.stopPropagation(); onClick(); }}
      className={clsx(
        'group flex w-full flex-col gap-1.5 rounded-lg border border-border/60 bg-surface p-2 text-left shadow-sm transition hover:border-border-strong hover:shadow-md',
        completed && 'opacity-90',
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <CategoryBadge category={category} className="px-1.5! py-0! text-[10px]!" />
        <span className="flex items-center gap-1">
          {block.task?.isRecurring && <Repeat size={11} className="text-text-subtle" />}
          <StatusIcon status={block.status} />
        </span>
      </div>
      <span className={clsx('text-xs font-semibold text-text transition-colors group-hover:text-accent', completed && 'text-text-muted line-through')}>
        {block.task?.title ?? 'Planned block'}
      </span>
      <div className="flex items-center justify-between text-[10px] text-text-muted">
        {mode === 'draft' ? (
          <>
            <span>{formatTime12(block.startTime)} – {formatTime12(block.endTime)}</span>
            <span>{formatDuration(block.plannedDurationMins)}</span>
          </>
        ) : actualMins > 0 ? (
          <>
            <span>Actual {formatDuration(actualMins)}</span>
            <span className={clsx('font-semibold', variance != null && variance >= 0 ? 'text-warning' : 'text-success')}>
              {formatSignedDuration(variance)}
            </span>
          </>
        ) : (
          <span className="italic">No actuals logged</span>
        )}
        {block.rolledFromBlockId && <span className="text-text-subtle">↺</span>}
      </div>
    </button>
  );
}
