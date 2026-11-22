import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTimeLog, getActiveTimer, saveActiveTimer, updateScheduleBlock } from '@/db/queries';
import type { ActiveTimerState, Intention, ScheduleBlock, TimeLogMood } from '@/types/database';
import { deriveLogTimes, elapsedMs, formatElapsed, uuid } from '@/utils/time';

export interface StartTimerInput {
  task?: Intention | null;
  block?: ScheduleBlock | null;
  customTitle?: string | null;
  categoryId?: string | null;
  targetDurationMins?: number | null;
  notes?: string | null;
}

export function useActiveTimer() {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const timerQuery = useQuery({ queryKey: ['active-timer'], queryFn: getActiveTimer });
  const timer = timerQuery.data ?? null;

  const persist = useMutation({
    mutationFn: (value: ActiveTimerState | null) => saveActiveTimer(value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['active-timer'] }),
  });

  useEffect(() => {
    if (!timer) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [timer]);

  const elapsed = useMemo(() => {
    if (!timer) return 0;
    return elapsedMs(timer.startedAt, timer.accumulatedPausedMs, timer.pausedAt, now);
  }, [timer, now]);

  const finalizeTimer = async (value: ActiveTimerState, saveLog: boolean) => {
    const finalElapsed = elapsedMs(value.startedAt, value.accumulatedPausedMs, value.pausedAt);
    if (saveLog && finalElapsed > 0) {
      const durationMins = Math.max(1, Math.round(finalElapsed / 60000));
      const times = deriveLogTimes(value.startedAt, finalElapsed);
      await createTimeLog({
        taskId: value.taskId,
        scheduleBlockId: value.scheduleBlockId,
        customTitle: value.customTitle,
        categoryId: value.categoryId,
        logDate: times.logDate,
        startTime: times.startTime,
        endTime: times.endTime,
        durationMins,
        notes: value.notes,
        isAdHoc: !value.taskId && !value.scheduleBlockId,
      });
      if (value.scheduleBlockId) {
        await updateScheduleBlock(value.scheduleBlockId, { status: 'completed' }).catch(() => undefined);
      }
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    }
    await persist.mutateAsync(null);
  };

  const startTimer = async (input: StartTimerInput) => {
    if (timer) await finalizeTimer(timer, true);
    const next: ActiveTimerState = {
      id: uuid(),
      taskId: input.task?.id ?? null,
      scheduleBlockId: input.block?.id ?? null,
      customTitle: input.customTitle ?? input.task?.title ?? input.block?.notes ?? null,
      categoryId: input.categoryId ?? input.task?.categoryId ?? null,
      startedAt: new Date().toISOString(),
      accumulatedPausedMs: 0,
      pausedAt: null,
      targetDurationMins: input.targetDurationMins ?? input.task?.defaultDurationMins ?? input.block?.plannedDurationMins ?? null,
      notes: input.notes ?? null,
    };
    await persist.mutateAsync(next);
    setNow(Date.now());
  };

  const pauseTimer = async () => {
    if (!timer || timer.pausedAt) return;
    await persist.mutateAsync({ ...timer, pausedAt: new Date().toISOString() });
    setNow(Date.now());
  };

  const resumeTimer = async () => {
    if (!timer?.pausedAt) return;
    const pausedFor = Date.now() - new Date(timer.pausedAt).getTime();
    await persist.mutateAsync({
      ...timer,
      accumulatedPausedMs: timer.accumulatedPausedMs + Math.max(0, pausedFor),
      pausedAt: null,
    });
    setNow(Date.now());
  };

  const stopTimer = async () => {
    if (!timer) return;
    await finalizeTimer(timer, true);
    setNow(Date.now());
  };

  const discardTimer = async () => {
    if (!timer) return;
    await finalizeTimer(timer, false);
    setNow(Date.now());
  };

  return {
    timer,
    elapsed,
    elapsedLabel: formatElapsed(elapsed),
    isPaused: Boolean(timer?.pausedAt),
    isLoading: timerQuery.isLoading,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    discardTimer,
  };
}

export type { ActiveTimerState, TimeLogMood };
