import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, FileJson, Sheet } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@/components/common/Button';
import { useAllIntentions } from '@/hooks/useIntentions';
import { useCategories } from '@/hooks/useCategories';
import { useTimeLogsRange } from '@/hooks/useLogs';
import { useVaultExportPreview } from '@/hooks/useVault';
import { exportVaultPayload, recordVaultEvent } from '@/db/queries';
import { enrichLogs } from '@/utils/enrich';
import { toCsv } from '@/utils/csv';
import { saveTextFile } from '@/utils/fileExport';
import { addDaysISO, todayISO } from '@/utils/time';
import { formatBytes, vaultLogToCsvRow } from '@/utils/vault';

const CSV_RANGES = [
  { key: 'all', label: 'All Time' },
  { key: 'month', label: 'This Month' },
  { key: '30d', label: 'Last 30 Days' },
] as const;

type CsvRange = (typeof CSV_RANGES)[number]['key'];

function csvRangeBounds(range: CsvRange): { start: string; end: string } {
  const today = todayISO();
  if (range === 'month') return { start: `${today.slice(0, 7)}-01`, end: today };
  if (range === '30d') return { start: addDaysISO(today, -29), end: today };
  return { start: '1970-01-01', end: '2999-12-31' };
}

interface ExportVaultCardProps {
  onNotify: (message: string, kind?: 'success' | 'error') => void;
}

export function ExportVaultCard({ onNotify }: ExportVaultCardProps) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<'json' | 'csv' | null>(null);
  const [csvRange, setCsvRange] = useState<CsvRange>('all');

  const previewQuery = useVaultExportPreview();
  const estimatedJsonBytes = useMemo(() => {
    if (!previewQuery.data) return null;
    return new TextEncoder().encode(JSON.stringify(previewQuery.data, null, 2)).length;
  }, [previewQuery.data]);

  const { start, end } = csvRangeBounds(csvRange);
  const logsQuery = useTimeLogsRange(start, end);
  const { intentions } = useAllIntentions();
  const { categories } = useCategories();
  const enrichedLogs = useMemo(
    () => enrichLogs(logsQuery.logs, intentions, categories),
    [logsQuery.logs, intentions, categories],
  );

  const exportJson = async () => {
    setBusy('json');
    try {
      const payload = await exportVaultPayload();
      const json = JSON.stringify(payload, null, 2);
      const saved = await saveTextFile(`intents_vault_${todayISO()}.json`, json, {
        title: 'Export JSON Vault',
        extensions: ['json'],
        filterName: 'JSON Vault',
      });
      if (saved) {
        await recordVaultEvent('export');
        await queryClient.invalidateQueries({ queryKey: ['vault'] });
        onNotify(`Downloaded intents_vault_${todayISO()}.json (${formatBytes(json.length)})`);
      }
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'JSON export failed', 'error');
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = async () => {
    setBusy('csv');
    try {
      const csv = toCsv(enrichedLogs.map(vaultLogToCsvRow));
      if (!csv) {
        onNotify('No time logs in the selected range', 'error');
        return;
      }
      const saved = await saveTextFile(`intent-scheduler-timelogs-${todayISO()}.csv`, csv, {
        title: 'Export CSV Time Logs',
        extensions: ['csv'],
        filterName: 'CSV',
      });
      if (saved) {
        await recordVaultEvent('export');
        await queryClient.invalidateQueries({ queryKey: ['vault'] });
        onNotify(`Exported ${enrichedLogs.length} time log${enrichedLogs.length === 1 ? '' : 's'} to CSV`);
      }
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'CSV export failed', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="card flex flex-col justify-between gap-5 p-5">
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <FileJson size={19} />
            </div>
            <div>
              <h2 className="text-base font-bold text-text">Export System Data</h2>
              <span className="text-xs text-text-muted">Universal serialization with zero vendor constraints</span>
            </div>
          </div>
          <span className="rounded-full bg-surface-high px-2 py-0.5 text-[11px] text-text-muted">JSON &amp; CSV</span>
        </div>

        <div className="flex flex-col gap-3 rounded-lg bg-surface-low p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileJson size={17} className="text-accent" />
              <span className="text-sm font-semibold text-text">Full JSON Archive (.json)</span>
            </div>
            <span className="rounded bg-surface-high px-1.5 py-0.5 font-mono text-[11px] text-text-muted">v{previewQuery.data?.metadata.schemaVersion ?? '…'}-schema</span>
          </div>
          <p className="text-xs text-text-muted">
            Complete database dump including relational keys, taxonomy tags, ISO-8601 timestamps, notes, and dual-track calibration history.
          </p>
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] font-medium text-text-subtle">
              Estimated size: {estimatedJsonBytes != null ? `~${formatBytes(estimatedJsonBytes)} uncompressed` : '…'}
            </span>
            <Button variant="primary" size="sm" onClick={exportJson} disabled={busy !== null || previewQuery.isLoading}>
              <Download size={14} /> {busy === 'json' ? 'Exporting…' : 'Download Full JSON Vault'}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg bg-surface-low p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sheet size={17} className="text-success" />
              <span className="text-sm font-semibold text-text">Spreadsheet Logs (.csv)</span>
            </div>
            <span className="text-[11px] font-bold text-success">Ready for Excel &amp; Numbers</span>
          </div>
          <p className="text-xs text-text-muted">
            Clean tabular format for timesheets, freelance invoicing, client auditing, or personal time analytics spreadsheets.
          </p>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {CSV_RANGES.map((range) => (
              <button
                key={range.key}
                onClick={() => setCsvRange(range.key)}
                className={clsx(
                  'rounded-md border px-2 py-1 text-[11px] font-semibold transition',
                  csvRange === range.key
                    ? 'border-border-strong bg-surface text-text shadow-sm'
                    : 'border-border bg-surface/60 text-text-muted hover:bg-surface hover:text-text',
                )}
              >
                {range.label}
                {range.key === 'all' ? ` (${logsQuery.logs.length} rows)` : ''}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-text-subtle">{logsQuery.isLoading ? 'Loading…' : `${enrichedLogs.length} rows in range`}</span>
            <Button variant="secondary" size="sm" onClick={exportCsv} disabled={busy !== null || logsQuery.isLoading || enrichedLogs.length === 0}>
              <Sheet size={14} /> {busy === 'csv' ? 'Exporting…' : 'Export CSV Time Logs'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-3 text-xs text-text-muted">
        <FileJson size={14} className="text-success" />
        <span>Everything happens locally on your device—nothing is sent over the internet.</span>
      </div>
    </section>
  );
}
