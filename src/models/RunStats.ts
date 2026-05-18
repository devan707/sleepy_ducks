export interface RunStats {
  ducksSaved: number;
  ducksMissed: number;
  longestCombo: number;
  timeSurvivedMs: number;
}

export function createRunStats(): RunStats {
  return {
    ducksSaved: 0,
    ducksMissed: 0,
    longestCombo: 0,
    timeSurvivedMs: 0,
  };
}

export function recordDuckSaved(stats: RunStats): void {
  stats.ducksSaved += 1;
}

export function recordDuckMissed(stats: RunStats): void {
  stats.ducksMissed += 1;
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
