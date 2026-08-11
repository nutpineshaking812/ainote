export const isTauri = typeof window !== 'undefined' && (
  !!window.__TAURI__ || 
  !!window.__TAURI_IPC__ || 
  !!window.__TAURI_INTERNALS__
);
