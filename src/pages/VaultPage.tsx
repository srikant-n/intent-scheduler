import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, Lock, ShieldCheck } from 'lucide-react';
import { VaultHealthCard } from '@/components/vault/VaultHealthCard';
import { ExportVaultCard } from '@/components/vault/ExportVaultCard';
import { RestoreVaultCard } from '@/components/vault/RestoreVaultCard';
import { useVaultHealth } from '@/hooks/useVault';
import clsx from 'clsx';

interface ToastState {
  message: string;
  kind: 'success' | 'error';
}

export function VaultPage() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const healthQuery = useVaultHealth();
  const journalMode = healthQuery.data?.pragmas.journal_mode;

  const notify = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    setToast({ message, kind });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div className="space-y-5">
      <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="flex max-w-2xl flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-text-muted">
            <Lock size={13} className="text-success" />
            <span>Sovereign Storage Architecture</span>
            <span className="text-text-subtle">•</span>
            <span className="font-bold text-success">100% Offline</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Data Vault &amp; Storage Health</h1>
          <p className="text-sm text-text-muted">
            All your schedules, intent blocks, and reality logs live locally on your device in pure SQLite format. No external databases, no background telemetry, zero lock-in.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 self-start lg:self-end">
          <div className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="text-xs font-semibold text-text">SQLite Engine Active</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-surface-high px-3 py-1.5 text-xs font-semibold text-text-muted">
            <Database size={14} className="text-accent" />
            <span>{journalMode ? `${journalMode.toUpperCase()} Mode` : 'WAL Mode'} Enabled</span>
          </div>
        </div>
      </section>

      <VaultHealthCard onNotify={notify} />

      <section className="grid gap-5 lg:grid-cols-2">
        <ExportVaultCard onNotify={notify} />
        <RestoreVaultCard onNotify={notify} />
      </section>

      <section className="flex flex-col items-center justify-between gap-4 rounded-xl border border-border bg-surface-low p-5 lg:flex-row">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface shadow-sm">
            <ShieldCheck size={24} className="text-accent" />
          </div>
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-text">Zero Telemetry • Native Tauri Sandbox</h3>
              <span className="rounded-full border border-success/30 bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success">Air-gapped</span>
            </div>
            <p className="mt-0.5 max-w-3xl text-xs text-text-muted">
              Intent Scheduler runs entirely on your local machine using a compiled Rust backend and Tauri WebView2. No analytic pings, no telemetry tokens, and zero network sockets opened during runtime.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-[11px] text-text-muted">
          <span className="font-semibold text-text">Local-first by design</span>
        </div>
      </section>

      <div
        className={clsx(
          'fixed bottom-6 right-8 z-50 flex translate-y-20 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold opacity-0 shadow-xl transition-all duration-300',
          toast && 'translate-y-0 opacity-100',
          toast?.kind === 'error' ? 'bg-danger text-white' : 'bg-text text-canvas',
        )}
      >
        {toast?.kind === 'error' ? <AlertTriangle size={16} className="shrink-0" /> : <CheckCircle2 size={16} className="shrink-0 text-success" />}
        <span className="max-w-md">{toast?.message}</span>
      </div>
    </div>
  );
}

