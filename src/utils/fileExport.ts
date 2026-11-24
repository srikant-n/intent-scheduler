import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';

export interface SaveTextFileOptions {
  title?: string;
  extensions?: string[];
  filterName?: string;
}

/** Open the native save dialog, then write via the `save_text_file` Rust command
 * (which restricts writes to absolute .csv/.json paths). Returns false if cancelled. */
export async function saveTextFile(
  defaultFileName: string,
  contents: string,
  options: SaveTextFileOptions = {},
): Promise<boolean> {
  const extensions = options.extensions ?? ['csv'];
  const filterName = options.filterName ?? extensions.join(' / ').toUpperCase();
  const path = await save({
    title: options.title ?? `Export ${filterName}`,
    defaultPath: defaultFileName,
    filters: [{ name: filterName, extensions }],
  });
  if (!path) return false;
  await invoke('save_text_file', { path, contents });
  return true;
}
