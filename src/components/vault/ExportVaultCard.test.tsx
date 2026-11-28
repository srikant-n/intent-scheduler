// Tests for ExportVaultCard: JSON/CSV export flows, range selector, and
// notify callbacks, with data hooks and db/file-export mocked.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimeLog } from '@/types/database';
import type { VaultPayload } from '@/utils/vault';
import { ExportVaultCard } from './ExportVaultCard';

const mocks = vi.hoisted(() => ({
  exportVaultPayload: vi.fn(),
  recordVaultEvent: vi.fn().mockResolvedValue(undefined),
  saveTextFile: vi.fn(),
  logs: [] as TimeLog[],
  logsLoading: false,
}));

vi.mock('@/db/queries', () => ({
  exportVaultPayload: mocks.exportVaultPayload,
  recordVaultEvent: mocks.recordVaultEvent,
}));

vi.mock('@/utils/fileExport', () => ({
  saveTextFile: mocks.saveTextFile,
}));

vi.mock('@/hooks/useVault', () => ({
  useVaultExportPreview: () => ({
    data: {
      metadata: { schemaVersion: 1, exportedAt: 't', appVersion: '0.1.0' },
      data: { settings: [], categories: [], tasks: [], scheduleBlocks: [], timeLogs: [] },
    } as VaultPayload,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useIntentions', () => ({
  useAllIntentions: () => ({ intentions: [] }),
}));

vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => ({ categories: [] }),
}));

vi.mock('@/hooks/useLogs', () => ({
  useTimeLogsRange: () => ({ logs: mocks.logs, isLoading: mocks.logsLoading }),
}));

function makeLog(overrides: Partial<TimeLog> = {}): TimeLog {
  return {
    id: 'log-1',
    taskId: null,
    scheduleBlockId: null,
    customTitle: 'Coffee break',
    categoryId: null,
    logDate: '2026-11-20',
    startTime: '10:00',
    endTime: '10:30',
    durationMins: 30,
    notes: null,
    mood: null,
    isAdHoc: true,
    createdAt: 't',
    ...overrides,
  };
}

function renderCard() {
  const onNotify = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ExportVaultCard onNotify={onNotify} />
    </QueryClientProvider>,
  );
  return onNotify;
}

describe('ExportVaultCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logs = [makeLog()];
    mocks.logsLoading = false;
    mocks.saveTextFile.mockResolvedValue(true);
    mocks.exportVaultPayload.mockResolvedValue({
      metadata: { schemaVersion: 1, exportedAt: 't', appVersion: '0.1.0' },
      data: { settings: [], categories: [], tasks: [], scheduleBlocks: [], timeLogs: [] },
    });
  });

  it('renders both export sections and the schema badge', () => {
    renderCard();

    expect(screen.getByText('Export System Data')).toBeInTheDocument();
    expect(screen.getByText('Full JSON Archive (.json)')).toBeInTheDocument();
    expect(screen.getByText('Spreadsheet Logs (.csv)')).toBeInTheDocument();
    expect(screen.getByText('v1-schema')).toBeInTheDocument();
    expect(screen.getByText(/Estimated size:/)).toBeInTheDocument();
  });

  it('shows the row count on the "All Time" range button', () => {
    renderCard();
    expect(screen.getByRole('button', { name: /All Time \(1 rows\)/ })).toBeInTheDocument();
    expect(screen.getByText('1 rows in range')).toBeInTheDocument();
  });

  it('exports CSV: builds csv, saves file, records event, notifies', async () => {
    const user = userEvent.setup();
    const onNotify = renderCard();

    await user.click(screen.getByRole('button', { name: /Export CSV Time Logs/ }));

    expect(mocks.saveTextFile).toHaveBeenCalledTimes(1);
    const [fileName, contents, options] = mocks.saveTextFile.mock.calls[0];
    expect(fileName).toMatch(/^intent-scheduler-timelogs-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(contents).toContain('log_date');
    expect(contents).toContain('Coffee break');
    expect(options).toMatchObject({ extensions: ['csv'] });

    expect(mocks.recordVaultEvent).toHaveBeenCalledWith('export');
    expect(onNotify).toHaveBeenCalledWith('Exported 1 time log to CSV');
  });

  it('pluralizes the CSV success message', async () => {
    const user = userEvent.setup();
    mocks.logs = [makeLog(), makeLog({ id: 'log-2' })];
    const onNotify = renderCard();

    await user.click(screen.getByRole('button', { name: /Export CSV Time Logs/ }));
    expect(onNotify).toHaveBeenCalledWith('Exported 2 time logs to CSV');
  });

  it('does not notify when the save dialog is cancelled', async () => {
    const user = userEvent.setup();
    mocks.saveTextFile.mockResolvedValue(false);
    const onNotify = renderCard();

    await user.click(screen.getByRole('button', { name: /Export CSV Time Logs/ }));
    expect(mocks.recordVaultEvent).not.toHaveBeenCalled();
    expect(onNotify).not.toHaveBeenCalled();
  });

  it('notifies an error when CSV export throws', async () => {
    const user = userEvent.setup();
    mocks.saveTextFile.mockRejectedValue(new Error('write failed'));
    const onNotify = renderCard();

    await user.click(screen.getByRole('button', { name: /Export CSV Time Logs/ }));
    expect(onNotify).toHaveBeenCalledWith('write failed', 'error');
  });

  it('disables the CSV button when there are no logs', () => {
    mocks.logs = [];
    renderCard();
    expect(screen.getByRole('button', { name: /Export CSV Time Logs/ })).toBeDisabled();
  });

  it('switches CSV range presets', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole('button', { name: 'This Month' }));
    expect(screen.getByRole('button', { name: 'This Month' })).toHaveClass('border-border-strong');

    await user.click(screen.getByRole('button', { name: 'Last 30 Days' }));
    expect(screen.getByRole('button', { name: 'Last 30 Days' })).toHaveClass('border-border-strong');
  });

  it('exports the full JSON vault', async () => {
    const user = userEvent.setup();
    const onNotify = renderCard();

    await user.click(screen.getByRole('button', { name: /Download Full JSON Vault/ }));

    expect(mocks.exportVaultPayload).toHaveBeenCalledTimes(1);
    const [fileName, contents, options] = mocks.saveTextFile.mock.calls[0];
    expect(fileName).toMatch(/^intents_vault_\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(contents)).toHaveProperty('metadata.schemaVersion', 1);
    expect(options).toMatchObject({ extensions: ['json'] });

    expect(mocks.recordVaultEvent).toHaveBeenCalledWith('export');
    expect(onNotify).toHaveBeenCalledWith(expect.stringContaining('Downloaded intents_vault_'));
  });

  it('notifies an error when JSON export fails', async () => {
    const user = userEvent.setup();
    mocks.exportVaultPayload.mockRejectedValue(new Error('payload failed'));
    const onNotify = renderCard();

    await user.click(screen.getByRole('button', { name: /Download Full JSON Vault/ }));
    expect(onNotify).toHaveBeenCalledWith('payload failed', 'error');
  });
});
