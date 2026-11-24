import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Eraser, ShieldAlert, Trash2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { clearVaultData } from '@/db/queries';
import { useVaultHealth } from '@/hooks/useVault';

interface ClearVaultCardProps {
  onNotify: (message: string, kind?: 'success' | 'error') => void;
}

/** Factory-reset card: wipes all tables in one Rust transaction, then the app
 * re-seeds default categories/settings on next load. Two-step confirm modal. */
export function ClearVaultCard({ onNotify }: ClearVaultCardProps) {
  const queryClient = useQueryClient();
  const healthQuery = useVaultHealth();
  const counts = healthQuery.data?.counts;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const totalRecords =
    (counts?.blocks ?? 0) +
    (counts?.logs ?? 0) +
    (counts?.tasks ?? 0) +
    (counts?.categories ?? 0) +
    (counts?.settings ?? 0);

  const runClear = async () => {
    setClearing(true);
    try {
      await clearVaultData();
      await queryClient.invalidateQueries();
      setConfirmOpen(false);
      onNotify('All vault data cleared — default categories and settings will re-seed on next load');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Clear failed — database left unchanged', 'error');
    } finally {
      setClearing(false);
    }
  };

  return (
    <section className="card flex flex-col justify-between gap-5 border-danger/20 p-5">
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-danger-soft text-danger">
              <Eraser size={19} />
            </div>
            <div>
              <h2 className="text-base font-bold text-text">Clear All Data</h2>
              <span className="text-xs text-text-muted">Permanently wipe every record from the local database</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger-soft px-2 py-0.5 text-[11px] font-bold text-danger">
            <ShieldAlert size={12} /> Irreversible
          </span>
        </div>

        <div className="flex flex-col gap-3 rounded-lg bg-surface-low p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Trash2 size={17} className="text-danger" />
              <span className="text-sm font-semibold text-text">Factory Reset</span>
            </div>
            <span className="rounded bg-danger-soft px-1.5 py-0.5 text-[11px] font-bold text-danger">
              {totalRecords} record{totalRecords === 1 ? '' : 's'}
            </span>
          </div>
          <p className="text-xs text-text-muted">
            Deletes all categories, intentions, planned blocks, time logs, and app settings in a single atomic transaction. Default categories and settings will re-seed automatically on the next load. This cannot be undone.
          </p>
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] font-medium text-text-subtle">
              {healthQuery.isLoading ? 'Counting records…' : `${counts?.blocks ?? 0} blocks · ${counts?.logs ?? 0} logs · ${counts?.tasks ?? 0} intentions · ${counts?.categories ?? 0} categories · ${counts?.settings ?? 0} settings`}
            </span>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={clearing || healthQuery.isLoading || totalRecords === 0}
            >
              <Trash2 size={14} /> {clearing ? 'Clearing…' : 'Clear All Data'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-3 text-xs text-text-muted">
        <AlertTriangle size={14} className="text-danger" />
        <span>Consider exporting a JSON backup before clearing — there is no undo.</span>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => !clearing && setConfirmOpen(false)}
        title="Clear all vault data?"
        subtitle="This action permanently deletes every record in the local database."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={clearing}>
              Cancel
            </Button>
            <Button variant="danger" onClick={runClear} disabled={clearing}>
              {clearing ? 'Clearing…' : 'Delete everything'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              This will permanently delete all {totalRecords} records — including every intention, planned block, time log, category, and app setting. This cannot be undone.
            </span>
          </div>
          <p className="text-sm text-text-muted">
            Default categories and app settings will automatically re-seed on the next load, but all user-created data is gone forever. The operation runs inside a single SQLite transaction — any failure rolls everything back.
          </p>
          {counts && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-surface-low p-2"><span className="block font-bold text-text">{counts.categories}</span><span className="text-text-muted">categories</span></div>
              <div className="rounded-lg bg-surface-low p-2"><span className="block font-bold text-text">{counts.tasks}</span><span className="text-text-muted">intentions</span></div>
              <div className="rounded-lg bg-surface-low p-2"><span className="block font-bold text-text">{counts.blocks}</span><span className="text-text-muted">planned blocks</span></div>
              <div className="rounded-lg bg-surface-low p-2"><span className="block font-bold text-text">{counts.logs}</span><span className="text-text-muted">time logs</span></div>
            </div>
          )}
        </div>
      </Modal>
    </section>
  );
}
