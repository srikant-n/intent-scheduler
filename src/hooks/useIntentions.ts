import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveIntention,
  createIntention,
  listAllIntentions,
  listIntentions,
  restoreIntention,
  updateIntention,
} from '@/db/queries';
import type { Intention, TaskStatus } from '@/types/database';

export function useIntentions(status: TaskStatus = 'active') {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['intentions', status], queryFn: () => listIntentions(status) });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['intentions'] });
    queryClient.invalidateQueries({ queryKey: ['schedule'] });
  };

  const create = useMutation({
    mutationFn: (input: Parameters<typeof createIntention>[0]) => createIntention(input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Parameters<typeof updateIntention>[1]) => updateIntention(id, input),
    onSuccess: invalidate,
  });

  const archive = useMutation({ mutationFn: archiveIntention, onSuccess: invalidate });
  const restore = useMutation({ mutationFn: restoreIntention, onSuccess: invalidate });

  return {
    intentions: query.data ?? [],
    isLoading: query.isLoading,
    create,
    update,
    archive,
    restore,
  };
}

export function useAllIntentions() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['intentions', 'all'], queryFn: listAllIntentions });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['intentions'] });
    queryClient.invalidateQueries({ queryKey: ['schedule'] });
  };

  const create = useMutation({
    mutationFn: (input: Parameters<typeof createIntention>[0]) => createIntention(input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Parameters<typeof updateIntention>[1]) => updateIntention(id, input),
    onSuccess: invalidate,
  });

  return {
    intentions: query.data ?? [],
    isLoading: query.isLoading,
    create,
    update,
  };
}

export type IntentionInput = Parameters<typeof createIntention>[0];
export type IntentionUpdate = { id: string } & Parameters<typeof updateIntention>[1];
export type { Intention };
