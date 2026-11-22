import { useQuery } from '@tanstack/react-query';
import {
  exportVaultPayload,
  getPragmaValue,
  getSetting,
  getVaultCounts,
  runIntegrityCheck,
  type VaultCounts,
} from '@/db/queries';
import { invoke } from '@tauri-apps/api/core';

export interface DatabaseFileInfo {
  path: string;
  size_bytes: number;
}

export interface VaultHealth {
  fileInfo: DatabaseFileInfo | null;
  counts: VaultCounts;
  integrity: string;
  pragmas: Record<string, string>;
  lastExportAt: string | null;
  lastImportAt: string | null;
}

const PRAGMA_KEYS = ['journal_mode', 'synchronous', 'cache_size', 'foreign_keys', 'auto_vacuum', 'page_size'] as const;

export function useVaultHealth() {
  return useQuery({
    queryKey: ['vault', 'health'],
    queryFn: async (): Promise<VaultHealth> => {
      const [fileInfo, counts, integrity, pragmaEntries, lastExportAt, lastImportAt] = await Promise.all([
        invoke<DatabaseFileInfo>('get_database_file_info').catch(() => null),
        getVaultCounts(),
        runIntegrityCheck().catch(() => 'unknown'),
        Promise.all(PRAGMA_KEYS.map(async (key) => [key, await getPragmaValue(key).catch(() => '')] as const)),
        getSetting('vault_last_export_at'),
        getSetting('vault_last_import_at'),
      ]);
      return {
        fileInfo,
        counts,
        integrity,
        pragmas: Object.fromEntries(pragmaEntries),
        lastExportAt,
        lastImportAt,
      };
    },
    staleTime: 15_000,
  });
}

export function useVaultExportPreview() {
  return useQuery({
    queryKey: ['vault', 'export-preview'],
    queryFn: exportVaultPayload,
    staleTime: 30_000,
  });
}
