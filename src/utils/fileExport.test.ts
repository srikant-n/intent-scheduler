import { beforeEach, describe, expect, it, vi } from 'vitest';

const saveMock = vi.fn();
const invokeMock = vi.fn();

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: (...args: unknown[]) => saveMock(...args),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { saveTextFile } from './fileExport';

describe('saveTextFile', () => {
  beforeEach(() => {
    saveMock.mockReset();
    invokeMock.mockReset();
  });

  it('returns false and skips invoke when the dialog is cancelled', async () => {
    saveMock.mockResolvedValue(null);
    const result = await saveTextFile('export.csv', 'a,b\n');
    expect(result).toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('writes via save_text_file with the chosen path', async () => {
    saveMock.mockResolvedValue('/tmp/export.csv');
    invokeMock.mockResolvedValue(undefined);
    const result = await saveTextFile('export.csv', 'a,b\n1,2\n');
    expect(result).toBe(true);
    expect(invokeMock).toHaveBeenCalledWith('save_text_file', {
      path: '/tmp/export.csv',
      contents: 'a,b\n1,2\n',
    });
  });

  it('passes default csv filter when no options given', async () => {
    saveMock.mockResolvedValue('/tmp/x.csv');
    await saveTextFile('x.csv', '');
    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: 'x.csv',
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      }),
    );
  });

  it('honours custom title, extensions, and filterName', async () => {
    saveMock.mockResolvedValue('/tmp/x.json');
    await saveTextFile('x.json', '{}', {
      title: 'Pick file',
      extensions: ['json', 'txt'],
      filterName: 'Data',
    });
    expect(saveMock).toHaveBeenCalledWith({
      title: 'Pick file',
      defaultPath: 'x.json',
      filters: [{ name: 'Data', extensions: ['json', 'txt'] }],
    });
  });

  it('derives filter name from extensions when filterName omitted', async () => {
    saveMock.mockResolvedValue('/tmp/x.json');
    await saveTextFile('x.json', '{}', { extensions: ['json', 'txt'] });
    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Export JSON / TXT',
        filters: [{ name: 'JSON / TXT', extensions: ['json', 'txt'] }],
      }),
    );
  });
});
