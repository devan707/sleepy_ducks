import { isWatchModeActive } from './watchMode';

let paused = false;

export function isWatchTimePaused(): boolean {
  return isWatchModeActive() && paused;
}

export function toggleWatchTimePaused(): boolean {
  if (!isWatchModeActive()) return false;
  paused = !paused;
  return paused;
}

export function resetWatchTime(): void {
  paused = false;
}
