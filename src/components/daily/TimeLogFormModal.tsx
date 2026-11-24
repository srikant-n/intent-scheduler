import { FormEvent, useEffect, useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Field, Input, Select } from '@/components/common/Field';
import type { Category, Intention, TimeLog, TimeLogMood } from '@/types/database';

export interface TimeLogFormValues {
  taskId: string | null;
  customTitle: string;
  categoryId: string | null;
  logDate: string;
  startTime: string;
  endTime: string;
  durationMins: number;
  notes: string;
  mood: TimeLogMood | '';
}

interface Props {
  open: boolean;
  onClose: () => void;
  date: string;
  log?: TimeLog | null;
  tasks: Intention[];
  categories: Category[];
  defaultStartTime?: string;
  onSave: (values: TimeLogFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
}

const moods: { value: TimeLogMood; label: string }[] = [
  { value: 'restorative', label: 'Restorative' },
  { value: 'energizing', label: 'Energizing' },
  { value: 'distraction', label: 'Distraction' },
  { value: 'firefight', label: 'Firefight' },
];

export function TimeLogFormModal({ open, onClose, date, log, tasks, categories, defaultStartTime, onSave, onDelete }: Props) {
  const [taskId, setTaskId] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [logDate, setLogDate] = useState(date);
  const [startTime, setStartTime] = useState(defaultStartTime ?? '');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState('30');
  const [notes, setNotes] = useState('');
  const [mood, setMood] = useState<TimeLogMood | ''>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTaskId(log?.taskId ?? '');
    setCustomTitle(log?.customTitle ?? '');
    setCategoryId(log?.categoryId ?? '');
    setLogDate(log?.logDate ?? date);
    setStartTime(log?.startTime ?? defaultStartTime ?? '');
    setEndTime(log?.endTime ?? '');
    setDuration(String(log?.durationMins ?? 30));
    setNotes(log?.notes ?? '');
    setMood(log?.mood ?? '');
  }, [open, log, date, defaultStartTime]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({
        taskId: taskId || null,
        customTitle,
        categoryId: categoryId || null,
        logDate,
        startTime,
        endTime,
        durationMins: Number(duration),
        notes,
        mood,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={log ? 'Edit Reality Log' : 'Log Reality'} subtitle="Record what actually happened." wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Link intention (optional)">
            <Select
              value={taskId}
              onChange={(e) => {
                const nextTaskId = e.target.value;
                setTaskId(nextTaskId);
                const task = tasks.find((item) => item.id === nextTaskId);
                if (task) setCategoryId(task.categoryId ?? '');
              }}
            >
              <option value="">Ad-hoc / custom</option>
              {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
            </Select>
          </Field>
          <Field label="Category">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Uncategorized</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Title">
          <Input value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder="What did you actually do?" />
        </Field>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Date"><Input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} required /></Field>
          <Field label="Start"><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></Field>
          <Field label="End"><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></Field>
          <Field label="Duration (min)"><Input type="number" min="1" step="1" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} required /></Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Mood / reflection">
            <Select value={mood} onChange={(e) => setMood(e.target.value as TimeLogMood | '')}>
              <option value="">None</option>
              {moods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
          </Field>
          <Field label="Notes"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional context" /></Field>
        </div>
        <div className="flex flex-wrap justify-between gap-2 pt-2">
          <div>{onDelete && <Button type="button" variant="danger" onClick={onDelete}>Delete</Button>}</div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Save Log'}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
