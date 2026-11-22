import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createScheduleBlock,
  deleteScheduleBlock,
  listScheduleBlocks,
  listScheduleBlocksRange,
  updateScheduleBlock,
} from '@/db/queries';
import type { ScheduleBlock, ScheduleStatus } from '@/types/database';

export function useScheduleBlocks(date: string) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['schedule', 'day', date], queryFn: () => listScheduleBlocks(date) });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['schedule'] });
    queryClient.invalidateQueries({ queryKey: ['logs'] });
  };

  const create = useMutation({
    mutationFn: (input: Parameters<typeof createScheduleBlock>[0]) => createScheduleBlock(input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Parameters<typeof updateScheduleBlock>[1]) => updateScheduleBlock(id, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({ mutationFn: deleteScheduleBlock, onSuccess: invalidate });

  return { blocks: query.data ?? [], isLoading: query.isLoading, create, update, remove };
}

export function useScheduleRange(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['schedule', 'range', startDate, endDate],
    queryFn: () => listScheduleBlocksRange(startDate, endDate),
  });
}

export function useScheduleMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['schedule'] });
    queryClient.invalidateQueries({ queryKey: ['logs'] });
  };
  return {
    create: useMutation({ mutationFn: createScheduleBlock, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, ...input }: { id: string } & Parameters<typeof updateScheduleBlock>[1]) => updateScheduleBlock(id, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: deleteScheduleBlock, onSuccess: invalidate }),
  };
}

export type ScheduleInput = Parameters<typeof createScheduleBlock>[0];
export type ScheduleUpdate = { id: string } & Parameters<typeof updateScheduleBlock>[1];
export type { ScheduleBlock, ScheduleStatus };
