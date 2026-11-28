// Tests for RestoreVaultCard: file validation, merge/replace modes, confirm
// modal, and import flow — db queries and vault parsing mocked.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VaultPayload } from '@/utils/vault';
import { RestoreVaultCard } from './RestoreVaultCard';

const mocks = vi.hoisted(() => ({
  importVaultPayload: vi.fn(),
  recordVaultEvent: vi.fn().mockResolvedValue(undefined),
  parseVaultJson: vi.fn(),
  vaultCounts: vi.fn(),
}));

vi.mock('@/db/queries', () => ({
  importVaultPayload: mocks.importVaultPayload,
  recordVaultEvent: mocks.recordVaultEvent,
}));

vi.mock('@/utils/vault', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/vault')>();
  return {
    ...actual,
    parseVaultJson: mocks.parseVaultJson,
    vaultCounts: mocks.vaultCounts,
  };
});

const PAYLOAD = { metadata: { schemaVersion: 1 }, data: {} } as unknown as VaultPayload;
const COUNTS = { settings: 0, categories: 2, tasks: 3, scheduleBlocks: 4, timeLogs: 5 };

function renderCard() {
  const onNotify = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <RestoreVaultCard onNotify={onNotify} />
    </QueryClientProvider>,
  );
  const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
  return { onNotify, fileInput };
}

async function pickFile(fileInput: HTMLInputElement, name = 'vault.json', content = '{}') {
  const file = new File([content], name, { type: 'application/json' });
  fireEvent.change(fileInput, { target: { files: [file] } });
  await waitFor(() => expect(fileInput.files?.length ?? 0).toBeGreaterThanOrEqual(0));
}

describe('RestoreVaultCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseVaultJson.mockReturnValue({ payload: PAYLOAD, issues: [] });
    mocks.vaultCounts.mockReturnValue(COUNTS);
    mocks.importVaultPayload.mockResolvedValue({
      tables: [
        { table: 'categories', attempted: 2, written: 2 },
        { table: 'tasks', attempted: 3, written: 3 },
        { table: 'schedule_blocks', attempted: 4, written: 4 },
        { table: 'time_logs', attempted: 5, written: 5 },
        { table: 'app_settings', attempted: 8, written: 8 },
      ],
    });
  });

  it('renders the dropzone and disables restore until a file is loaded', () => {
    renderCard();

    expect(screen.getByText('Import & Vault Restoration')).toBeInTheDocument();
    expect(screen.getByText('Drop intents_backup.json here')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Verify & Restore Vault/ })).toBeDisabled();
  });

  it('rejects non-.json files', async () => {
    const { onNotify, fileInput } = renderCard();
    await pickFile(fileInput, 'vault.txt', 'hello');

    await waitFor(() =>
      expect(onNotify).toHaveBeenCalledWith('Only .json vault files are supported', 'error'),
    );
    expect(mocks.parseVaultJson).not.toHaveBeenCalled();
  });

  it('loads a valid file, shows counts, and enables restore', async () => {
    const { fileInput } = renderCard();
    await pickFile(fileInput);

    expect(await screen.findByText('vault.json')).toBeInTheDocument();
    expect(screen.getByText('Validation passed — ready to restore')).toBeInTheDocument();
    expect(screen.getByText('2 categories')).toBeInTheDocument();
    expect(screen.getByText('3 intentions')).toBeInTheDocument();
    expect(screen.getByText('4 planned blocks')).toBeInTheDocument();
    expect(screen.getByText('5 time logs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Verify & Restore Vault/ })).toBeEnabled();
  });

  it('blocks restore when the file has validation issues', async () => {
    mocks.parseVaultJson.mockReturnValue({ payload: PAYLOAD, issues: ['tasks[0].title missing'] });
    const { fileInput } = renderCard();
    await pickFile(fileInput);

    expect(await screen.findByText(/File failed validation/)).toBeInTheDocument();
    expect(screen.getByText(/tasks\[0\]\.title missing/)).toBeInTheDocument();
    expect(screen.getByText('1 validation issue found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Verify & Restore Vault/ })).toBeDisabled();
  });

  it('runs a replace import through the confirm modal', async () => {
    const user = userEvent.setup();
    const { onNotify, fileInput } = renderCard();
    await pickFile(fileInput);
    await screen.findByText('vault.json');

    await user.click(screen.getByRole('button', { name: /Verify & Restore Vault/ }));
    expect(screen.getByText('Replace all data?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete everything & restore' }));

    expect(mocks.importVaultPayload).toHaveBeenCalledWith(PAYLOAD, 'replace');
    expect(mocks.recordVaultEvent).toHaveBeenCalledWith('import');
    expect(onNotify).toHaveBeenCalledWith('Vault restored: 22 records imported (replace)');
    // File state cleared -> dropzone prompt returns
    expect(await screen.findByText('Drop intents_backup.json here')).toBeInTheDocument();
  });

  it('runs a merge import when Merge mode is selected', async () => {
    const user = userEvent.setup();
    const { onNotify, fileInput } = renderCard();
    await pickFile(fileInput);
    await screen.findByText('vault.json');

    await user.click(screen.getByText('Merge Import'));
    await user.click(screen.getByRole('button', { name: /Verify & Restore Vault/ }));
    expect(screen.getByText('Merge vault data?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Merge import' }));

    expect(mocks.importVaultPayload).toHaveBeenCalledWith(PAYLOAD, 'merge');
    expect(onNotify).toHaveBeenCalledWith('Vault merged: 22 records added');
  });

  it('cancel in the confirm modal aborts the import', async () => {
    const user = userEvent.setup();
    const { fileInput } = renderCard();
    await pickFile(fileInput);
    await screen.findByText('vault.json');

    await user.click(screen.getByRole('button', { name: /Verify & Restore Vault/ }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mocks.importVaultPayload).not.toHaveBeenCalled();
  });

  it('notifies an error when the import fails', async () => {
    const user = userEvent.setup();
    mocks.importVaultPayload.mockRejectedValue(new Error('constraint violation'));
    const { onNotify, fileInput } = renderCard();
    await pickFile(fileInput);
    await screen.findByText('vault.json');

    await user.click(screen.getByRole('button', { name: /Verify & Restore Vault/ }));
    await user.click(screen.getByRole('button', { name: 'Delete everything & restore' }));

    expect(onNotify).toHaveBeenCalledWith('constraint violation', 'error');
  });
});
