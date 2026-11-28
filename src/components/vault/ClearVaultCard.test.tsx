// Tests for ClearVaultCard: record counts, disabled state, confirm modal,
// and the clear flow, with db queries and useVaultHealth mocked.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VaultCounts } from '@/db/queries';
import { ClearVaultCard } from './ClearVaultCard';

const clearVaultDataMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/queries', () => ({
  clearVaultData: clearVaultDataMock,
}));

const healthState = vi.hoisted(() => ({
  data: undefined as { counts: VaultCounts } | undefined,
  isLoading: false,
}));

vi.mock('@/hooks/useVault', () => ({
  useVaultHealth: () => healthState,
}));

const COUNTS: VaultCounts = { blocks: 12, logs: 30, tasks: 9, categories: 4, settings: 6 };

function renderCard() {
  const onNotify = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ClearVaultCard onNotify={onNotify} />
    </QueryClientProvider>,
  );
  return onNotify;
}

describe('ClearVaultCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    healthState.data = { counts: COUNTS };
    healthState.isLoading = false;
    clearVaultDataMock.mockResolvedValue(undefined);
  });

  it('renders the card with total record count and breakdown', () => {
    renderCard();

    expect(screen.getByRole('heading', { name: 'Clear All Data' })).toBeInTheDocument();
    expect(screen.getByText('Irreversible')).toBeInTheDocument();
    // 12+30+9+4+6 = 61 records
    expect(screen.getByText('61 records')).toBeInTheDocument();
    expect(screen.getByText(/12 blocks · 30 logs · 9 intentions · 4 categories · 6 settings/)).toBeInTheDocument();
  });

  it('disables the clear button when there are no records', () => {
    healthState.data = { counts: { blocks: 0, logs: 0, tasks: 0, categories: 0, settings: 0 } };
    renderCard();

    expect(screen.getByRole('button', { name: /Clear All Data/ })).toBeDisabled();
  });

  it('disables the clear button while health is loading', () => {
    healthState.data = undefined;
    healthState.isLoading = true;
    renderCard();

    expect(screen.getByRole('button', { name: /Clear All Data/ })).toBeDisabled();
    expect(screen.getByText('Counting records…')).toBeInTheDocument();
  });

  it('opens the confirm modal and clears data on confirm', async () => {
    const user = userEvent.setup();
    const onNotify = renderCard();

    await user.click(screen.getByRole('button', { name: /Clear All Data/ }));
    expect(screen.getByText('Clear all vault data?')).toBeInTheDocument();
    expect(screen.getByText(/permanently delete all 61 records/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete everything' }));

    expect(clearVaultDataMock).toHaveBeenCalledTimes(1);
    await vi.waitFor(() =>
      expect(onNotify).toHaveBeenCalledWith(expect.stringContaining('All vault data cleared')),
    );
  });

  it('cancel closes the modal without clearing', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole('button', { name: /Clear All Data/ }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(clearVaultDataMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Clear all vault data?')).not.toBeInTheDocument();
  });

  it('notifies with error kind when clearing fails', async () => {
    const user = userEvent.setup();
    clearVaultDataMock.mockRejectedValue(new Error('disk full'));
    const onNotify = renderCard();

    await user.click(screen.getByRole('button', { name: /Clear All Data/ }));
    await user.click(screen.getByRole('button', { name: 'Delete everything' }));

    expect(onNotify).toHaveBeenCalledWith('disk full', 'error');
  });
});
