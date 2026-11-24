import type {
  Category,
  EnrichedScheduleBlock,
  EnrichedTimeLog,
  Intention,
  ScheduleBlock,
  TimeLog,
} from '@/types/database';

/** Attach the parent task to each schedule block for display (title, category, color). */
export function enrichBlocks(blocks: ScheduleBlock[], tasks: Intention[]): EnrichedScheduleBlock[] {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  return blocks.map((block) => ({ ...block, task: taskMap.get(block.taskId) }));
}

/** Resolve display fields for logs: linked task, effective category (log's own
 * category wins, else the task's), and a fallback title chain
 * (customTitle → task title → category name → "Activity"). */
export function enrichLogs(logs: TimeLog[], tasks: Intention[], categories: Category[]): EnrichedTimeLog[] {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  return logs.map((log) => {
    const task = log.taskId ? taskMap.get(log.taskId) : undefined;
    const category = categoryMap.get(log.categoryId ?? task?.categoryId ?? '');
    return {
      ...log,
      task,
      category,
      displayCategory: category,
      displayTitle: log.customTitle || task?.title || category?.name || 'Activity',
    };
  });
}

export function blockCategoryId(block: EnrichedScheduleBlock): string | null {
  return block.task?.categoryId ?? null;
}

export function blockCategory(block: EnrichedScheduleBlock, categories: Category[]): Category | undefined {
  const id = block.task?.categoryId ?? null;
  return categories.find((category) => category.id === id);
}

export function logCategoryId(log: EnrichedTimeLog): string | null {
  return log.categoryId ?? log.task?.categoryId ?? null;
}
