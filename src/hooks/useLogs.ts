import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTimeLog, deleteTimeLog, listTimeLogs, listTimeLogsRange, updateTimeLog } from '@/db/queries';
import type { TimeLog, TimeLogMood } from '@/types/database';

export function useTimeLogs(date: string) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['logs', 'day', date], queryFn: () => listTimeLogs(date) });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['logs'] });
    queryClient.invalidateQueries({ queryKey: ['schedule'] });
  };

  const create = useMutation({
    mutationFn: (input: Parameters<typeof createTimeLog>[0]) => createTimeLog(input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Parameters<typeof updateTimeLog>[1]) => updateTimeLog(id, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({ mutationFn: deleteTimeLog, onSuccess: invalidate });

  return { logs: query.data ?? [], isLoading: query.isLoading, create, update, remove };
}

export function useTimeLogsRange(startDate: string, endDate: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['logs', 'range', startDate, endDate],
    queryFn: () => listTimeLogsRange(startDate, endDate),
  });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['logs'] });
    queryClient.invalidateQueries({ queryKey: ['schedule'] });
  };

  const create = useMutation({
    mutationFn: (input: Parameters<typeof createTimeLog>[0]) => createTimeLog(input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Parameters<typeof updateTimeLog>[1]) => updateTimeLog(id, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({ mutationFn: deleteTimeLog, onSuccess: invalidate });

  return { logs: query.data ?? [], isLoading: query.isLoading, create, update, remove };
}

export type TimeLogInput = Parameters<typeof createTimeLog>[0];
export type TimeLogUpdate = { id: string } & Parameters<typeof updateTimeLog>[1];
export type { TimeLog, TimeLogMood };
