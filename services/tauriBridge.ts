import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export interface HlxFilePayload {
  path: string;
  name: string;
  content: string;
}

/**
 * Checks whether the app is currently running inside the Tauri Desktop shell.
 */
export const isTauriDesktop = (): boolean => {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.__TAURI_INTERNALS__ || w.__TAURI__);
};

/**
 * Updates both document.title and the native Tauri window title to reflect the active .hlx document.
 */
export const updateWindowTitle = async (projectName?: string, filePath?: string | null) => {
  const cleanName = projectName ? `${projectName.replace(/\.hlx$/i, '')}.hlx` : '';
  const fullTitle = cleanName
    ? `${cleanName} — Hélix - Plataforma de Grafos Inteligente`
    : 'Hélix - Plataforma de Grafos Inteligente';

  if (typeof document !== 'undefined') {
    document.title = fullTitle;
  }

  if (isTauriDesktop()) {
    try {
      const win = getCurrentWindow();
      await win.setTitle(filePath ? `${cleanName} (${filePath}) — Hélix` : fullTitle);
    } catch {
      // Ignore if window title permission is unavailable
    }
  }
};

/**
 * Checks if the Tauri executable was launched by double-clicking a .hlx file in the OS.
 */
export const checkLaunchHlxFile = async (): Promise<HlxFilePayload | null> => {
  if (!isTauriDesktop()) return null;
  try {
    const payload = await invoke<HlxFilePayload | null>('get_launch_hlx_file');
    return payload || null;
  } catch (err) {
    console.warn('Não foi possível verificar arquivo .hlx inicial:', err);
    return null;
  }
};

/**
 * Opens the native OS File Dialog filtered to .hlx documents when running in Tauri Desktop.
 */
export const openHlxFileDialogNative = async (): Promise<HlxFilePayload | null> => {
  if (!isTauriDesktop()) return null;
  return await invoke<HlxFilePayload | null>('pick_open_hlx_file');
};

/**
 * Opens the native OS Save Dialog for .hlx documents when running in Tauri Desktop.
 */
export const saveHlxFileDialogNative = async (
  defaultName: string,
  content: string
): Promise<HlxFilePayload | null> => {
  if (!isTauriDesktop()) return null;
  return await invoke<HlxFilePayload | null>('pick_save_hlx_file', {
    defaultName,
    content,
  });
};

/**
 * Saves directly to an existing .hlx file path on disk in Tauri Desktop.
 */
export const saveHlxToPathNative = async (
  path: string,
  content: string
): Promise<HlxFilePayload | null> => {
  if (!isTauriDesktop()) return null;
  return await invoke<HlxFilePayload>('save_hlx_to_path', {
    path,
    content,
  });
};

/**
 * Converts a dataUrl (PNG/JPEG/SVG) to raw bytes and saves via native OS Save Dialog in Tauri Desktop.
 */
export const saveExportedImageNative = async (
  defaultName: string,
  format: 'png' | 'jpeg' | 'svg',
  dataUrl: string
): Promise<string | null> => {
  if (!isTauriDesktop()) return null;

  let bytes: number[] = [];
  if (dataUrl.startsWith('data:image/svg+xml;charset=utf-8,')) {
    const rawSvg = decodeURIComponent(dataUrl.replace('data:image/svg+xml;charset=utf-8,', ''));
    const encoder = new TextEncoder();
    bytes = Array.from(encoder.encode(rawSvg));
  } else {
    const base64Part = dataUrl.split(',')[1] || '';
    const binaryStr = atob(base64Part);
    bytes = new Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
  }

  return await invoke<string | null>('pick_save_export_image', {
    defaultName,
    format,
    bytes,
  });
};
