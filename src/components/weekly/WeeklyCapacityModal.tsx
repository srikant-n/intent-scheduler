import { useEffect, useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Field, Input } from '@/components/common/Field';
import { WEEKDAY_LABELS, type WeeklyCapacity } from '@/utils/capacity';

interface Props {
  open: boolean;
  onClose: () => void;
  capacity: WeeklyCapacity;
  onSave: (capacity: WeeklyCapacity) => Promise<void>;
}

/** Edit per-weekday planned-minute capacity (stored as JSON in app_settings). */
export function WeeklyCapacityModal({ open, onClose, capacity, onSave }: Props) {
  const [values, setValues] = useState<WeeklyCapacity>({ ...capacity });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValues({ ...capacity });
  }, [open, capacity]);

  const submit = async () => {
    setSaving(true);
    try {
      // Clamp each day to a non-negative integer before persisting.
      const cleaned: WeeklyCapacity = {};
      for (let day = 1; day <= 7; day += 1) {
        cleaned[day] = Math.max(0, Math.round(Number(values[day]) || 0));
      }
      await onSave(cleaned);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Weekly Capacity" subtitle="Editable workload targets per weekday, in minutes. Planning stays bounded by your day hours." wide>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7].map((day) => (
          <Field key={day} label={WEEKDAY_LABELS[day]}>
            <Input
              type="number"
              min="0"
              step="15"
              inputMode="numeric"
              value={values[day] ?? 0}
              onChange={(e) => setValues((prev) => ({ ...prev, [day]: Number(e.target.value) }))}
            />
          </Field>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Save Capacity'}</Button>
      </div>
    </Modal>
  );
}
