import { Pause, Play, Square, Trash2 } from 'lucide-react';
import { useActiveTimer } from '@/hooks/useActiveTimer';
import { useCategories } from '@/hooks/useCategories';
import { useIntentions } from '@/hooks/useIntentions';
import { CategoryBadge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { categoryById } from '@/hooks/useCategories';
import { formatDuration } from '@/utils/time';

export function ActiveTimerBar() {
  const { timer, elapsedLabel, isPaused, pauseTimer, resumeTimer, stopTimer, discardTimer } = useActiveTimer();
  const { categories } = useCategories();
  const { intentions } = useIntentions('active');
  if (!timer) return null;

  const task = intentions.find((item) => item.id === timer.taskId);
  const title = timer.customTitle || task?.title || 'Active session';
  const category = categoryById(categories, timer.categoryId ?? task?.categoryId);

  return (
    <div className="fixed bottom-5 left-1/2 z-[70] flex w-[min(760px,calc(100vw-2rem))] -translate-x-1/2 items-center gap-4 rounded-full border border-border bg-surface/90 px-4 py-3 shadow-2xl backdrop-blur-xl">
      <span className={`h-2.5 w-2.5 rounded-full ${isPaused ? 'bg-warning' : 'bg-accent'} ${!isPaused && 'animate-pulse'}`} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-text">{title}</div>
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <CategoryBadge category={category} />
          {timer.targetDurationMins != null && <span>target {formatDuration(timer.targetDurationMins)}</span>}
          <span>{isPaused ? 'paused' : 'recording'}</span>
        </div>
      </div>
      <div className="text-xl font-bold tabular-nums text-text">{elapsedLabel}</div>
      <div className="flex items-center gap-1">
        {isPaused ? (
          <Button size="sm" variant="secondary" onClick={resumeTimer}><Play size={14} /> Resume</Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={pauseTimer}><Pause size={14} /> Pause</Button>
        )}
        <Button size="sm" variant="primary" onClick={stopTimer}><Square size={14} /> Stop</Button>
        <Button size="sm" variant="ghost" onClick={discardTimer} title="Discard without saving"><Trash2 size={14} /></Button>
      </div>
    </div>
  );
}
