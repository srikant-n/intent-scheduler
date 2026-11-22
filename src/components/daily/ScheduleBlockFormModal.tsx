import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Field, Input, Select, Textarea } from '@/components/common/Field';
import type { Category, Intention, ScheduleBlock } from '@/types/database';
import { minutesToTime, timeToMinutes } from '@/utils/time';

export interface ScheduleBlockFormValues {
  taskId: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  plannedDurationMins: number;
  notes: string;
  status: ScheduleBlock['status'];
}

interface Props {
  open: boolean;
  onClose: () => void;
  date: string;
  block?: ScheduleBlock | null;
  tasks: Intention[];
  categories: Category[];
  defaultStartTime?: string;
  defaultTaskId?: string;
  onSave: (values: ScheduleBlockFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
  onStartTimer?: () => Promise<void>;
  onLogActual?: (durationMins: number) => Promise<void>;
}

export function ScheduleBlockFormModal({ open, onClose, date, block, tasks, categories, defaultStartTime, defaultTaskId, onSave, onDelete, onStartTimer, onLogActual }: Props) {
  const [taskId, setTaskId] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [duration, setDuration] = useState('60');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ScheduleBlock['status']>('planned');
  const [saving, setSaving] = useState(false);

  const task = useMemo(() => tasks.find((item) => item.id === taskId), [tasks, taskId]);
  const category = useMemo(() => categories.find((item) => item.id === task?.categoryId), [categories, task]);

  useEffect(() => {
    if (!open) return;
    const start = block?.startTime ?? defaultStartTime ?? '09:00';
    const end = block?.endTime ?? minutesToTime(timeToMinutes(start) + (block?.plannedDurationMins ?? task?.defaultDurationMins ?? 60));
    setTaskId(block?.taskId ?? defaultTaskId ?? tasks[0]?.id ?? '');
    setStartTime(start);
    setEndTime(end);
    setDuration(String(block?.plannedDurationMins ?? (start && end ? Math.max(1, timeToMinutes(end) - timeToMinutes(start)) : task?.defaultDurationMins ?? 60)));
    setNotes(block?.notes ?? '');
    setStatus(block?.status ?? 'planned');
  }, [open, block, tasks, defaultStartTime, defaultTaskId, task?.defaultDurationMins]);

  const updateEndFromDuration = (value: string) => {
    setDuration(value);
    const mins = Number(value);
    if (Number.isFinite(mins) && mins > 0) setEndTime(minutesToTime(timeToMinutes(startTime) + mins));
  };

  const updateDurationFromEnd = (value: string) => {
    setEndTime(value);
    const mins = timeToMinutes(value) - timeToMinutes(startTime);
    if (mins > 0) setDuration(String(mins));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({
        taskId,
        scheduledDate: date,
        startTime,
        endTime,
        plannedDurationMins: Number(duration),
        notes,
        status,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={block ? 'Edit Planned Block' : 'Plan Time'} subtitle={date} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Intention">
            <Select value={taskId} onChange={(e) => setTaskId(e.target.value)} required>
              {tasks.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as ScheduleBlock['status'])}>
              <option value="planned">Planned</option>
              <option value="completed">Completed</option>
              <option value="missed">Missed</option>
              <option value="dismissed">Dismissed</option>
              <option value="rolled">Rolled over</option>
            </Select>
          </Field>
        </div>
        {category && <div className="text-xs text-text-muted">Category color: <span className="font-semibold" style={{ color: category.colorHex }}>{category.name}</span></div>}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Start"><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required /></Field>
          <Field label="End"><Input type="time" value={endTime} onChange={(e) => updateDurationFromEnd(e.target.value)} required /></Field>
          <Field label="Duration"><Input type="number" min="1" step="1" inputMode="numeric" value={duration} onChange={(e) => updateEndFromDuration(e.target.value)} required /></Field>
        </div>
        <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional plan context" /></Field>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex gap-2">
            {onDelete && <Button type="button" variant="danger" onClick={onDelete}>Delete</Button>}
            {block && onStartTimer && <Button type="button" variant="secondary" onClick={onStartTimer}>Start Timer</Button>}
            {block && onLogActual && <Button type="button" variant="secondary" onClick={() => onLogActual(Number(duration))}>Log Actual</Button>}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Save Block'}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
