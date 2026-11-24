import { RefreshCw, SlidersHorizontal } from 'lucide-react';
import type { Category, EnrichedScheduleBlock, Intention } from '@/types/database';
import { formatDuration } from '@/utils/time';
import { setDragSourceHeight } from '@/utils/dragContext';
import clsx from 'clsx';

interface Props {
  intentions: Intention[];
  blocks: EnrichedScheduleBlock[];
  categories: Category[];
  onConfigure: () => void;
}

function cadenceLabel(habit: Intention): string {
  // With a target: "3×/wk". Without: fall back to preferred-day count or "Recurring".
  if (!habit.targetSessionsPerWeek) return habit.preferredWeekdays.length > 0 ? `${habit.preferredWeekdays.length}×/wk` : 'Recurring';
  return `${habit.targetSessionsPerWeek}×/wk`;
}

/** Sidebar list of recurring intentions ("habit templates") that can be dragged
 * onto the weekly board, with per-habit adherence percentages. */
export function HabitPool({ intentions, blocks, categories, onConfigure }: Props) {
  const habits = intentions.filter((item) => item.isRecurring && item.status === 'active');
  const categoryOf = (id: string | null) => categories.find((c) => c.id === id);

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw size={16} className="text-success" />
          <span className="text-sm font-bold text-text">Habit Templates</span>
        </div>
        <span className="rounded-full bg-surface-high px-2 py-0.5 text-[10px] font-bold text-text-muted">{habits.length} ready</span>
      </div>
      <p className="text-xs text-text-muted">Drag or auto-slot recurring rhythms onto your weekly grid without friction.</p>

      <div className="flex flex-col gap-1.5">
        {habits.map((habit) => {
          // Sessions that count: anything not dismissed/rolled; adherence = completed / weekly target.
          const sessions = blocks.filter((b) => b.taskId === habit.id && b.status !== 'dismissed' && b.status !== 'rolled');
          const fulfilled = sessions.filter((b) => b.status === 'completed').length;
          const target = habit.targetSessionsPerWeek;
          const adherence = target && target > 0 ? Math.round((fulfilled / target) * 100) : null;
          const category = categoryOf(habit.categoryId);
          return (
            <div
              key={habit.id}
              draggable
              onDragStart={(event) => {
                setDragSourceHeight(event.currentTarget.getBoundingClientRect().height);
                event.dataTransfer.setData('application/x-intent-scheduler-task', JSON.stringify(habit));
                event.dataTransfer.effectAllowed = 'copy';
              }}
              className="group flex cursor-grab flex-col gap-1 rounded-lg bg-surface-low p-2.5 shadow-sm transition hover:bg-surface-high active:cursor-grabbing"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{
                    color: category?.colorHex ?? 'var(--text-muted)',
                    borderColor: `${category?.colorHex ?? '#78716c'}55`,
                    backgroundColor: `${category?.colorHex ?? '#78716c'}14`,
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: category?.colorHex ?? 'var(--text-subtle)' }} />
                  {category?.name ?? 'Uncategorized'} • {cadenceLabel(habit)}
                </span>
                <span className="text-[10px] font-medium text-text-subtle tabular-nums">
                  {habit.defaultDurationMins ? formatDuration(habit.defaultDurationMins) : 'No estimate'}
                </span>
              </div>
              <span className="text-xs font-semibold text-text transition-colors group-hover:text-accent">{habit.title}</span>
              <div className="flex items-center justify-between text-[10px] text-text-muted">
                <span>{sessions.length} planned{target ? ` / ${target}` : ''}</span>
                {adherence != null ? (
                  <span className={clsx('font-bold', adherence >= 80 ? 'text-success' : adherence >= 50 ? 'text-warning' : 'text-danger')}>
                    {adherence}%
                  </span>
                ) : (
                  <span>{fulfilled}/{sessions.length} done</span>
                )}
              </div>
            </div>
          );
        })}
        {habits.length === 0 && (
          <p className="text-xs text-text-muted">No recurring intentions yet. Mark an intention as habitual to see it here.</p>
        )}
      </div>

      <button
        type="button"
        onClick={onConfigure}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-border-strong/60 bg-surface py-2 text-xs font-semibold text-text shadow-sm transition hover:bg-surface-high"
      >
        <SlidersHorizontal size={14} /> Configure Routines
      </button>
    </div>
  );
}
