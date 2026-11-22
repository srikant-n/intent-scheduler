import { useMemo, useState } from 'react';
import { Archive, CalendarPlus, ChevronDown, Database, Pencil, Plus, Repeat, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import clsx from 'clsx';
import { useCategories } from '@/hooks/useCategories';
import { useIntentions } from '@/hooks/useIntentions';
import { useScheduleMutations } from '@/hooks/useSchedule';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { Input, Select } from '@/components/common/Field';
import { IntentionFormModal, IntentionFormValues } from '@/components/intentions/IntentionFormModal';
import { CategoryFormModal } from '@/components/intentions/CategoryFormModal';
import type { Category, Intention } from '@/types/database';
import { categoryById } from '@/hooks/useCategories';
import { filterSortIntentions, groupIntentionsByCategory, type IntentionFilter, type IntentionSort } from '@/utils/planner';
import { formatDuration, minutesToTime, snapMinutes, todayISO } from '@/utils/time';
import { setDragSourceHeight } from '@/utils/dragContext';

type Filter = IntentionFilter;
type Sort = IntentionSort;

const filterTabs: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All Tasks' },
  { key: 'recurring', label: 'Recurring Habitual' },
  { key: 'one-off', label: 'One-Off' },
  { key: 'archived', label: 'Archived' },
];

const sortOptions: { key: Sort; label: string }[] = [
  { key: 'category', label: 'Category & Priority' },
  { key: 'duration-desc', label: 'Duration (High → Low)' },
  { key: 'duration-asc', label: 'Duration (Low → High)' },
  { key: 'recent', label: 'Recently Added' },
];

function PriorityChip({ priority }: { priority: string | null }) {
  if (!priority || priority === 'none') return null;
  return (
    <span className={clsx(
      'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
      priority === 'high' ? 'bg-danger-soft text-danger' : priority === 'medium' ? 'bg-warning-soft text-warning' : 'bg-surface-high text-text-muted',
    )}>
      {priority} priority
    </span>
  );
}

export function IntentionsPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('category');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
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
    const base = filterSortIntentions(intentions, { filter, search, sort }, categories);
    if (!categoryFilter) return base;
    return base.filter((item) => (item.categoryId ?? 'uncategorized') === categoryFilter);
  }, [intentions, filter, search, sort, categories, categoryFilter]);

  const grouped = useMemo(() => groupIntentionsByCategory(filtered, categories), [filtered, categories]);

  const counts = useMemo(() => ({
    all: active.intentions.length,
    recurring: active.intentions.filter((i) => i.isRecurring).length,
    oneOff: active.intentions.filter((i) => !i.isRecurring).length,
    archived: archived.intentions.length,
  }), [active.intentions, archived.intentions]);

  const totalPlanned = useMemo(
    () => active.intentions.reduce((sum, item) => sum + (item.defaultDurationMins ?? 0), 0),
    [active.intentions],
  );

  const saveIntention = async (values: IntentionFormValues) => {
    const payload = {
      title: values.title,
      categoryId: values.categoryId || null,
      isRecurring: values.isRecurring,
      defaultDurationMins: values.defaultDurationMins,
      targetSessionsPerWeek: values.targetSessionsPerWeek,
      preferredWeekdays: values.preferredWeekdays,
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

  const toggleCollapsed = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openForm = (item: Intention | null = null) => {
    setEditing(item);
    setFormOpen(true);
  };

  const renderRow = (item: Intention) => {
    const isArchived = filter === 'archived';
    return (
      <div
        key={item.id}
        draggable={!isArchived}
        onDragStart={(event) => {
          setDragSourceHeight(event.currentTarget.getBoundingClientRect().height);
          event.dataTransfer.setData('application/x-intent-scheduler-task', JSON.stringify(item));
        }}
        className="group relative flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-surface p-3 shadow-sm transition hover:border-border-strong hover:shadow-md"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="cursor-grab text-text-subtle transition-colors hover:text-accent active:cursor-grabbing">⠿</span>
          <button
            title={isArchived ? 'Restore' : 'Archive'}
            onClick={() => (isArchived ? active.restore.mutate(item.id) : active.archive.mutate(item.id))}
            className={clsx(
              'h-4 w-4 shrink-0 rounded border transition-colors',
              isArchived ? 'border-border-strong/60 hover:border-accent' : 'border-border-strong/70 hover:border-accent hover:bg-accent-soft',
            )}
          />
          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-text">{item.title}</span>
              {item.isRecurring && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                  <Repeat size={9} /> Habitual{item.targetSessionsPerWeek ? ` • ${item.targetSessionsPerWeek}×/wk` : ''}
                </span>
              )}
              {!item.isRecurring && <span className="rounded bg-surface-high px-1.5 py-0.5 text-[10px] font-medium text-text-muted">One-Off</span>}
              <PriorityChip priority={item.priority} />
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-muted">
              <span className="font-medium text-text">{item.defaultDurationMins ? `${formatDuration(item.defaultDurationMins)} alloc` : 'No estimate'}</span>
              {item.notes && <span className="truncate">• {item.notes}</span>}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100">
          {!isArchived && (
            <Button size="sm" variant="secondary" onClick={() => addToToday(item)}>
              <CalendarPlus size={13} /> <span className="hidden sm:inline">Add to Today</span>
            </Button>
          )}
          <button title="Edit" onClick={() => openForm(item)} className="rounded-lg p-1.5 text-text-subtle transition hover:bg-surface-high hover:text-text">
            <Pencil size={14} />
          </button>
          {!isArchived && (
            <button title="Archive" onClick={() => active.archive.mutate(item.id)} className="rounded-lg p-1.5 text-text-subtle transition hover:bg-surface-high hover:text-text">
              <Archive size={14} />
            </button>
          )}
          {isArchived && (
            <button title="Restore" onClick={() => active.restore.mutate(item.id)} className="rounded-lg p-1.5 text-success transition hover:bg-success-soft">
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-high px-2 py-0.5 text-[10px] font-semibold text-text-muted">
              <Database size={11} className="text-success" /> chronicle.db • {active.intentions.length} ready slots
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-text">The Menu</h1>
            <span className="text-sm text-text-muted">Intentions &amp; Intent Arsenal</span>
          </div>
          <p className="mt-0.5 max-w-2xl text-xs text-text-muted">
            Tactile unallocated intentions repository. Drag items into the Dual-Track day or the Weekly Planner.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => { setEditingCategory(null); setCategoryFormOpen(true); }}>
            <SlidersHorizontal size={13} /> Category
          </Button>
          <Button variant="primary" onClick={() => openForm()}>
            <Plus size={15} /> New Intention
          </Button>
        </div>
      </div>

      <div className="card flex flex-col gap-3 p-4">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xl">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
            <Input className="pl-9 pr-14" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter intentions by title, tag, or duration…" />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded bg-surface-high px-1.5 py-0.5 text-[10px] text-text-muted">Ctrl+F</kbd>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-surface px-2.5 py-1.5 text-xs shadow-sm">
              <span className="text-text-subtle">Sort:</span>
              <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="border-0 bg-transparent px-0 py-0 text-xs shadow-none focus:ring-0">
                {sortOptions.map((opt) => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
              </Select>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
          <div className="flex flex-wrap items-center gap-1">
            {filterTabs.map((tab) => {
              const count = tab.key === 'all' ? counts.all : tab.key === 'recurring' ? counts.recurring : tab.key === 'one-off' ? counts.oneOff : counts.archived;
              const activeTab = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={clsx(
                    'rounded-lg px-2.5 py-1 text-[11px] font-semibold shadow-sm transition',
                    activeTab ? 'bg-accent text-accent-contrast' : 'bg-surface text-text-muted hover:bg-surface-high hover:text-text',
                  )}
                >
                  {tab.label} <span className={clsx('ml-0.5', activeTab ? 'opacity-80' : 'text-text-subtle')}>({count})</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-text-subtle">Taxonomy</span>
            <button
              onClick={() => setCategoryFilter(null)}
              className={clsx('rounded-full border px-2 py-0.5 text-[10px] font-semibold transition', categoryFilter === null ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface text-text-muted hover:text-text')}
            >
              All
            </button>
            {categories.map((category) => {
              const activeCat = categoryFilter === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => setCategoryFilter(activeCat ? null : category.id)}
                  className={clsx('flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition', activeCat ? 'border-transparent bg-surface-high text-text' : 'border-border bg-surface text-text-muted hover:text-text')}
                  style={activeCat ? { borderColor: `${category.colorHex}66`, backgroundColor: `${category.colorHex}14`, color: category.colorHex } : undefined}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: category.colorHex }} />
                  {category.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-8">
          {grouped.length === 0 ? (
            <EmptyState title="No intentions yet" description="Create your first task, habit, or errand to start planning the day." action={<Button variant="primary" onClick={() => openForm()}><Plus size={15} /> New Intention</Button>} />
          ) : (
            grouped.map(([categoryId, items]) => {
              const category = categoryById(categories, categoryId === 'uncategorized' ? null : categoryId);
              const color = category?.colorHex ?? '#78716c';
              const totalMins = items.reduce((sum, item) => sum + (item.defaultDurationMins ?? 0), 0);
              const isCollapsed = collapsed.has(categoryId);
              return (
                <section key={categoryId} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-1 py-1">
                    <div className="flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: color }} />
                      <h2 className="text-sm font-bold tracking-tight text-text">{category?.name ?? 'Uncategorized'}</h2>
                      <span className="font-mono text-[10px] text-text-subtle">{color}</span>
                      <span className="rounded-full bg-surface-high px-2 py-0.5 text-[10px] font-semibold text-text-muted">
                        {items.length} task{items.length === 1 ? '' : 's'}{totalMins > 0 ? ` • ${formatDuration(totalMins)}` : ''}
                      </span>
                    </div>
                    <button title={isCollapsed ? 'Expand' : 'Collapse'} onClick={() => toggleCollapsed(categoryId)} className="rounded p-1 text-text-subtle transition hover:bg-surface-high hover:text-text">
                      <ChevronDown size={15} className={clsx('transition-transform', isCollapsed && '-rotate-90')} />
                    </button>
                  </div>
                  {!isCollapsed && (
                    <div className="flex flex-col gap-1.5">
                      {items.map(renderRow)}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>

        <aside className="space-y-3 lg:col-span-4">
          <div className="card p-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-subtle">Arsenal Summary</div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-text-muted">Active intentions</span><span className="font-bold text-text">{counts.all}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Recurring habits</span><span className="font-bold text-text">{counts.recurring}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">One-off tasks</span><span className="font-bold text-text">{counts.oneOff}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Archived</span><span className="font-bold text-text">{counts.archived}</span></div>
              <div className="flex justify-between border-t border-border pt-2"><span className="text-text-muted">Est. workload</span><span className="font-bold text-accent">{formatDuration(totalPlanned)}</span></div>
            </div>
          </div>
          <Button variant="secondary" className="w-full" onClick={() => { setEditingCategory(null); setCategoryFormOpen(true); }}>
            <Plus size={14} /> Manage categories
          </Button>
        </aside>
      </div>

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
