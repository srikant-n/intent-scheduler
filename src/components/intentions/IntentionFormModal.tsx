import { FormEvent, useEffect, useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Field, Input, Select, Textarea } from '@/components/common/Field';
import type { Category, Intention } from '@/types/database';

export interface IntentionFormValues {
  title: string;
  categoryId: string | null;
  isRecurring: boolean;
  defaultDurationMins: number | null;
  targetSessionsPerWeek: number | null;
  preferredWeekdays: number[];
  notes: string;
  priority: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  intention?: Intention | null;
  categories: Category[];
  onSave: (values: IntentionFormValues) => Promise<void>;
}

const durations = [15, 20, 25, 30, 45, 60, 90, 120];
const weekdayOptions = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 7, label: 'Sun' },
];

export function IntentionFormModal({ open, onClose, intention, categories, onSave }: Props) {
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [duration, setDuration] = useState('45');
  const [targetSessions, setTargetSessions] = useState('');
  const [preferredDays, setPreferredDays] = useState<number[]>([]);
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState('none');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(intention?.title ?? '');
    setCategoryId(intention?.categoryId ?? categories[0]?.id ?? '');
    setIsRecurring(intention?.isRecurring ?? false);
    setDuration(String(intention?.defaultDurationMins ?? 45));
    setTargetSessions(intention?.targetSessionsPerWeek != null ? String(intention.targetSessionsPerWeek) : '');
    setPreferredDays(intention?.preferredWeekdays ?? []);
    setNotes(intention?.notes ?? '');
    setPriority(intention?.priority ?? 'none');
  }, [open, intention, categories]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({
        title,
        categoryId: categoryId || null,
        isRecurring,
        defaultDurationMins: duration ? Number(duration) : null,
        targetSessionsPerWeek: isRecurring && targetSessions ? Number(targetSessions) : null,
        preferredWeekdays: isRecurring ? preferredDays : [],
        notes,
        priority: priority === 'none' ? '' : priority,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={intention ? 'Edit Intention' : 'New Intention'} subtitle="Keep the menu flat, fast, and draggable.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Study Rust async patterns" required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Default duration">
            <Select value={duration} onChange={(e) => setDuration(e.target.value)}>
              <option value="">No estimate</option>
              {durations.map((mins) => <option key={mins} value={mins}>{mins} min</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cadence">
            <Select value={isRecurring ? 'recurring' : 'one-off'} onChange={(e) => setIsRecurring(e.target.value === 'recurring')}>
              <option value="one-off">One-off</option>
              <option value="recurring">Habitual / recurring</option>
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="none">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </Field>
        </div>
        {isRecurring && (
          <div className="space-y-3 rounded-xl border border-border bg-surface-low p-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sessions per week" hint="Used by Weekly habit distribution">
                <Select value={targetSessions} onChange={(e) => setTargetSessions(e.target.value)}>
                  <option value="">No target</option>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}× / week</option>)}
                </Select>
              </Field>
              <Field label="Preferred days" hint="Optional — empty means any day">
                <div className="flex flex-wrap gap-1 pt-1">
                  {weekdayOptions.map(({ day, label }) => {
                    const active = preferredDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setPreferredDays((prev) => active ? prev.filter((d) => d !== day) : [...prev, day].sort())}
                        className={`rounded-md border px-2 py-1 text-[11px] font-bold transition ${active ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface text-text-muted hover:text-text'}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          </div>
        )}
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional context or sub-intent" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Save Intention'}</Button>
        </div>
      </form>
    </Modal>
  );
}
