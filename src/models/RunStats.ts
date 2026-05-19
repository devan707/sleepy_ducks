import type { DuckKind } from '../config/gameConfig';

/** True when a duck reaching the mist should increment `ducksMissed` (not decoys). */
export function isDuckMissForStats(kind: DuckKind): boolean {
  return kind !== 'decoy';
}

export interface RunStats {
  ducksSaved: number;
  ducksMissed: number;
  /** Early (pre-saveable) taps and empty gameplay taps. */
  missedTaps: number;
  /** Decoy taps. */
  badTaps: number;
  longestCombo: number;
  timeSurvivedMs: number;
}

export function createRunStats(): RunStats {
  return {
    ducksSaved: 0,
    ducksMissed: 0,
    missedTaps: 0,
    badTaps: 0,
    longestCombo: 0,
    timeSurvivedMs: 0,
  };
}

export function recordDuckSaved(stats: RunStats): void {
  stats.ducksSaved += 1;
}

export function recordDuckMissed(stats: RunStats, kind: DuckKind): void {
  if (!isDuckMissForStats(kind)) return;
  stats.ducksMissed += 1;
}

export function recordMissedTap(stats: RunStats): void {
  stats.missedTaps += 1;
}

export function recordBadTapStat(stats: RunStats): void {
  stats.badTaps += 1;
}

export function updateLongestCombo(stats: RunStats, combo: number): void {
  if (combo > stats.longestCombo) {
    stats.longestCombo = combo;
  }
}

/** Add active gameplay time (excludes game-over / calibration pause). */
export function tickSurvivalTime(stats: RunStats, deltaMs: number): void {
  if (deltaMs > 0) {
    stats.timeSurvivedMs += deltaMs;
  }
}

export function formatSurvivalTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
