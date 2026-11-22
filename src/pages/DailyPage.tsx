import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, MoonStar, Plus, Timer, TrendingUp, Zap } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { useIntentions } from '@/hooks/useIntentions';
import { useScheduleBlocks, useScheduleMutations } from '@/hooks/useSchedule';
import { useTimeLogs } from '@/hooks/useLogs';
import { useActiveTimer } from '@/hooks/useActiveTimer';
import { getSetting } from '@/db/queries';
import { DailyTimeline } from '@/components/daily/DailyTimeline';
import { ScheduleBlockFormModal, ScheduleBlockFormValues } from '@/components/daily/ScheduleBlockFormModal';
import { TimeLogFormModal, TimeLogFormValues } from '@/components/daily/TimeLogFormModal';
import { QuickLogModal } from '@/components/daily/QuickLogModal';
import { RolloverModal } from '@/components/daily/RolloverModal';
import { Button } from '@/components/common/Button';
import { CategoryBadge } from '@/components/common/Badge';
import type { EnrichedScheduleBlock, Intention, ScheduleBlock, TimeLog } from '@/types/database';
import { computeDailySummary, enrichBlocks, enrichLogs, isPendingRolloverBlock } from '@/utils/planner';
import { addDaysISO, formatDateLong, formatDuration, minutesToTime, timeToMinutes, todayISO } from '@/utils/time';
import { setDragSourceHeight } from '@/utils/dragContext';
import clsx from 'clsx';

interface DailyPageProps {
  date: string;
  onDateChange: (date: string) => void;
  quickLogOpen: boolean;
  onQuickLogOpenChange: (open: boolean) => void;
  onOpenIntentions: () => void;
}

export function DailyPage({ date, onDateChange, quickLogOpen, onQuickLogOpenChange, onOpenIntentions }: DailyPageProps) {
  const [blockForm, setBlockForm] = useState<{ open: boolean; block: ScheduleBlock | null; startTime?: string }>({ open: false, block: null });
  const [logForm, setLogForm] = useState<{ open: boolean; log: TimeLog | null; startTime?: string }>({ open: false, log: null });
  const [rolloverOpen, setRolloverOpen] = useState(false);

  const { blocks, isLoading: blocksLoading } = useScheduleBlocks(date);
  const { logs, isLoading: logsLoading } = useTimeLogs(date);
  const { intentions } = useIntentions('active');
  const { categories } = useCategories();
  const schedule = useScheduleMutations();
  const timeLogs = useTimeLogs(date);
  const timer = useActiveTimer();

  const dayBounds = useQuery({
    queryKey: ['settings', 'day-bounds'],
    queryFn: async () => ({
      start: Number((await getSetting('day_start_hour')) ?? 6),
      end: Number((await getSetting('day_end_hour')) ?? 22),
    }),
  });

  const enrichedBlocks = useMemo(() => enrichBlocks(blocks, intentions), [blocks, intentions]);
  const enrichedLogs = useMemo(() => enrichLogs(logs, intentions, categories), [logs, intentions, categories]);

  const summary = useMemo(() => computeDailySummary(enrichedBlocks, enrichedLogs), [enrichedBlocks, enrichedLogs]);

  const pendingBlocks = useMemo(() => {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const actualByBlock = new Map<string, number>();
    for (const log of enrichedLogs) {
      if (!log.scheduleBlockId) continue;
      actualByBlock.set(log.scheduleBlockId, (actualByBlock.get(log.scheduleBlockId) ?? 0) + log.durationMins);
    }
    return enrichedBlocks.filter((block) =>
      isPendingRolloverBlock(block, todayISO(), nowMinutes, (actualByBlock.get(block.id) ?? 0) > 0),
    );
  }, [enrichedBlocks, enrichedLogs]);

  const handleDropTask = async (task: Intention, startTime: string) => {
    const duration = task.defaultDurationMins ?? 30;
    await schedule.create.mutateAsync({
      taskId: task.id,
      scheduledDate: date,
      startTime,
      endTime: minutesToTime(timeToMinutes(startTime) + duration),
      plannedDurationMins: duration,
    });
  };

  const moveBlockToTime = async (block: ScheduleBlock, startTime: string) => {
    const duration = block.plannedDurationMins;
    await schedule.update.mutateAsync({
      id: block.id,
      startTime,
      endTime: minutesToTime(timeToMinutes(startTime) + duration),
      plannedDurationMins: duration,
    });
  };

  const openBlockForm = (block: ScheduleBlock | null = null, startTime?: string) => setBlockForm({ open: true, block, startTime });
  const openLogForm = (log: TimeLog | null = null, startTime?: string) => setLogForm({ open: true, log, startTime });

  const saveBlock = async (values: ScheduleBlockFormValues) => {
    if (blockForm.block) {
      await schedule.update.mutateAsync({ id: blockForm.block.id, ...values });
    } else {
      await schedule.create.mutateAsync({ ...values, status: 'planned' });
    }
  };

  const deleteBlock = async () => {
    if (!blockForm.block) return;
    await schedule.remove.mutateAsync(blockForm.block.id);
    setBlockForm({ open: false, block: null });
  };

  const startTimerForBlock = async () => {
    if (!blockForm.block) return;
    const task = intentions.find((item) => item.id === blockForm.block?.taskId) ?? null;
    await timer.startTimer({ task, block: blockForm.block, targetDurationMins: blockForm.block.plannedDurationMins });
    setBlockForm({ open: false, block: null });
  };

  const logActualForBlock = async (durationMins: number) => {
    if (!blockForm.block) return;
    const task = intentions.find((item) => item.id === blockForm.block?.taskId);
    await timeLogs.create.mutateAsync({
      taskId: blockForm.block.taskId,
      scheduleBlockId: blockForm.block.id,
      categoryId: task?.categoryId ?? null,
      logDate: date,
      startTime: blockForm.block.startTime,
      endTime: blockForm.block.endTime,
      durationMins,
      isAdHoc: false,
    });
    await schedule.update.mutateAsync({ id: blockForm.block.id, status: 'completed' });
    setBlockForm({ open: false, block: null });
  };

  const saveLog = async (values: TimeLogFormValues) => {
    const task = values.taskId ? intentions.find((item) => item.id === values.taskId) : undefined;
    const payload = {
      taskId: values.taskId,
      customTitle: values.customTitle || task?.title || null,
      categoryId: values.categoryId || task?.categoryId || null,
      logDate: values.logDate,
      startTime: values.startTime || null,
      endTime: values.endTime || null,
      durationMins: values.durationMins,
      notes: values.notes || null,
      mood: values.mood || null,
      isAdHoc: !values.taskId,
    };
    if (logForm.log) await timeLogs.update.mutateAsync({ id: logForm.log.id, ...payload });
    else await timeLogs.create.mutateAsync(payload);
  };

  const deleteLog = async () => {
    if (!logForm.log) return;
    await timeLogs.remove.mutateAsync(logForm.log.id);
    setLogForm({ open: false, log: null });
  };

  const saveQuickLog = async (values: { customTitle: string; categoryId: string | null; durationMins: number; notes: string; mood: 'restorative' | 'energizing' | 'distraction' | 'firefight' | null }) => {
    await timeLogs.create.mutateAsync({
      customTitle: values.customTitle,
      categoryId: values.categoryId,
      logDate: date,
      durationMins: values.durationMins,
      notes: values.notes || null,
      mood: values.mood,
      isAdHoc: true,
    });
  };

  const moveBlockNextDay = async (block: EnrichedScheduleBlock) => {
    const nextDate = addDaysISO(block.scheduledDate, 1);
    await schedule.create.mutateAsync({
      taskId: block.taskId,
      scheduledDate: nextDate,
      startTime: block.startTime,
      endTime: block.endTime,
      plannedDurationMins: block.plannedDurationMins,
      notes: block.notes,
      rolledFromBlockId: block.id,
    });
    await schedule.update.mutateAsync({ id: block.id, status: 'rolled' });
  };

  const returnBlockToIntentions = async (block: EnrichedScheduleBlock) => {
    await schedule.remove.mutateAsync(block.id);
  };

  const dismissBlock = async (block: EnrichedScheduleBlock) => {
    await schedule.update.mutateAsync({ id: block.id, status: 'dismissed' });
  };

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(date, i - 3)), [date]);

  return (
    <div className="space-y-5">
      <section className="card relative overflow-hidden p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
              <TrendingUp size={14} /> Daily Journal
            </div>
            <h1 className="text-2xl font-bold text-text">{formatDateLong(date)}</h1>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {weekDates.map((day) => (
                <button
                  key={day}
                  onClick={() => onDateChange(day)}
                  className={clsx('rounded-lg border px-2.5 py-1 text-xs font-semibold transition', day === date ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface text-text-muted hover:text-text')}
                >
                  {new Date(day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                  {day === todayISO() ? ' • Today' : ''}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => onDateChange(addDaysISO(date, -1))}>← Prev</Button>
            <Button variant="secondary" onClick={() => onDateChange(todayISO())}>Today</Button>
            <Button variant="secondary" onClick={() => onDateChange(addDaysISO(date, 1))}>Next →</Button>
            <Button variant="secondary" onClick={() => onQuickLogOpenChange(true)}><Zap size={15} /> Spontaneous</Button>
            <Button variant="primary" onClick={() => setRolloverOpen(true)}><MoonStar size={15} /> Rollover {pendingBlocks.length > 0 && <span className="rounded-full bg-white/20 px-1.5">{pendingBlocks.length}</span>}</Button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Intent Target', value: formatDuration(summary.plannedMins), icon: CalendarClock },
            { label: 'Tracked Reality', value: formatDuration(summary.actualMins), icon: Timer },
            { label: 'Alignment', value: `${summary.alignment}%`, icon: TrendingUp },
            { label: 'Unplanned Drift', value: formatDuration(summary.unplannedMins), icon: Zap },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-surface-low p-3">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-text-muted"><span>{stat.label}</span><stat.icon size={15} /></div>
              <div className="mt-1 text-xl font-bold text-text">{stat.value}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          {blocksLoading || logsLoading ? (
            <div className="card p-10 text-center text-sm text-text-muted">Loading timeline…</div>
          ) : (
            <DailyTimeline
              date={date}
              blocks={enrichedBlocks}
              logs={enrichedLogs}
              categories={categories}
              dayStartHour={dayBounds.data?.start ?? 6}
              dayEndHour={dayBounds.data?.end ?? 22}
              onDropTask={handleDropTask}
              onDropBlock={moveBlockToTime}
              onBlockClick={(block) => openBlockForm(block)}
              onLogClick={(log) => openLogForm(log)}
              onPlannedSlotClick={(startTime) => openBlockForm(null, startTime)}
              onActualSlotClick={(startTime) => openLogForm(null, startTime)}
            />
          )}
          <div className="flex flex-wrap gap-2 text-xs text-text-muted">
            <span className="rounded-full border border-border bg-surface px-3 py-1">Drag intentions onto Intent slots</span>
            <span className="rounded-full border border-border bg-surface px-3 py-1">Click empty Reality time to log ad-hoc activity</span>
          </div>
        </div>

        <aside className="space-y-3">
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-text">Intentions Menu</h2>
              <button onClick={onOpenIntentions} className="text-xs font-semibold text-accent hover:underline">Manage</button>
            </div>
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {intentions.slice(0, 30).map((item) => {
                const category = categories.find((entry) => entry.id === item.categoryId);
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(event) => {
                      setDragSourceHeight(event.currentTarget.getBoundingClientRect().height);
                      event.dataTransfer.setData('application/x-intent-scheduler-task', JSON.stringify(item));
                    }}
                    className="flex cursor-grab items-center gap-2 rounded-xl border border-border bg-surface-low px-3 py-2 transition hover:border-accent active:cursor-grabbing"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: category?.colorHex ?? 'var(--text-subtle)' }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold text-text">{item.title}</div>
                      <div className="text-[10px] text-text-muted">{item.defaultDurationMins ? formatDuration(item.defaultDurationMins) : 'No estimate'}</div>
                    </div>
                    <CategoryBadge category={category} />
                  </div>
                );
              })}
              {intentions.length === 0 && <p className="text-xs text-text-muted">No active intentions. Create some in the Intentions view.</p>}
            </div>
          </div>
          <Button variant="secondary" className="w-full" onClick={() => openBlockForm()}><Plus size={15} /> Plan a block manually</Button>
        </aside>
      </div>

      <ScheduleBlockFormModal
        open={blockForm.open}
        onClose={() => setBlockForm({ open: false, block: null })}
        date={date}
        block={blockForm.block}
        tasks={intentions}
        categories={categories}
        defaultStartTime={blockForm.startTime}
        onSave={saveBlock}
        onDelete={blockForm.block ? deleteBlock : undefined}
        onStartTimer={blockForm.block ? startTimerForBlock : undefined}
        onLogActual={blockForm.block ? logActualForBlock : undefined}
      />
      <TimeLogFormModal
        open={logForm.open}
        onClose={() => setLogForm({ open: false, log: null })}
        date={date}
        log={logForm.log}
        tasks={intentions}
        categories={categories}
        defaultStartTime={logForm.startTime}
        onSave={saveLog}
        onDelete={logForm.log ? deleteLog : undefined}
      />
      <QuickLogModal
        open={quickLogOpen}
        onClose={() => onQuickLogOpenChange(false)}
        date={date}
        categories={categories}
        onSave={saveQuickLog}
      />
      <RolloverModal
        open={rolloverOpen}
        onClose={() => setRolloverOpen(false)}
        date={date}
        blocks={pendingBlocks}
        onMoveNextDay={moveBlockNextDay}
        onReturnToIntentions={returnBlockToIntentions}
        onDismiss={dismissBlock}
      />
    </div>
  );
}
