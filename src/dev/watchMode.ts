import { isDevMode } from './isDevMode';

let active = false;

/** True when `?watch=1` is in the URL (dev builds only). */
export function isWatchModeUrlParam(): boolean {
  if (!isDevMode() || typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('watch') === '1';
}

export function isWatchModeActive(): boolean {
  return isDevMode() && active;
}

export function setWatchMode(enabled: boolean): void {
  if (!isDevMode()) return;
  active = enabled;
}

export function toggleWatchMode(): boolean {
  if (!isDevMode()) return false;
  active = !active;
  return active;
}

/** Reset when leaving a scene so the next run starts normal unless URL param is set. */
export function resetWatchMode(): void {
  active = false;
}
