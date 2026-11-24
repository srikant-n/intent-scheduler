import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bootstrapDatabase, createCategory, deleteCategory, listCategories, updateCategory } from '@/db/queries';
import type { Category } from '@/types/database';

/** Category list with CRUD mutations. The query bootstraps the DB first so
 * first-launch seeding (default categories/settings) always runs. */
export function useCategories() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      await bootstrapDatabase();
      return listCategories();
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['categories'] });

  const create = useMutation({
    mutationFn: (input: { name: string; colorHex: string }) => createCategory(input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, ...input }: { id: string; name: string; colorHex: string }) => updateCategory(id, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: invalidate,
  });

  return { categories: query.data ?? [], isLoading: query.isLoading, create, update, remove };
}

/** Find a category by id; undefined for null/unknown ids. */
export function categoryById(categories: Category[], id: string | null | undefined): Category | undefined {
  return categories.find((category) => category.id === id);
}
