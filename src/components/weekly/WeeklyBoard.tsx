import type { Category, EnrichedScheduleBlock, Intention } from '@/types/database';
import type { WeeklyDaySummary } from '@/utils/weekly';
import type { BoardMode } from './WeeklyBlockCard';
import { WeeklyDayColumn } from './WeeklyDayColumn';
import { useDragScroll } from '@/hooks/useDragScroll';

interface Props {
  days: WeeklyDaySummary[];
  blocksByDate: Map<string, EnrichedScheduleBlock[]>;
  actualByBlock: Map<string, number>;
  categoryOf: (block: EnrichedScheduleBlock) => Category | undefined;
  mode: BoardMode;
  onAdd: (date: string) => void;
  onBlockClick: (block: EnrichedScheduleBlock) => void;
  onDropTask: (task: Intention, date: string) => void;
  onDropBlock: (block: EnrichedScheduleBlock, targetDate: string) => void;
}

/** Horizontally scrollable Mon–Sun board of day columns with click-drag panning. */
export function WeeklyBoard({ days, blocksByDate, actualByBlock, categoryOf, mode, onAdd, onBlockClick, onDropTask, onDropBlock }: Props) {
  const { ref, onPointerDown } = useDragScroll();
  return (
    <div ref={ref} onPointerDown={onPointerDown} className="cursor-grab overflow-x-auto pb-2">
      <div className="flex min-w-[1200px] gap-2.5">
        {days.map((day) => (
          <WeeklyDayColumn
            key={day.date}
            summary={day}
            blocks={blocksByDate.get(day.date) ?? []}
            actualByBlock={actualByBlock}
            categoryOf={categoryOf}
            mode={mode}
            onAdd={() => onAdd(day.date)}
            onBlockClick={onBlockClick}
            onDropTask={(task) => onDropTask(task, day.date)}
            onDropBlock={(block) => onDropBlock(block, day.date)}
          />
        ))}
      </div>
    </div>
  );
}
