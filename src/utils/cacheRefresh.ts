export const HARD_REFRESH_GUARD_KEY = 'pony_hard_refresh_guard_v1';
const HARD_REFRESH_WINDOW_MS = 60_000;
const MAX_AUTO_REFRESH_ATTEMPTS = 2;

interface RefreshGuardState {
  count: number;
  ts: number;
}

function readGuard(): RefreshGuardState {
  try {
    const raw = sessionStorage.getItem(HARD_REFRESH_GUARD_KEY);
    if (!raw) return { count: 0, ts: 0 };
    const parsed = JSON.parse(raw) as Partial<RefreshGuardState>;
    const ts = typeof parsed.ts === 'number' ? parsed.ts : 0;
    const count = typeof parsed.count === 'number' ? parsed.count : 0;
    if (Date.now() - ts > HARD_REFRESH_WINDOW_MS) {
      return { count: 0, ts: 0 };
    }
    return { count, ts };
  } catch {
    return { count: 0, ts: 0 };
  }
}

function writeGuard(state: RefreshGuardState) {
  try {
    sessionStorage.setItem(HARD_REFRESH_GUARD_KEY, JSON.stringify(state));
  } catch {}
}

export function isChunkOrLoadError(error: unknown): boolean {
  const msg =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === 'string'
        ? error
        : String(error || '');
  const lower = msg.toLowerCase();
  return (
    lower.includes('failed to fetch dynamically imported module') ||
    lower.includes('importing a module script failed') ||
    lower.includes('error loading dynamically imported module') ||
    lower.includes('loading chunk') ||
    lower.includes('loading css chunk') ||
    lower.includes('chunkloaderror') ||
    lower.includes('unable to preload css')
  );
}

export function cleanupCacheBustParam(): void {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('_cb')) {
      url.searchParams.delete('_cb');
      const cleanUrl = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(null, '', cleanUrl || './');
    }
  } catch {}
}

export async function performHardRefresh(force = false): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!force && typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  const guard = readGuard();
  if (!force && guard.count >= MAX_AUTO_REFRESH_ATTEMPTS) {
    return false;
  }

  writeGuard({
    count: force ? 0 : guard.count + 1,
    ts: Date.now(),
  });

  try {
    if ('caches' in window) {
      const cacheNames = await window.caches.keys();
      await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
    }
  } catch {}

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
    }
  } catch {}

  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_cb', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
  return true;
}
