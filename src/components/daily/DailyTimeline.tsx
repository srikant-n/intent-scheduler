import { useMemo, useRef } from 'react';
import type { Category, EnrichedScheduleBlock, EnrichedTimeLog, Intention, ScheduleBlock, TimeLog } from '@/types/database';
import { categoryById } from '@/hooks/useCategories';
import { formatDuration, formatTime12, minutesToTime, timeToMinutes } from '@/utils/time';
import { getDragSourceHeight, setDragSourceHeight, BLOCK_DRAG_MIME, LOG_DRAG_MIME } from '@/utils/dragContext';
import clsx from 'clsx';

interface DailyTimelineProps {
  date: string;
  blocks: EnrichedScheduleBlock[];
  logs: EnrichedTimeLog[];
  categories: Category[];
  dayStartHour: number;
  dayEndHour: number;
  hourHeight?: number;
  onDropTask: (task: Intention, startTime: string) => void;
  onDropBlock: (block: ScheduleBlock, startTime: string) => void;
  onBlockClick: (block: ScheduleBlock) => void;
  onLogClick: (log: TimeLog) => void;
  onPlannedSlotClick: (startTime: string) => void;
  onActualSlotClick: (startTime: string) => void;
  onDropLog: (log: TimeLog, startTime: string) => void;
}

const SNAP = 15;

export function DailyTimeline({
  blocks,
  logs,
  categories,
  dayStartHour,
  dayEndHour,
  hourHeight = 56,
  onDropTask,
  onDropBlock,
  onBlockClick,
  onLogClick,
  onPlannedSlotClick,
  onActualSlotClick,
  onDropLog,
}: DailyTimelineProps) {
  const plannedRef = useRef<HTMLDivElement>(null);
  const actualRef = useRef<HTMLDivElement>(null);
  const suppressClickUntil = useRef(0);
  const startMinutes = dayStartHour * 60;
  const endMinutes = dayEndHour * 60;
  const totalMinutes = Math.max(60, endMinutes - startMinutes);
  const height = (totalMinutes / 60) * hourHeight;
  const hours = useMemo(() => Array.from({ length: Math.floor(totalMinutes / 60) + 1 }, (_, i) => startMinutes + i * 60), [startMinutes, totalMinutes]);
  const untimedLogs = logs.filter((log) => !log.startTime);
  const timedLogs = logs.filter((log) => log.startTime);

  const timeFromEvent = (event: React.DragEvent<HTMLElement> | React.MouseEvent<HTMLElement>, ref: HTMLDivElement | null) => {
    if (!ref) return minutesToTime(startMinutes);
    const rect = ref.getBoundingClientRect();
    const grabOffset = 'dataTransfer' in event ? getDragSourceHeight() / 2 : 0;
    const ratio = Math.min(1, Math.max(0, (event.clientY - rect.top - grabOffset) / height));
    const minutes = startMinutes + ratio * totalMinutes;
    const snapped = Math.round(minutes / SNAP) * SNAP;
    return minutesToTime(Math.min(endMinutes - SNAP, Math.max(startMinutes, snapped)));
  };

  const handleDrop = (event: React.DragEvent<HTMLElement>, ref: HTMLDivElement | null) => {
    event.preventDefault();
    suppressClickUntil.current = Date.now() + 300;
    const blockRaw = event.dataTransfer.getData(BLOCK_DRAG_MIME);
    if (blockRaw) {
      try {
        const payload = JSON.parse(blockRaw) as ScheduleBlock;
        onDropBlock(payload, timeFromEvent(event, ref));
        return;
      } catch {
        // fall through to intention payload
      }
    }
    const raw = event.dataTransfer.getData('application/x-intent-scheduler-task');
    if (!raw) return;
    try {
      const task = JSON.parse(raw) as Intention;
      onDropTask(task, timeFromEvent(event, ref));
    } catch {
      // Ignore malformed drag payloads.
    }
  };

  const handleLogDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    suppressClickUntil.current = Date.now() + 300;
    const raw = event.dataTransfer.getData(LOG_DRAG_MIME);
    if (!raw) return;
    try {
      const log = JSON.parse(raw) as TimeLog;
      onDropLog(log, timeFromEvent(event, actualRef.current));
    } catch {
      // Ignore malformed drag payloads.
    }
  };

  const blockStyle = (start: string, durationMins: number) => {
    const top = ((timeToMinutes(start) - startMinutes) / totalMinutes) * height;
    const h = Math.max(18, (durationMins / totalMinutes) * height);
    return { top, height: h };
  };

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-[64px_1fr_1fr] border-b border-border bg-surface-low/70">
        <div className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-text-subtle">Time</div>
        <div className="border-l border-border px-3 py-3">
          <div className="text-xs font-bold uppercase tracking-wider text-text">Intent</div>
          <div className="text-[11px] text-text-subtle">Planned schedule</div>
        </div>
        <div className="border-l border-border px-3 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-text">Reality</div>
              <div className="text-[11px] text-text-subtle">Actual executed</div>
            </div>
            <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold text-success">Live</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[64px_1fr_1fr]">
        <div className="relative" style={{ height }}>
          {hours.map((minutes) => (
            <div key={minutes} className="absolute right-2 -translate-y-1/2 text-[10px] text-text-subtle" style={{ top: ((minutes - startMinutes) / totalMinutes) * height }}>
              {formatTime12(minutesToTime(minutes))}
            </div>
          ))}
        </div>

        <div
          ref={plannedRef}
          className="relative border-l border-border"
          style={{ height }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => handleDrop(event, plannedRef.current)}
          onClick={(event) => {
            if (Date.now() < suppressClickUntil.current) return;
            onPlannedSlotClick(timeFromEvent(event, plannedRef.current));
          }}
        >
          {hours.map((minutes) => (
            <div key={minutes} className={clsx('absolute left-0 right-0 timeline-grid-line', minutes !== startMinutes && 'timeline-hour-line')} style={{ top: ((minutes - startMinutes) / totalMinutes) * height }} />
          ))}
          {blocks
            .filter((block) => block.status !== 'dismissed' && block.status !== 'rolled')
            .map((block) => {
              const task = block.task;
              const category = categoryById(categories, task?.categoryId);
              const style = blockStyle(block.startTime, block.plannedDurationMins);
              const linkedLogs = logs.filter((log) => log.scheduleBlockId === block.id);
              const actualMins = linkedLogs.reduce((sum, log) => sum + log.durationMins, 0);
              const variance = actualMins - block.plannedDurationMins;
              return (
                <button
                  key={block.id}
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    setDragSourceHeight(event.currentTarget.getBoundingClientRect().height);
                    event.dataTransfer.setData(BLOCK_DRAG_MIME, JSON.stringify(block));
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (Date.now() < suppressClickUntil.current) return;
                    onBlockClick(block);
                  }}
                  className={clsx('timeline-block timeline-block-planned px-2 py-1.5 text-left', block.status === 'completed' && 'border-success/60')}
                  style={{ ...style, borderColor: category?.colorHex ?? 'var(--border-strong)' }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-xs font-bold text-text">{task?.title ?? 'Planned block'}</span>
                    {block.status === 'completed' && <span className="text-[10px] font-bold text-success">Done</span>}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[10px] text-text-muted">
                    <span>{formatTime12(block.startTime)} – {formatTime12(block.endTime)}</span>
                    <span>{formatDuration(block.plannedDurationMins)}</span>
                  </div>
                  {actualMins > 0 && (
                    <div className={clsx('mt-1 text-[10px] font-semibold', variance >= 0 ? 'text-warning' : 'text-success')}>
                      Actual {formatDuration(actualMins)} ({variance >= 0 ? '+' : ''}{formatDuration(variance)})
                    </div>
                  )}
                </button>
              );
            })}
        </div>

        <div
          ref={actualRef}
          className="relative border-l border-border"
          style={{ height }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleLogDrop}
          onClick={(event) => {
            if (Date.now() < suppressClickUntil.current) return;
            onActualSlotClick(timeFromEvent(event, actualRef.current));
          }}
        >
          {hours.map((minutes) => (
            <div key={minutes} className={clsx('absolute left-0 right-0 timeline-grid-line', minutes !== startMinutes && 'timeline-hour-line')} style={{ top: ((minutes - startMinutes) / totalMinutes) * height }} />
          ))}
          {timedLogs.map((log) => {
            const start = log.startTime ?? minutesToTime(startMinutes);
            const category = log.displayCategory;
            const style = blockStyle(start, log.durationMins);
            return (
              <button
                key={log.id}
                type="button"
                draggable
                onDragStart={(event) => {
                  setDragSourceHeight(event.currentTarget.getBoundingClientRect().height);
                  event.dataTransfer.setData(LOG_DRAG_MIME, JSON.stringify(log));
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onClick={(event) => { event.stopPropagation(); onLogClick(log); }}
                className="timeline-block timeline-block-actual cursor-grab px-2 py-1.5 text-left active:cursor-grabbing"
                style={{ ...style, borderColor: category?.colorHex ?? 'var(--accent)' }}
              >
                <div className="truncate text-xs font-bold text-text">{log.displayTitle}</div>
                <div className="mt-0.5 flex items-center justify-between text-[10px] text-text-muted">
                  <span>{formatTime12(log.startTime)} – {formatTime12(log.endTime)}</span>
                  <span>{formatDuration(log.durationMins)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {untimedLogs.length > 0 && (
        <div className="border-t border-border bg-surface-low/60 px-4 py-3">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-subtle">Duration-only logs</div>
          <div className="flex flex-wrap gap-2">
            {untimedLogs.map((log) => (
              <button key={log.id} onClick={() => onLogClick(log)} className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text hover:border-accent">
                {log.displayTitle} • {formatDuration(log.durationMins)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
