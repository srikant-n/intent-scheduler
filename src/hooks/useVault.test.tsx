// Tests for useVaultHealth + useVaultExportPreview: aggregated storage health
// (file info, counts, integrity, pragmas, export/import timestamps) with
// per-source failure tolerance, and the export dry-run preview.
import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVaultExportPreview, useVaultHealth } from './useVault';
import { renderHookWithQueryClient } from './testUtils';
import type { VaultPayload } from '@/utils/vault';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@/db/queries', () => ({
  exportVaultPayload: vi.fn(),
  getPragmaValue: vi.fn(),
  getSetting: vi.fn(),
  getVaultCounts: vi.fn(),
  runIntegrityCheck: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import { exportVaultPayload, getPragmaValue, getSetting, getVaultCounts, runIntegrityCheck } from '@/db/queries';

const invokeMock = vi.mocked(invoke);
const exportMock = vi.mocked(exportVaultPayload);
const pragmaMock = vi.mocked(getPragmaValue);
const getSettingMock = vi.mocked(getSetting);
const countsMock = vi.mocked(getVaultCounts);
const integrityMock = vi.mocked(runIntegrityCheck);

const COUNTS = { blocks: 3, logs: 8, tasks: 5, categories: 5, settings: 12 };

beforeEach(() => {
  vi.clearAllMocks();
  invokeMock.mockResolvedValue({ path: '/data/tracker.db', size_bytes: 4096 });
  countsMock.mockResolvedValue(COUNTS);
  integrityMock.mockResolvedValue('ok');
  pragmaMock.mockImplementation(async (key) => `val-${key}`);
  getSettingMock.mockImplementation(async (key) => (key === 'vault_last_export_at' ? '2026-11-20T10:00:00Z' : null));
});

describe('useVaultHealth', () => {
  it('aggregates file info, counts, integrity, pragmas, and timestamps', async () => {
    const { result } = renderHookWithQueryClient(() => useVaultHealth());

    await waitFor(() => expect(result.current.data).toBeDefined());
    const health = result.current.data!;

    expect(health.fileInfo).toEqual({ path: '/data/tracker.db', size_bytes: 4096 });
    expect(health.counts).toEqual(COUNTS);
    expect(health.integrity).toBe('ok');
    expect(health.pragmas.journal_mode).toBe('val-journal_mode');
    expect(health.pragmas.page_size).toBe('val-page_size');
    expect(health.lastExportAt).toBe('2026-11-20T10:00:00Z');
    expect(health.lastImportAt).toBeNull();
  });

  it('tolerates failures: null file info, unknown integrity, empty pragmas', async () => {
    invokeMock.mockRejectedValue(new Error('no tauri'));
    integrityMock.mockRejectedValue(new Error('corrupt'));
    pragmaMock.mockRejectedValue(new Error('denied'));
    getSettingMock.mockResolvedValue(null);

    const { result } = renderHookWithQueryClient(() => useVaultHealth());

    await waitFor(() => expect(result.current.data).toBeDefined());
    const health = result.current.data!;

    expect(health.fileInfo).toBeNull();
    expect(health.integrity).toBe('unknown');
    expect(health.pragmas.journal_mode).toBe('');
    expect(health.counts).toEqual(COUNTS);
  });
});

describe('useVaultExportPreview', () => {
  it('returns the exportVaultPayload result as query data', async () => {
    const payload: VaultPayload = {
      metadata: { schemaVersion: 1, exportedAt: '2026-11-24T00:00:00Z', appVersion: '0.1.0' },
      data: { settings: [], categories: [], tasks: [], scheduleBlocks: [], timeLogs: [] },
    };
    exportMock.mockResolvedValue(payload);

    const { result } = renderHookWithQueryClient(() => useVaultExportPreview());

    await waitFor(() => expect(result.current.data).toEqual(payload));
    expect(exportMock).toHaveBeenCalledOnce();
  });
});
