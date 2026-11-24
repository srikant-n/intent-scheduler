import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FileUp, ShieldCheck, UploadCloud } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { importVaultPayload, recordVaultEvent, type VaultImportMode } from '@/db/queries';
import { parseVaultJson, vaultCounts, type VaultPayload } from '@/utils/vault';

interface VaultFile {
  name: string;
  payload: VaultPayload;
  issues: string[];
}

interface RestoreVaultCardProps {
  onNotify: (message: string, kind?: 'success' | 'error') => void;
}

// The two import strategies offered to the user.
const MODES: { key: VaultImportMode; label: string; badge: string; badgeClass: string; description: string; confirmText: string }[] = [
  {
    key: 'merge',
    label: 'Merge Import',
    badge: 'Safe',
    badgeClass: 'border-success/30 bg-success-soft text-success',
    description: 'Appends new records and skips duplicate UUIDs without loss.',
    confirmText: 'Merge the vault into the current database? Existing records are preserved; duplicates are skipped.',
  },
  {
    key: 'replace',
    label: 'Replace All',
    badge: 'Atomic',
    badgeClass: 'border-accent/30 bg-accent-soft text-accent',
    description: 'Wipes all existing data, then restores the vault in one transaction.',
    confirmText:
      'Replace ALL current data with this vault? Every existing record will be permanently deleted before the import runs. This cannot be undone.',
  },
];

/** JSON vault restore: drag-and-drop file picker → client-side validation →
 * Merge (INSERT OR IGNORE) or Replace (wipe + insert) via a Rust transaction. */
export function RestoreVaultCard({ onNotify }: RestoreVaultCardProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<VaultFile | null>(null);
  const [mode, setMode] = useState<VaultImportMode>('replace');
  const [dragging, setDragging] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  // Parse + validate the picked file immediately so issues show before the user
  // even chooses an import mode. `payload` may be partial when issues exist —
  // the import button stays disabled until validation is clean.
  const loadFile = async (selected: File) => {
    if (!selected.name.toLowerCase().endsWith('.json')) {
      onNotify('Only .json vault files are supported', 'error');
      return;
    }
    try {
      const text = await selected.text();
      const { payload, issues } = parseVaultJson(text);
      setFile({ name: selected.name, payload, issues });
      if (issues.length === 0) {
        onNotify(`Loaded ${selected.name} — validation passed`, 'success');
      }
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Could not read file', 'error');
    }
  };

  const counts = file && file.issues.length === 0 ? vaultCounts(file.payload.data) : null;
  const activeMode = MODES.find((item) => item.key === mode) ?? MODES[1];

  const runImport = async () => {
    if (!file || file.issues.length > 0) return;
    setImporting(true);
    try {
      const stats = await importVaultPayload(file.payload, mode);
      await recordVaultEvent('import');
      await queryClient.invalidateQueries();
      const written = stats.tables.reduce((sum, table) => sum + table.written, 0);
      const attempted = stats.tables.reduce((sum, table) => sum + table.attempted, 0);
      const skipped = attempted - written;
      onNotify(
        mode === 'merge'
          ? `Vault merged: ${written} records added${skipped > 0 ? `, ${skipped} duplicates skipped` : ''}`
          : `Vault restored: ${written} records imported (replace)`,
      );
      setFile(null);
      setConfirmOpen(false);
      if (inputRef.current) inputRef.current.value = '';
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Import failed — database left unchanged', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="card flex flex-col justify-between gap-5 p-5">
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success-soft text-success">
              <UploadCloud size={19} />
            </div>
            <div>
              <h2 className="text-base font-bold text-text">Import &amp; Vault Restoration</h2>
              <span className="text-xs text-text-muted">Restore a previously exported JSON vault</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success">
            <ShieldCheck size={12} /> Schema Pre-checked
          </span>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const dropped = event.dataTransfer.files?.[0];
            if (dropped) void loadFile(dropped);
          }}
          className={clsx(
            'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-6 text-center transition',
            dragging ? 'border-accent bg-accent-soft' : 'border-border-strong bg-surface-low hover:border-accent/60 hover:bg-surface',
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) void loadFile(selected);
            }}
          />
          <div className={clsx('flex h-11 w-11 items-center justify-center rounded-full transition', dragging ? 'bg-accent-soft text-accent' : 'bg-surface-high text-accent')}>
            <FileUp size={22} />
          </div>
          <span className="text-sm font-semibold text-text">
            {file ? file.name : 'Drop intents_backup.json here'}
          </span>
          <span className="text-xs text-text-muted">{file ? (file.issues.length === 0 ? 'Validation passed — ready to restore' : `${file.issues.length} validation issue${file.issues.length === 1 ? '' : 's'} found`) : 'or click to browse files'}</span>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-text-subtle">
            <span className="rounded bg-surface-high px-1.5 py-0.5 font-mono">.json only</span>
            <span>•</span>
            <span>Validated before any write</span>
          </div>
        </div>

        {file && file.issues.length > 0 && (
          <div className="rounded-lg border border-danger/30 bg-danger-soft p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-danger">
              <AlertTriangle size={14} /> File failed validation — import is blocked
            </div>
            <ul className="max-h-32 space-y-0.5 overflow-y-auto font-mono text-[11px] text-danger">
              {file.issues.slice(0, 8).map((issue, index) => (
                <li key={index}>• {issue}</li>
              ))}
              {file.issues.length > 8 && <li>• …and {file.issues.length - 8} more</li>}
            </ul>
          </div>
        )}

        {file && file.issues.length === 0 && counts && (
          <div className="flex flex-wrap gap-1.5 text-[11px] font-medium text-text-muted">
            <span className="rounded-full bg-surface-high px-2 py-0.5">{counts.categories} categories</span>
            <span className="rounded-full bg-surface-high px-2 py-0.5">{counts.tasks} intentions</span>
            <span className="rounded-full bg-surface-high px-2 py-0.5">{counts.scheduleBlocks} planned blocks</span>
            <span className="rounded-full bg-surface-high px-2 py-0.5">{counts.timeLogs} time logs</span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Restore Collision Strategy</span>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {MODES.map((item) => (
              <label
                key={item.key}
                className={clsx(
                  'flex cursor-pointer flex-col gap-1 rounded-lg border p-2.5 transition',
                  mode === item.key ? 'border-accent/50 bg-accent-soft' : 'border-transparent bg-surface-low hover:bg-surface',
                )}
              >
                <input type="radio" name="restore-mode" className="sr-only" checked={mode === item.key} onChange={() => setMode(item.key)} />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-text">{item.label}</span>
                  <span className={clsx('rounded border px-1.5 py-0.5 text-[10px] font-bold', item.badgeClass)}>{item.badge}</span>
                </div>
                <span className="text-xs text-text-muted">{item.description}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
          <CheckCircle2 size={13} className="text-success" />
          <span>Pre-execution dry-run enabled</span>
        </div>
        <Button
          variant="primary"
          size="sm"
          disabled={!file || file.issues.length > 0 || importing}
          onClick={() => setConfirmOpen(true)}
        >
          {importing ? 'Restoring…' : 'Verify & Restore Vault'}
        </Button>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => !importing && setConfirmOpen(false)}
        title={mode === 'replace' ? 'Replace all data?' : 'Merge vault data?'}
        subtitle={file?.name}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={importing}>
              Cancel
            </Button>
            <Button variant={mode === 'replace' ? 'danger' : 'primary'} onClick={runImport} disabled={importing}>
              {importing ? 'Restoring…' : mode === 'replace' ? 'Delete everything & restore' : 'Merge import'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          {mode === 'replace' ? (
            <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{activeMode.confirmText}</span>
            </div>
          ) : (
            <p className="text-sm text-text-muted">{activeMode.confirmText}</p>
          )}
          {counts && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-surface-low p-2"><span className="block font-bold text-text">{counts.categories}</span><span className="text-text-muted">categories</span></div>
              <div className="rounded-lg bg-surface-low p-2"><span className="block font-bold text-text">{counts.tasks}</span><span className="text-text-muted">intentions</span></div>
              <div className="rounded-lg bg-surface-low p-2"><span className="block font-bold text-text">{counts.scheduleBlocks}</span><span className="text-text-muted">planned blocks</span></div>
              <div className="rounded-lg bg-surface-low p-2"><span className="block font-bold text-text">{counts.timeLogs}</span><span className="text-text-muted">time logs</span></div>
            </div>
          )}
          <p className="text-xs text-text-subtle">The import runs inside a single SQLite transaction — any failure rolls everything back.</p>
        </div>
      </Modal>
    </section>
  );
}
