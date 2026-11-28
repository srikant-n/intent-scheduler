// Tests for VaultHealthCard: integrity status, file info, counts, copy path,
// and reveal-in-explorer, with useVaultHealth mocked.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VaultHealth } from '@/hooks/useVault';
import { VaultHealthCard } from './VaultHealthCard';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

const healthState = vi.hoisted(() => ({
  data: undefined as VaultHealth | undefined,
  isLoading: false,
}));

vi.mock('@/hooks/useVault', () => ({
  useVaultHealth: () => healthState,
}));

function makeHealth(overrides: Partial<VaultHealth> = {}): VaultHealth {
  return {
    fileInfo: { path: '/data/tracker.db', size_bytes: 2048 },
    counts: { blocks: 10, logs: 25, tasks: 8, categories: 4, settings: 6 },
    integrity: 'ok',
    pragmas: {},
    lastExportAt: new Date(Date.now() - 5 * 60000).toISOString(),
    lastImportAt: null,
    ...overrides,
  };
}

function renderCard() {
  const onNotify = vi.fn();
  render(<VaultHealthCard onNotify={onNotify} />);
  return onNotify;
}

describe('VaultHealthCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    healthState.data = makeHealth();
    healthState.isLoading = false;
  });

  it('renders the database name, path, and integrity badge', () => {
    renderCard();

    expect(screen.getByText('tracker.db')).toBeInTheDocument();
    expect(screen.getByText('/data/tracker.db')).toBeInTheDocument();
    expect(screen.getByText('Integrity Valid')).toBeInTheDocument();
    expect(screen.getByText('ok (0 anomalies)')).toBeInTheDocument();
  });

  it('shows a warning state when integrity check fails', () => {
    healthState.data = makeHealth({ integrity: 'corruption detected' });
    renderCard();

    expect(screen.getByText('Check Failed')).toBeInTheDocument();
    expect(screen.getByText('corruption detected')).toBeInTheDocument();
  });

  it('renders row-count metrics and formatted file size', () => {
    renderCard();

    expect(screen.getByText('Intent Blocks')).toBeInTheDocument();
    expect(screen.getByText('Actual Logs')).toBeInTheDocument();
    expect(screen.getByText('Intentions')).toBeInTheDocument();
    expect(screen.getByText('Categories')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    // 2048 bytes -> '2.0 KB'
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
  });

  it('shows relative last-backup time', () => {
    renderCard();
    expect(screen.getByText(/Last backup: 5 minutes ago/)).toBeInTheDocument();
  });

  it('shows "Never" when there are no export/import timestamps', () => {
    healthState.data = makeHealth({ lastExportAt: null, lastImportAt: null });
    renderCard();
    expect(screen.getByText('Last backup: Never')).toBeInTheDocument();
  });

  it('copies the db path to the clipboard', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    renderCard();
    await user.click(screen.getByRole('button', { name: /Copy/ }));

    expect(writeText).toHaveBeenCalledWith('/data/tracker.db');
    expect(await screen.findByRole('button', { name: /Copied/ })).toBeInTheDocument();
  });

  it('notifies on clipboard failure', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    });

    const onNotify = renderCard();
    await user.click(screen.getByRole('button', { name: /Copy/ }));
    expect(onNotify).toHaveBeenCalledWith('Could not copy path to clipboard', 'error');
  });

  it('invokes reveal_path_in_explorer with the db path', async () => {
    const user = userEvent.setup();
    invokeMock.mockResolvedValue(undefined);

    renderCard();
    await user.click(screen.getByRole('button', { name: /Open in File Explorer/ }));

    expect(invokeMock).toHaveBeenCalledWith('reveal_path_in_explorer', { path: '/data/tracker.db' });
  });

  it('notifies when reveal fails', async () => {
    const user = userEvent.setup();
    invokeMock.mockRejectedValue(new Error('no explorer'));

    const onNotify = renderCard();
    await user.click(screen.getByRole('button', { name: /Open in File Explorer/ }));
    expect(onNotify).toHaveBeenCalledWith('no explorer', 'error');
  });

  it('renders loading placeholders while the query is pending', () => {
    healthState.data = undefined;
    healthState.isLoading = true;
    renderCard();

    expect(screen.getByText('Checking…')).toBeInTheDocument();
    expect(screen.getByText('Resolving database path…')).toBeInTheDocument();
  });
});
