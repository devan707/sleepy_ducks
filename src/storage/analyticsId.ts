const KEY = 'sleeping-ducks-analytics-id';

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Random, client-generated anonymous id — not derived from device/browser
 * characteristics (no fingerprinting). Persisted so repeat sessions from the
 * same browser share one id; falls back to an in-memory id when storage is
 * unavailable (private browsing, disabled storage, etc.).
 */
let memoId: string | null = null;

export function getAnalyticsId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = generateId();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    if (!memoId) memoId = generateId();
    return memoId;
  }
}
