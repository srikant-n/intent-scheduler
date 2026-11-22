import { useMemo, useState } from 'react';
import { Archive, CalendarPlus, Pencil, Plus, Repeat, Search } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { useIntentions } from '@/hooks/useIntentions';
import { useScheduleMutations } from '@/hooks/useSchedule';
import { Button } from '@/components/common/Button';
import { CategoryBadge } from '@/components/common/Badge';
import { EmptyState } from '@/components/common/EmptyState';
import { Input, Select } from '@/components/common/Field';
import { IntentionFormModal, IntentionFormValues } from '@/components/intentions/IntentionFormModal';
import { CategoryFormModal } from '@/components/intentions/CategoryFormModal';
import type { Category, Intention } from '@/types/database';
import { categoryById } from '@/hooks/useCategories';
import { formatDuration, minutesToTime, snapMinutes, todayISO } from '@/utils/time';

type Filter = 'all' | 'recurring' | 'one-off' | 'archived';
type Sort = 'category' | 'duration-desc' | 'duration-asc' | 'recent';

export function IntentionsPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('category');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Intention | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const active = useIntentions('active');
  const archived = useIntentions('archived');
  const { categories, create: createCategory, update: updateCategory } = useCategories();
  const schedule = useScheduleMutations();

  const intentions = filter === 'archived' ? archived.intentions : active.intentions;
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let items = intentions.filter((item) => {
      if (filter === 'recurring') return item.isRecurring;
      if (filter === 'one-off') return !item.isRecurring;
      return true;
    });
    if (query) items = items.filter((item) => `${item.title} ${item.notes ?? ''}`.toLowerCase().includes(query));
    const categoryName = (item: Intention) => categoryById(categories, item.categoryId)?.name ?? 'zzz';
    if (sort === 'duration-desc') items = [...items].sort((a, b) => (b.defaultDurationMins ?? 0) - (a.defaultDurationMins ?? 0));
    if (sort === 'duration-asc') items = [...items].sort((a, b) => (a.defaultDurationMins ?? 9999) - (b.defaultDurationMins ?? 9999));
    if (sort === 'recent') items = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === 'category') items = [...items].sort((a, b) => categoryName(a).localeCompare(categoryName(b)) || a.title.localeCompare(b.title));
    return items;
  }, [intentions, filter, search, sort, categories]);

  const grouped = useMemo(() => {
    const map = new Map<string, Intention[]>();
    for (const item of filtered) {
      const key = item.categoryId ?? 'uncategorized';
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()].sort(([a], [b]) => {
      const an = a === 'uncategorized' ? 'zzz' : categoryById(categories, a)?.name ?? 'zzz';
      const bn = b === 'uncategorized' ? 'zzz' : categoryById(categories, b)?.name ?? 'zzz';
      return an.localeCompare(bn);
    });
  }, [filtered, categories]);

  const saveIntention = async (values: IntentionFormValues) => {
    const payload = {
      title: values.title,
      categoryId: values.categoryId || null,
      isRecurring: values.isRecurring,
      defaultDurationMins: values.defaultDurationMins,
      notes: values.notes || null,
      priority: values.priority || null,
    };
    if (editing) await active.update.mutateAsync({ id: editing.id, ...payload });
    else await active.create.mutateAsync(payload);
  };

  const addToToday = async (item: Intention) => {
    const now = new Date();
    const start = snapMinutes(now.getHours() * 60 + now.getMinutes(), 15);
    const duration = item.defaultDurationMins ?? 30;
    await schedule.create.mutateAsync({
      taskId: item.id,
      scheduledDate: todayISO(),
      startTime: minutesToTime(start),
      endTime: minutesToTime(start + duration),
      plannedDurationMins: duration,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Intentions</h1>
          <p className="text-sm text-text-muted">Your flat, categorized backlog for planned reality.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setEditingCategory(null); setCategoryFormOpen(true); }}><Plus size={15} /> Category</Button>
          <Button variant="primary" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={15} /> New Intention</Button>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-56 flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
          <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search intentions" />
        </div>
        <Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="w-40">
          <option value="all">All tasks</option>
          <option value="recurring">Recurring</option>
          <option value="one-off">One-off</option>
          <option value="archived">Archived</option>
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="w-48">
          <option value="category">Category</option>
          <option value="duration-desc">Duration high → low</option>
          <option value="duration-asc">Duration low → high</option>
          <option value="recent">Recently added</option>
        </Select>
      </div>

      {grouped.length === 0 ? (
        <EmptyState title="No intentions yet" description="Create your first task, habit, or errand to start planning the day." action={<Button variant="primary" onClick={() => setFormOpen(true)}><Plus size={15} /> New Intention</Button>} />
      ) : (
        grouped.map(([categoryId, items]) => {
          const category = categoryById(categories, categoryId === 'uncategorized' ? null : categoryId);
          return (
            <section key={categoryId} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CategoryBadge category={category ?? { id: 'none', name: 'Uncategorized', colorHex: '#78716c', createdAt: '' }} />
                  <span className="text-xs text-text-subtle">{items.length} item{items.length === 1 ? '' : 's'}</span>
                </div>
                {category && (
                  <Button size="sm" variant="ghost" onClick={() => { setEditingCategory(category); setCategoryFormOpen(true); }}>Edit</Button>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <article
                    key={item.id}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData('application/x-intent-scheduler-task', JSON.stringify(item))}
                    className="card group cursor-grab rounded-2xl p-4 transition hover:border-border-strong active:cursor-grabbing"
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 text-text-subtle">
                        <Repeat size={14} className={item.isRecurring ? 'text-accent' : 'opacity-30'} />
                        <span className="text-[11px] font-bold uppercase tracking-wide">{item.isRecurring ? 'Habitual' : 'One-off'}</span>
                      </div>
                      <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                        <button title="Edit" onClick={() => { setEditing(item); setFormOpen(true); }} className="rounded-md p-1.5 text-text-muted hover:bg-surface-high hover:text-text"><Pencil size={14} /></button>
                        {filter === 'archived' ? (
                          <button title="Restore" onClick={() => active.restore.mutate(item.id)} className="rounded-md p-1.5 text-success hover:bg-success-soft"><Archive size={14} /></button>
                        ) : (
                          <button title="Archive" onClick={() => active.archive.mutate(item.id)} className="rounded-md p-1.5 text-text-muted hover:bg-surface-high hover:text-text"><Archive size={14} /></button>
                        )}
                      </div>
                    </div>
                    <h3 className="font-bold text-text">{item.title}</h3>
                    {item.notes && <p className="mt-1 line-clamp-2 text-xs text-text-muted">{item.notes}</p>}
                    <div className="mt-4 flex items-center justify-between text-xs text-text-muted">
                      <span>{item.defaultDurationMins ? formatDuration(item.defaultDurationMins) : 'No estimate'}</span>
                      <Button size="sm" variant="secondary" onClick={() => addToToday(item)}><CalendarPlus size={13} /> Today</Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })
      )}

      <IntentionFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        intention={editing}
        categories={categories}
        onSave={saveIntention}
      />
      <CategoryFormModal
        open={categoryFormOpen}
        onClose={() => setCategoryFormOpen(false)}
        category={editingCategory}
        onSave={async (values) => {
          if (editingCategory) await updateCategory.mutateAsync({ id: editingCategory.id, ...values });
          else await createCategory.mutateAsync(values);
        }}
      />
    </div>
  );
}
