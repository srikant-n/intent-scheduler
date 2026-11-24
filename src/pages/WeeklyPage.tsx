import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarRange, ChevronLeft, ChevronRight, Eye, PenLine, Quote, Share2, Sparkles, Target } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { WeeklyBoard } from '@/components/weekly/WeeklyBoard';
import { WeekSummary } from '@/components/weekly/WeekSummary';
import { HabitPool } from '@/components/weekly/HabitPool';
import { HabitDistributionModal } from '@/components/weekly/HabitDistributionModal';
import type { HabitProposal as Proposal } from '@/utils/habitDistribution';
import { WeeklyCapacityModal } from '@/components/weekly/WeeklyCapacityModal';
import { WeeklyRolloverModal, type RolloverBatchResult, type WeeklyRolloverAction } from '@/components/weekly/WeeklyRolloverModal';
import { ScheduleBlockFormModal, ScheduleBlockFormValues } from '@/components/daily/ScheduleBlockFormModal';
import { useAllIntentions } from '@/hooks/useIntentions';
import { useCategories } from '@/hooks/useCategories';
import { useScheduleRange, useScheduleMutations } from '@/hooks/useSchedule';
import { useTimeLogsRange } from '@/hooks/useLogs';
import { useWeeklyCapacity } from '@/hooks/useWeeklyCapacity';
import { useActiveTimer } from '@/hooks/useActiveTimer';
import { getSetting, runBatchActions } from '@/db/queries';
import { enrichBlocks } from '@/utils/enrich';
import { buildWeeklySummary } from '@/utils/weekly';
import { blocksOverlapOnDate, firstAvailableSlot } from '@/utils/habitDistribution';
import { weeklyCsvRows } from '@/utils/analytics';
import { toCsv } from '@/utils/csv';
import { saveTextFile } from '@/utils/fileExport';
import { isPendingRolloverBlock } from '@/utils/planner';
import type { BoardMode } from '@/components/weekly/WeeklyBlockCard';
import type { EnrichedScheduleBlock, Intention, ScheduleBlock } from '@/types/database';
import {
  addDaysISO,
  formatDuration,
  formatWeekRangeShort,
  isoWeekNumber,
  minutesToTime,
  nextMondayISO,
  timeToMinutes,
  todayISO,
  weekDatesISO,
  weekEndISO,
  weekStartISO,
} from '@/utils/time';

interface WeeklyPageProps {
  date: string;
  onDateChange: (date: string) => void;
}

interface BlockFormState {
  open: boolean;
  block: ScheduleBlock | null;
  date: string;
  startTime?: string;
  taskId?: string;
}

/** Weekly Planner view: 7-day board with capacity bar, habit distribution,
 * week rollover modal, and CSV export. Draft/Review board modes. */
export function WeeklyPage({ date, onDateChange }: WeeklyPageProps) {
  const weekDates = useMemo(() => weekDatesISO(date), [date]);
  const weekStart = weekStartISO(date);
  const weekEnd = weekEndISO(date);

  const [blockForm, setBlockForm] = useState<BlockFormState>({ open: false, block: null, date });
  const [habitModalOpen, setHabitModalOpen] = useState(false);
  const [capacityModalOpen, setCapacityModalOpen] = useState(false);
  const [rolloverOpen, setRolloverOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<{ block: EnrichedScheduleBlock; targetDate: string } | null>(null);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [boardMode, setBoardMode] = useState<BoardMode>('draft');

  const blocksQuery = useScheduleRange(weekStart, weekEnd);
  const blocks = useMemo(() => blocksQuery.data ?? [], [blocksQuery.data]);
  const logsQuery = useTimeLogsRange(weekStart, weekEnd);
  const logs = useMemo(() => logsQuery.logs, [logsQuery.logs]);
  const { intentions: allIntentions } = useAllIntentions();
  const activeIntentions = useMemo(() => allIntentions.filter((item) => item.status === 'active'), [allIntentions]);
  const { categories } = useCategories();
  const schedule = useScheduleMutations();
  const timer = useActiveTimer();
  const { capacity, update: updateCapacity } = useWeeklyCapacity();

  const settings = useQuery({
    queryKey: ['settings', 'planner'],
    queryFn: async () => ({
      dayStart: Number((await getSetting('day_start_hour')) ?? 6),
      dayEnd: Number((await getSetting('day_end_hour')) ?? 22),
      snap: Number((await getSetting('snap_interval_minutes')) ?? 15),
    }),
  });
  const dayStartHour = settings.data?.dayStart ?? 6;
  const dayEndHour = settings.data?.dayEnd ?? 22;
  const snapInterval = settings.data?.snap ?? 15;
  const dayStartMinutes = dayStartHour * 60;
  const dayEndMinutes = dayEndHour * 60;

  const enrichedBlocks = useMemo(() => enrichBlocks(blocks, allIntentions), [blocks, allIntentions]);

  // Week-level aggregates: actual minutes per block, IDs still eligible for
  // rollover, and the full capacity/planned/actual summary for the header bar.
  const actualByBlock = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of logs) {
      if (!log.scheduleBlockId) continue;
      map.set(log.scheduleBlockId, (map.get(log.scheduleBlockId) ?? 0) + log.durationMins);
    }
    return map;
  }, [logs]);

  const pendingIds = useMemo(() => {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const today = todayISO();
    const ids = new Set<string>();
    for (const block of enrichedBlocks) {
      if (isPendingRolloverBlock(block, today, nowMinutes, (actualByBlock.get(block.id) ?? 0) > 0)) ids.add(block.id);
    }
    return ids;
  }, [enrichedBlocks, actualByBlock]);

  const summary = useMemo(
    () => buildWeeklySummary({ weekDates, blocks, logs, intentions: allIntentions, categories, capacity, pendingBlockIds: pendingIds }),
    [weekDates, blocks, logs, allIntentions, categories, capacity, pendingIds],
  );

  // Only unfinished blocks reach the board — rolled/dismissed ones are hidden.
  const blocksByDate = useMemo(() => {
    const map = new Map<string, EnrichedScheduleBlock[]>();
    const visible = enrichedBlocks
      .filter((block) => block.status !== 'dismissed' && block.status !== 'rolled')
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (const block of visible) {
      map.set(block.scheduledDate, [...(map.get(block.scheduledDate) ?? []), block]);
    }
    return map;
  }, [enrichedBlocks]);

  const categoryOf = (block: EnrichedScheduleBlock) =>
    categories.find((category) => category.id === block.task?.categoryId);

  const pendingBlocks = useMemo(
    () => enrichedBlocks.filter((block) => pendingIds.has(block.id)),
    [enrichedBlocks, pendingIds],
  );

  const openBlockForm = (block: ScheduleBlock | null = null, formDate = date, startTime?: string, taskId?: string) =>
    setBlockForm({ open: true, block, date: formDate, startTime, taskId });

  const firstSlotFor = (targetDate: string, durationMins: number) =>
    firstAvailableSlot(blocks, targetDate, durationMins, dayStartMinutes, dayEndMinutes, snapInterval);

  // Drop an intention on a day column → find the first free snapped slot for
  // its default duration and pre-fill the block form at that time.
  const handleDropTask = (task: Intention, targetDate: string) => {
    const duration = task.defaultDurationMins ?? 30;
    const slot = firstSlotFor(targetDate, duration) ?? {
      startTime: minutesToTime(dayStartMinutes),
      endTime: minutesToTime(dayStartMinutes + duration),
    };
    openBlockForm(null, targetDate, slot.startTime, task.id);
  };

  const moveBlockToDate = async (block: EnrichedScheduleBlock, targetDate: string) => {
    await schedule.update.mutateAsync({ id: block.id, scheduledDate: targetDate });
  };

  // Cross-day move: warn before overwriting an overlapping block on the target day.
  const handleDropBlock = (block: EnrichedScheduleBlock, targetDate: string) => {
    if (block.scheduledDate === targetDate) return;
    const overlaps = blocksOverlapOnDate(blocks, targetDate, block.startTime, block.endTime, block.id);
    if (overlaps) {
      setPendingMove({ block, targetDate });
      return;
    }
    void moveBlockToDate(block, targetDate);
  };

  const confirmMove = async () => {
    if (!pendingMove) return;
    await moveBlockToDate(pendingMove.block, pendingMove.targetDate);
    setPendingMove(null);
  };

  const saveBlock = async (values: ScheduleBlockFormValues) => {
    if (blockForm.block) {
      await schedule.update.mutateAsync({ id: blockForm.block.id, ...values, scheduledDate: blockForm.date });
    } else {
      await schedule.create.mutateAsync({ ...values, scheduledDate: blockForm.date, status: 'planned' });
    }
  };

  const deleteBlock = async () => {
    if (!blockForm.block) return;
    await schedule.remove.mutateAsync(blockForm.block.id);
    setBlockForm({ open: false, block: null, date });
  };

  const startTimerForBlock = async () => {
    if (!blockForm.block) return;
    const task = allIntentions.find((item) => item.id === blockForm.block?.taskId) ?? null;
    await timer.startTimer({ task, block: blockForm.block, targetDurationMins: blockForm.block.plannedDurationMins });
    setBlockForm({ open: false, block: null, date });
  };

  const logActualForBlock = async (durationMins: number) => {
    if (!blockForm.block) return;
    const task = allIntentions.find((item) => item.id === blockForm.block?.taskId);
    await logsQuery.create.mutateAsync({
      taskId: blockForm.block.taskId,
      scheduleBlockId: blockForm.block.id,
      categoryId: task?.categoryId ?? null,
      logDate: blockForm.block.scheduledDate,
      startTime: blockForm.block.startTime,
      endTime: blockForm.block.endTime,
      durationMins,
      isAdHoc: false,
    });
    await schedule.update.mutateAsync({ id: blockForm.block.id, status: 'completed' });
    setBlockForm({ open: false, block: null, date });
  };

  // Habit distribution: create all proposed blocks sequentially (each is its
  // own mutation; partial success is acceptable since proposals are additive).
  const applyHabitProposals = async (proposals: Proposal[]) => {
    for (const proposal of proposals) {
      await schedule.create.mutateAsync({
        taskId: proposal.task.id,
        scheduledDate: proposal.scheduledDate,
        startTime: proposal.startTime,
        endTime: proposal.endTime,
        plannedDurationMins: proposal.plannedDurationMins,
        status: 'planned',
      });
    }
  };

  // Move a block to a new date while preserving rollover lineage — clones the
  // block onto the target and marks the source 'rolled'.
  const moveWithLineage = async (block: EnrichedScheduleBlock, targetDate: string, startTime?: string, endTime?: string) => {
    await schedule.create.mutateAsync({
      taskId: block.taskId,
      scheduledDate: targetDate,
      startTime: startTime ?? block.startTime,
      endTime: endTime ?? block.endTime,
      plannedDurationMins: block.plannedDurationMins,
      notes: block.notes,
      rolledFromBlockId: block.id,
    });
    await schedule.update.mutateAsync({ id: block.id, status: 'rolled' });
  };

  // Batch rollover: dismiss / return-to-intentions / next-day / next-Monday /
  // reschedule, run per block with partial-failure reporting.
  const applyRollover = async (
    action: WeeklyRolloverAction,
    items: EnrichedScheduleBlock[],
    reschedule?: { date: string; startTime: string },
  ): Promise<RolloverBatchResult> => {
    const result = await runBatchActions(items, async (block) => {
      if (action === 'dismiss') {
        await schedule.update.mutateAsync({ id: block.id, status: 'dismissed' });
      } else if (action === 'return') {
        await schedule.remove.mutateAsync(block.id);
      } else if (action === 'next-day') {
        await moveWithLineage(block, addDaysISO(block.scheduledDate, 1));
      } else if (action === 'next-monday') {
        await moveWithLineage(block, nextMondayISO(block.scheduledDate));
      } else if (action === 'reschedule' && reschedule) {
        const start = reschedule.startTime;
        const end = minutesToTime(timeToMinutes(start) + block.plannedDurationMins);
        await moveWithLineage(block, reschedule.date, start, end);
      }
    });
    return { succeeded: result.succeeded.length, failed: result.failed.length };
  };

  // Week CSV export via the native save dialog (Rust command).
  const exportCsv = async () => {
    const rows = weeklyCsvRows({ weekDates, blocks, logs, intentions: allIntentions });
    const csv = toCsv(rows);
    try {
      const saved = await saveTextFile(`intent-scheduler-week-${weekStart}.csv`, csv);
      setExportNote(saved ? 'CSV exported.' : 'Export cancelled.');
    } catch (error) {
      setExportNote(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    window.setTimeout(() => setExportNote(null), 4000);
  };

  const weekNumber = isoWeekNumber(weekStart);
  const bufferMins = Math.max(0, summary.totalCapacityMins - summary.totalPlannedMins);

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-lg border border-border bg-surface-low p-0.5 shadow-sm">
              <button
                type="button"
                title="Previous Week"
                onClick={() => onDateChange(addDaysISO(date, -7))}
                className="rounded p-1.5 text-text-muted transition hover:bg-surface-high hover:text-text"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-1.5 px-3 py-1 text-center">
                <span className="text-sm font-bold text-text">Week {weekNumber}</span>
                <span className="text-text-subtle">•</span>
                <span className="text-xs font-medium text-text-muted">{formatWeekRangeShort(date)}</span>
              </div>
              <button
                type="button"
                title="Next Week"
                onClick={() => onDateChange(addDaysISO(date, 7))}
                className="rounded p-1.5 text-text-muted transition hover:bg-surface-high hover:text-text"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <Button variant="secondary" size="sm" onClick={() => onDateChange(todayISO())}>This Week</Button>
            <span className="flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[10px] font-bold text-accent">
              <CalendarRange size={11} /> 7-Day Allocation Desk
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-border bg-surface-low p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setBoardMode('draft')}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${boardMode === 'draft' ? 'bg-accent-soft text-accent shadow-sm' : 'text-text-muted hover:text-text'}`}
              >
                <PenLine size={12} /> Draft Intent
              </button>
              <button
                type="button"
                onClick={() => setBoardMode('reality')}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${boardMode === 'reality' ? 'bg-accent-soft text-accent shadow-sm' : 'text-text-muted hover:text-text'}`}
              >
                <Eye size={12} /> Review Reality
              </button>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setHabitModalOpen(true)}>
              <Sparkles size={13} className="text-success" /> Distribute Habits
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setRolloverOpen(true)}>
              Rollover {pendingBlocks.length > 0 && <span className="rounded-full bg-warning-soft px-1.5 text-warning">{pendingBlocks.length}</span>}
            </Button>
            <Button variant="primary" size="sm" onClick={() => setCapacityModalOpen(true)}>
              <Target size={13} /> Weekly Target
            </Button>
            <button
              type="button"
              title="Export Week CSV"
              onClick={exportCsv}
              className="rounded-lg border border-border bg-surface-low p-1.5 text-text-muted shadow-sm transition hover:bg-surface-high hover:text-text"
            >
              <Share2 size={15} />
            </button>
          </div>
        </div>
        {exportNote && <p className="mt-2 text-xs text-text-muted">{exportNote}</p>}
        <div className="mt-4">
          <WeekSummary summary={summary} anchorDate={date} />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <WeeklyBoard
          days={summary.days}
          blocksByDate={blocksByDate}
          actualByBlock={actualByBlock}
          categoryOf={categoryOf}
          mode={boardMode}
          onAdd={(targetDate) => openBlockForm(null, targetDate)}
          onBlockClick={(block) => openBlockForm(block, block.scheduledDate)}
          onDropTask={handleDropTask}
          onDropBlock={handleDropBlock}
        />
        <aside className="space-y-3">
          <HabitPool intentions={allIntentions} blocks={enrichedBlocks} categories={categories} onConfigure={() => setHabitModalOpen(true)} />
          <div className="card flex flex-col gap-2 p-4">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-accent">
              <Quote size={13} /> Planner Note
            </div>
            <p className="text-xs italic text-text-muted">
              "Over-planning creates fragility. Leave room in the week for reality to breathe."
            </p>
            <div className="flex items-center justify-between pt-1 text-[10px] text-text-subtle">
              <span>Buffer reserved: {formatDuration(bufferMins)}</span>
              <span className={bufferMins > 0 ? 'font-semibold text-success' : 'font-semibold text-warning'}>
                {bufferMins > 0 ? 'Healthy balance' : 'Fully allocated'}
              </span>
            </div>
          </div>
        </aside>
      </div>

      <ScheduleBlockFormModal
        open={blockForm.open}
        onClose={() => setBlockForm({ open: false, block: null, date })}
        date={blockForm.date}
        block={blockForm.block}
        tasks={activeIntentions}
        categories={categories}
        defaultStartTime={blockForm.startTime}
        defaultTaskId={blockForm.taskId}
        onSave={saveBlock}
        onDelete={blockForm.block ? deleteBlock : undefined}
        onStartTimer={blockForm.block ? startTimerForBlock : undefined}
        onLogActual={blockForm.block ? logActualForBlock : undefined}
      />

      <HabitDistributionModal
        open={habitModalOpen}
        onClose={() => setHabitModalOpen(false)}
        weekDates={weekDates}
        intentions={allIntentions}
        existingBlocks={blocks}
        capacity={capacity}
        dayStartHour={dayStartHour}
        dayEndHour={dayEndHour}
        snapInterval={snapInterval}
        onApply={applyHabitProposals}
      />

      <WeeklyCapacityModal
        open={capacityModalOpen}
        onClose={() => setCapacityModalOpen(false)}
        capacity={capacity}
        onSave={async (next) => { await updateCapacity.mutateAsync(next); }}
      />

      <WeeklyRolloverModal
        open={rolloverOpen}
        onClose={() => setRolloverOpen(false)}
        blocks={pendingBlocks}
        onApply={applyRollover}
      />

      <Modal
        open={!!pendingMove}
        onClose={() => setPendingMove(null)}
        title="Overlapping block"
        subtitle="The target day already has a block at this time."
      >
        <p className="text-sm text-text-muted">
          Moving “{pendingMove?.block.task?.title ?? 'this block'}” to {pendingMove?.targetDate} overlaps an existing plan.
          Move it anyway?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setPendingMove(null)}>Cancel</Button>
          <Button variant="primary" onClick={confirmMove}>Move anyway</Button>
        </div>
      </Modal>
    </div>
  );
}
