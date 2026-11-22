import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { CheckCircle2, Copy, Database, FolderOpen, ShieldCheck, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { useVaultHealth } from '@/hooks/useVault';
import { vacuumDatabase } from '@/db/queries';
import { formatBytes } from '@/utils/vault';

const PRAGMA_LABELS: Record<string, string> = {
  journal_mode: 'journal_mode',
  synchronous: 'synchronous',
  cache_size: 'cache_size',
  foreign_keys: 'foreign_keys',
  auto_vacuum: 'auto_vacuum',
  page_size: 'page_size',
};

interface VaultHealthCardProps {
  onNotify: (message: string, kind?: 'success' | 'error') => void;
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Unknown';
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function VaultHealthCard({ onNotify }: VaultHealthCardProps) {
  const queryClient = useQueryClient();
  const healthQuery = useVaultHealth();
  const health = healthQuery.data;
  const [vacuuming, setVacuuming] = useState(false);
  const [pragmaOpen, setPragmaOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const integrityOk = health?.integrity === 'ok';
  const lastSync = [health?.lastExportAt, health?.lastImportAt]
    .filter((value): value is string => Boolean(value))
    .sort()
    .pop() ?? null;

  const runVacuum = async () => {
    setVacuuming(true);
    try {
      await vacuumDatabase();
      await queryClient.invalidateQueries({ queryKey: ['vault'] });
      onNotify('VACUUM complete: database compacted and optimized');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'VACUUM failed', 'error');
    } finally {
      setVacuuming(false);
    }
  };

  const revealExplorer = async () => {
    try {
      await invoke('reveal_path_in_explorer', { path: health?.fileInfo?.path ?? '' });
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Could not open file explorer', 'error');
    }
  };

  const copyPath = async () => {
    if (!health?.fileInfo?.path) return;
    try {
      await navigator.clipboard.writeText(health.fileInfo.path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      onNotify('Could not copy path to clipboard', 'error');
    }
  };

  const counts = health?.counts;
  const metrics = [
    { label: 'Intent Blocks', value: counts?.blocks ?? 0, dot: 'bg-accent', hint: 'Planned sprints' },
    { label: 'Actual Logs', value: counts?.logs ?? 0, dot: 'bg-success', hint: 'Timed sessions' },
    { label: 'Intentions', value: counts?.tasks ?? 0, dot: 'bg-warning', hint: 'All tasks' },
    { label: 'Categories', value: counts?.categories ?? 0, dot: 'bg-text-subtle', hint: 'Taxonomy nodes' },
  ];

  return (
    <section className="card p-5">
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="flex flex-col justify-between gap-5 lg:col-span-7">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-high text-accent">
                  <Database size={22} />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Primary Relational Storage</div>
                  <div className="text-lg font-bold text-text">tracker.db</div>
                </div>
              </div>
              <span
                className={clsx(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold',
                  integrityOk ? 'border-success/30 bg-success-soft text-success' : 'border-warning/40 bg-warning-soft text-warning',
                )}
              >
                <ShieldCheck size={13} />
                {healthQuery.isLoading ? 'Checking…' : integrityOk ? 'Integrity Valid' : 'Check Failed'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-low p-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <FolderOpen size={15} className="shrink-0 text-text-subtle" />
                <span className="truncate font-mono text-xs text-text">{health?.fileInfo?.path ?? 'Resolving database path…'}</span>
              </div>
              <Button variant="secondary" size="sm" onClick={copyPath} disabled={!health?.fileInfo?.path}>
                {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className={integrityOk ? 'text-success' : 'text-warning'} />
                <span className="font-medium text-text">PRAGMA integrity_check:</span>
                <span className={clsx('font-mono font-bold', integrityOk ? 'text-success' : 'text-warning')}>
                  {healthQuery.isLoading ? '…' : integrityOk ? 'ok (0 anomalies)' : health?.integrity ?? 'unknown'}
                </span>
              </div>
              <div className="flex items-center gap-1 text-text-muted">
                <Sparkles size={14} />
                <span>Last backup: {relativeTime(lastSync)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button variant="secondary" size="sm" onClick={revealExplorer} disabled={!health?.fileInfo?.path}>
              <FolderOpen size={15} /> Open in File Explorer
            </Button>
            <Button variant="secondary" size="sm" onClick={runVacuum} disabled={vacuuming || healthQuery.isLoading}>
              <Sparkles size={15} className={vacuuming ? 'animate-spin' : ''} />
              {vacuuming ? 'Optimizing…' : 'Vacuum & Defrag'}
            </Button>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-4 lg:col-span-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Allocated Disk Footprint</div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight text-accent">{health?.fileInfo ? formatBytes(health.fileInfo.size_bytes) : '—'}</span>
              </div>
            </div>
            <div className="relative flex h-14 w-14 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-surface-high"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                />
                <path
                  className="text-accent"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray="32, 100"
                  strokeLinecap="round"
                  strokeWidth="3.5"
                />
              </svg>
              <span className="absolute text-[11px] font-bold text-text">local</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-lg bg-surface p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-text">{metric.label}</span>
                  <span className={clsx('h-2 w-2 rounded-full', metric.dot)} />
                </div>
                <div className="pt-1 text-xl font-semibold text-text">{metric.value}</div>
                <span className="text-[11px] font-medium text-text-muted">{metric.hint}</span>
              </div>
            ))}
          </div>

          <Button variant="secondary" size="sm" className="self-start" onClick={() => setPragmaOpen(true)}>
            View PRAGMA Specs
          </Button>
        </div>
      </div>

      <Modal open={pragmaOpen} onClose={() => setPragmaOpen(false)} title="SQLite PRAGMA Configuration" subtitle="Live values read from the running database connection.">
        <div className="space-y-2">
          {Object.entries(PRAGMA_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between rounded-lg bg-surface-low px-3 py-2 text-sm">
              <span className="font-mono text-text-muted">{label}</span>
              <span className="font-mono font-bold text-text">{health?.pragmas[key] || '—'}</span>
            </div>
          ))}
        </div>
      </Modal>
    </section>
  );
}
