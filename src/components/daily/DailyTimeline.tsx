import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, RefreshCw, Sparkles, Zap } from 'lucide-react';
import type { Category, EnrichedScheduleBlock, EnrichedTimeLog, Intention, ScheduleBlock, TimeLog } from '@/types/database';
import { categoryById } from '@/hooks/useCategories';
import { formatDuration, formatTime12, minutesToTime, timeToMinutes, todayISO } from '@/utils/time';
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
  date,
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
  const visibleBlocks = blocks.filter((block) => block.status !== 'dismissed' && block.status !== 'rolled');

  const [nowMinutes, setNowMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });
  const isToday = date === todayISO();
  useEffect(() => {
    if (!isToday) return;
    const interval = window.setInterval(() => {
      const now = new Date();
      setNowMinutes(now.getHours() * 60 + now.getMinutes());
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [isToday]);
  const showNowLine = isToday && nowMinutes >= startMinutes && nowMinutes <= endMinutes;
  const nowTop = ((nowMinutes - startMinutes) / totalMinutes) * height;

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

  const trackGridLines = hours.map((minutes) => (
    <div
      key={minutes}
      className={clsx('absolute left-0 right-0 timeline-grid-line', minutes !== startMinutes && 'timeline-hour-line')}
      style={{ top: ((minutes - startMinutes) / totalMinutes) * height }}
    />
  ));

  return (
    <div className="card overflow-hidden">
      {/* Track header labels */}
      <div className="grid grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] items-center gap-2 border-b border-border bg-surface-low/70 px-3 py-3">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-text-subtle" />
            <span className="text-xs font-bold uppercase tracking-wider text-text">Intent</span>
            <span className="truncate text-[11px] text-text-muted">(Planned Schedule)</span>
          </div>
          <span className="ml-2 shrink-0 text-[11px] font-semibold text-text-muted">{visibleBlocks.length} Blocks</span>
        </div>
        <div className="text-center text-[10px] font-bold uppercase tracking-widest text-text-subtle">Time Ruler</div>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold text-success">
              <Sparkles size={10} /> On Intent
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-text">Reality</span>
            <span className="truncate text-[11px] text-text-muted">(Actual Executed)</span>
          </div>
          <span className="ml-2 flex shrink-0 items-center gap-1 text-[11px] font-semibold text-success">
            <RefreshCw size={12} /> Live Synced
          </span>
        </div>
      </div>

      {/* Timeline canvas */}
      <div className="relative">
        <div className="grid grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)]">
          {/* Intent track */}
          <div
            ref={plannedRef}
            className="relative border-r border-border"
            style={{ height }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, plannedRef.current)}
            onClick={(event) => {
              if (Date.now() < suppressClickUntil.current) return;
              onPlannedSlotClick(timeFromEvent(event, plannedRef.current));
            }}
          >
            {trackGridLines}
            {visibleBlocks.map((block) => {
              const task = block.task;
              const category = categoryById(categories, task?.categoryId);
              const accent = category?.colorHex ?? 'var(--accent)';
              const style = blockStyle(block.startTime, block.plannedDurationMins);
              const linkedLogs = logs.filter((log) => log.scheduleBlockId === block.id);
              const actualMins = linkedLogs.reduce((sum, log) => sum + log.durationMins, 0);
              const variance = actualMins - block.plannedDurationMins;
              return (
                <div key={block.id} className="absolute left-1 right-1" style={style}>
                  <button
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
                    className="flex h-full w-full cursor-grab flex-col justify-between rounded-lg border border-dashed p-1.5 text-left shadow-xs transition hover:shadow-sm active:cursor-grabbing"
                    style={{
                      borderColor: `${accent}88`,
                      backgroundColor: `color-mix(in srgb, ${accent} 10%, var(--surface))`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {block.status === 'completed' ? (
                          <CheckCircle2 size={13} className="shrink-0 text-success" />
                        ) : (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
                        )}
                        <span className="truncate text-[11px] font-bold text-text">{task?.title ?? 'Planned block'}</span>
                      </div>
                      {category && (
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-px text-[9px] font-bold tracking-wide"
                          style={{ color: accent, borderColor: `${accent}55`, backgroundColor: `${accent}1f` }}
                        >
                          <span className="h-1 w-1 rounded-full" style={{ backgroundColor: accent }} />
                          {category.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-medium text-text-muted">
                      <span>
                        {formatTime12(block.startTime)} – {formatTime12(block.endTime)}
                      </span>
                      <span>{formatDuration(block.plannedDurationMins)}</span>
                    </div>
                    {actualMins > 0 && (
                      <div className={clsx('text-[10px] font-semibold', variance >= 0 ? 'text-warning' : 'text-success')}>
                        Actual {formatDuration(actualMins)} ({variance >= 0 ? '+' : ''}{formatDuration(variance)})
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Time ruler */}
          <div className="relative border-x border-border" style={{ height }}>
            {trackGridLines}
            {hours.map((minutes) => (
              <div
                key={minutes}
                className={clsx(
                  'absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-semibold',
                  minutes === startMinutes ? 'text-text-subtle' : 'text-text-muted',
                )}
                style={{ top: ((minutes - startMinutes) / totalMinutes) * height }}
              >
                {formatTime12(minutesToTime(minutes))}
              </div>
            ))}
          </div>

          {/* Reality track */}
          <div
            ref={actualRef}
            className="relative"
            style={{ height }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleLogDrop}
            onClick={(event) => {
              if (Date.now() < suppressClickUntil.current) return;
              onActualSlotClick(timeFromEvent(event, actualRef.current));
            }}
          >
            {trackGridLines}
            {timedLogs.map((log) => {
              const start = log.startTime ?? minutesToTime(startMinutes);
              const category = log.displayCategory;
              const accent = category?.colorHex ?? 'var(--accent)';
              const style = blockStyle(start, log.durationMins);
              const onIntent = Boolean(log.scheduleBlockId);
              return (
                <div key={log.id} className="absolute left-1 right-1" style={style}>
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      setDragSourceHeight(event.currentTarget.getBoundingClientRect().height);
                      event.dataTransfer.setData(LOG_DRAG_MIME, JSON.stringify(log));
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (Date.now() < suppressClickUntil.current) return;
                      onLogClick(log);
                    }}
                    className="flex h-full w-full cursor-grab flex-col justify-between rounded-lg border border-border bg-surface-high p-1.5 text-left shadow-xs transition hover:shadow-sm active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="h-3.5 w-1 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
                        <span className="truncate text-[11px] font-bold text-text">{log.displayTitle}</span>
                      </div>
                      {onIntent ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-soft px-1.5 py-px text-[9px] font-bold tracking-wide text-success">
                          <Sparkles size={9} /> On Intent
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-1.5 py-px text-[9px] font-bold tracking-wide text-accent">
                          <Zap size={9} /> Unplanned
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-medium text-text-muted">
                      <span>
                        {formatTime12(log.startTime)} – {formatTime12(log.endTime)}
                      </span>
                      <span>Actual: {formatDuration(log.durationMins)}</span>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live "now" marker across all tracks */}
        {showNowLine && (
          <div className="pointer-events-none absolute left-0 right-0 z-20" style={{ top: nowTop }}>
            <div className="relative flex items-center">
              <div className="h-0.5 flex-1 bg-accent/60" />
              <div className="mx-2 flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold text-accent-contrast shadow-sm">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-contrast" />
                Now: {formatTime12(minutesToTime(nowMinutes))}
              </div>
              <div className="h-0.5 flex-1 bg-accent/60" />
            </div>
          </div>
        )}
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
