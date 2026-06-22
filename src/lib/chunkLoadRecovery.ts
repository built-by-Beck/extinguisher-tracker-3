const CHUNK_RELOAD_KEY = 'ex3-chunk-reload';

/** True when a dynamic import failed because a hashed asset is missing (usually post-deploy). */
export function isStaleChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('error loading dynamically imported module')
  );
}

/** Reload once per session when lazy chunks are stale after a deploy. */
export function reloadOnceForStaleChunk(): boolean {
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1') {
    return false;
  }
  sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  window.location.reload();
  return true;
}

export function registerChunkLoadRecovery(): void {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reloadOnceForStaleChunk();
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (!isStaleChunkLoadError(event.reason)) return;
    event.preventDefault();
    reloadOnceForStaleChunk();
  });
}
