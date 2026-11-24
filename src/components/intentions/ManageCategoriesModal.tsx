import { FormEvent, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Field';
import { useCategories } from '@/hooks/useCategories';
import type { Category } from '@/types/database';

const palette = ['#ea580c', '#4f46e5', '#059669', '#d97706', '#8b5cf6', '#e11d48', '#0891b2', '#65a30d'];

interface Props {
  open: boolean;
  onClose: () => void;
}

function normalizeHex(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : palette[0];
}

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const isCustom = Boolean(value) && !palette.includes(normalizeHex(value).toLowerCase());
  return (
    <div className="flex flex-wrap items-center gap-2">
      {palette.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={clsx('h-7 w-7 rounded-full border-2 transition', value.toLowerCase() === color ? 'border-text' : 'border-transparent')}
          style={{ backgroundColor: color }}
        />
      ))}
      <label
        title="Custom color"
        className={clsx(
          'relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 transition',
          isCustom ? 'border-text' : 'border-dashed border-text-subtle hover:border-text-muted',
        )}
        style={isCustom ? { backgroundColor: value } : { background: 'conic-gradient(#ea580c, #e11d48, #8b5cf6, #0891b2, #65a30d, #d97706, #ea580c)' }}
      >
        <input
          type="color"
          value={normalizeHex(value)}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        {!isCustom && <span className="text-[11px] font-bold text-white drop-shadow">+</span>}
      </label>
    </div>
  );
}

export function ManageCategoriesModal({ open, onClose }: Props) {
  const { categories, create, update, remove } = useCategories();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(palette[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(palette[0]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const addCategory = async (event: FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      await create.mutateAsync({ name, colorHex: newColor });
      setNewName('');
      setNewColor(palette[0]);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditColor(category.colorHex);
    setConfirmDeleteId(null);
  };

  const saveEdit = async (id: string) => {
    const name = editName.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      await update.mutateAsync({ id, name, colorHex: editColor });
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    await remove.mutateAsync(id);
    setConfirmDeleteId(null);
    if (editingId === id) setEditingId(null);
  };

  return (
    <Modal open={open} onClose={onClose} title="Manage Categories" subtitle="Add, rename, recolor, or remove taxonomy categories. Intentions and logs in a removed category become uncategorized.">
      <div className="space-y-4">
        <form onSubmit={addCategory} className="rounded-xl border border-border bg-surface-low p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-subtle">New category name</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Finance" required />
            </div>
            <Button type="submit" variant="primary" size="sm" disabled={saving || !newName.trim()}>
              <Plus size={14} /> Add
            </Button>
          </div>
          <div className="mt-3">
            <ColorPicker value={newColor} onChange={setNewColor} />
          </div>
        </form>

        <div className="space-y-2">
          {categories.length === 0 && <p className="py-4 text-center text-sm text-text-muted">No categories yet — add one above.</p>}
          {categories.map((category) => {
            const isEditing = editingId === category.id;
            const isConfirming = confirmDeleteId === category.id;
            return (
              <div key={category.id} className="rounded-xl border border-border bg-surface px-3 py-2.5">
                {isEditing ? (
                  <div className="space-y-3">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                    <ColorPicker value={editColor} onChange={setEditColor} />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                        <X size={13} /> Cancel
                      </Button>
                      <Button type="button" variant="primary" size="sm" disabled={saving || !editName.trim()} onClick={() => saveEdit(category.id)}>
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: category.colorHex }} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{category.name}</span>
                    <span className="font-mono text-[10px] text-text-subtle">{category.colorHex}</span>
                    <button
                      type="button"
                      title="Edit category"
                      onClick={() => startEdit(category)}
                      className="rounded-lg p-1.5 text-text-subtle transition hover:bg-surface-high hover:text-text"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      title={isConfirming ? 'Click again to confirm delete' : 'Delete category'}
                      onClick={() => deleteCategory(category.id)}
                      className={clsx(
                        'rounded-lg p-1.5 transition',
                        isConfirming ? 'bg-danger-soft text-danger' : 'text-text-subtle hover:bg-surface-high hover:text-danger',
                      )}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
                {isConfirming && !isEditing && (
                  <p className="mt-1.5 text-[11px] font-semibold text-danger">Click the trash icon again to confirm — intentions and logs become uncategorized.</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
