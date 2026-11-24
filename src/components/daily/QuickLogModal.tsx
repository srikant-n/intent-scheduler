import { FormEvent, useEffect, useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Field, Input, Select, Textarea } from '@/components/common/Field';
import type { Category, TimeLogMood } from '@/types/database';

interface Props {
  open: boolean;
  onClose: () => void;
  date: string;
  categories: Category[];
  onSave: (values: { customTitle: string; categoryId: string | null; durationMins: number; notes: string; mood: TimeLogMood | null }) => Promise<void>;
}

// Duration presets offered in the quick-log dropdown.
const presets = [15, 25, 30, 45, 60, 90];
const moods: { value: TimeLogMood; label: string }[] = [
  { value: 'restorative', label: 'Restorative' },
  { value: 'energizing', label: 'Energizing' },
  { value: 'distraction', label: 'Distraction' },
  { value: 'firefight', label: 'Firefight' },
];

/** Fast ad-hoc log for unplanned activity: title + category + duration + mood,
 * no intention or schedule block required. */
export function QuickLogModal({ open, onClose, categories, onSave }: Props) {
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [duration, setDuration] = useState('30');
  const [notes, setNotes] = useState('');
  const [mood, setMood] = useState<TimeLogMood | ''>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setCategoryId(categories[0]?.id ?? '');
    setDuration('30');
    setNotes('');
    setMood('');
  }, [open, categories]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({ customTitle: title, categoryId: categoryId || null, durationMins: Number(duration), notes, mood: mood || null });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Spontaneous Quick Log" subtitle="Life happens — record reality without needing a plan.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="What happened?"><Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Coffee with a friend" required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Uncategorized</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </Select>
          </Field>
          <Field label="Duration">
            <Select value={duration} onChange={(e) => setDuration(e.target.value)}>
              {presets.map((mins) => <option key={mins} value={mins}>{mins} min</option>)}
              <option value="120">120 min</option>
            </Select>
          </Field>
        </div>
        <Field label="Reflection">
          <Select value={mood} onChange={(e) => setMood(e.target.value as TimeLogMood | '')}>
            <option value="">None</option>
            {moods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
        </Field>
        <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional context" /></Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Save to Reality'}</Button>
        </div>
      </form>
    </Modal>
  );
}
