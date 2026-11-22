import { FormEvent, useEffect, useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Field, Input } from '@/components/common/Field';
import type { Category } from '@/types/database';

const palette = ['#ea580c', '#4f46e5', '#059669', '#d97706', '#8b5cf6', '#e11d48', '#0891b2', '#65a30d'];

interface Props {
  open: boolean;
  onClose: () => void;
  category?: Category | null;
  onSave: (values: { name: string; colorHex: string }) => Promise<void>;
}

export function CategoryFormModal({ open, onClose, category, onSave }: Props) {
  const [name, setName] = useState('');
  const [colorHex, setColorHex] = useState(palette[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? '');
    setColorHex(category?.colorHex ?? palette[0]);
  }, [open, category]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({ name, colorHex });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={category ? 'Edit Category' : 'New Category'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></Field>
        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {palette.map((color) => (
              <button key={color} type="button" onClick={() => setColorHex(color)} className={`h-8 w-8 rounded-full border-2 ${colorHex === color ? 'border-text' : 'border-transparent'}`} style={{ backgroundColor: color }} />
            ))}
          </div>
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Save Category'}</Button>
        </div>
      </form>
    </Modal>
  );
}
