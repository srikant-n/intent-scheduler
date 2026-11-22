import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSetting, setSetting } from '@/db/queries';
import { parseWeeklyCapacity, serializeWeeklyCapacity, WEEKLY_CAPACITY_KEY, type WeeklyCapacity } from '@/utils/capacity';

export function useWeeklyCapacity() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['settings', 'weekly-capacity'],
    queryFn: async () => parseWeeklyCapacity(await getSetting(WEEKLY_CAPACITY_KEY)),
  });

  const update = useMutation({
    mutationFn: async (capacity: WeeklyCapacity) => {
      await setSetting(WEEKLY_CAPACITY_KEY, serializeWeeklyCapacity(capacity));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'weekly-capacity'] }),
  });

  return { capacity: query.data ?? parseWeeklyCapacity(null), isLoading: query.isLoading, update };
}
