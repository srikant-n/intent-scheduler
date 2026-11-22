import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';

export async function saveTextFile(defaultFileName: string, contents: string, title = 'Export CSV'): Promise<boolean> {
  const path = await save({
    title,
    defaultPath: defaultFileName,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (!path) return false;
  await invoke('save_text_file', { path, contents });
  return true;
}
