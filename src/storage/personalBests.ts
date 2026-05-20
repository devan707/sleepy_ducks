import type { RunStats } from '../models/RunStats';
import { formatSurvivalTime } from '../models/RunStats';
import { COLORS } from '../config/gameConfig';
import { formatScore } from '../util/formatScore';

const BESTS_KEY = 'sleeping-ducks-personal-bests';
const LEGACY_BOARD_KEY = 'sleeping-ducks-leaderboard';
const LEGACY_SCORE_KEY = 'sleeping-ducks-high-score';

export interface PersonalBests {
  bestScore: number;
  mostDucksSaved: number;
  longestCombo: number;
  longestTimeMs: number;
}

export type PersonalStatKey = keyof PersonalBests;

export interface PersonalStatDisplay {
  key: PersonalStatKey;
  label: string;
  fill: number;
  format: (bests: PersonalBests) => string;
}

export const PERSONAL_STAT_CARDS: PersonalStatDisplay[] = [
  {
    key: 'bestScore',
    label: 'Best score',
    fill: COLORS.waterLight,
    format: (b) => (b.bestScore > 0 ? formatScore(b.bestScore) : '—'),
  },
  {
    key: 'longestTimeMs',
    label: 'Longest float',
    fill: COLORS.waterMid,
    format: (b) => (b.longestTimeMs > 0 ? formatSurvivalTime(b.longestTimeMs) : '—'),
  },
  {
    key: 'mostDucksSaved',
    label: 'Most saved',
    fill: COLORS.mossLight,
    format: (b) => (b.mostDucksSaved > 0 ? String(b.mostDucksSaved) : '—'),
  },
  {
    key: 'longestCombo',
    label: 'Best combo',
    fill: COLORS.rock,
    format: (b) => (b.longestCombo > 0 ? String(b.longestCombo) : '—'),
  },
];

export function createEmptyPersonalBests(): PersonalBests {
  return {
    bestScore: 0,
    mostDucksSaved: 0,
    longestCombo: 0,
    longestTimeMs: 0,
  };
}

export function getPersonalBests(): PersonalBests {
  return loadBests();
}

export function getHighScore(): number {
  return loadBests().bestScore;
}

export function getLongestTimeMs(): number {
  return loadBests().longestTimeMs;
}

export function hasAnyPersonalBests(bests: PersonalBests): boolean {
  return (
    bests.bestScore > 0 ||
    bests.mostDucksSaved > 0 ||
    bests.longestCombo > 0 ||
    bests.longestTimeMs > 0
  );
}

/** Update personal records after a run (not a leaderboard). */
export function recordPersonalRun(
  score: number,
  stats: RunStats,
): { isNewBestScore: boolean; isNewLongestTime: boolean } {
  const hadActivity = score > 0 || stats.ducksSaved > 0 || stats.timeSurvivedMs > 0;
  if (!hadActivity) {
    return { isNewBestScore: false, isNewLongestTime: false };
  }

  const bests = loadBests();
  let isNewBestScore = false;
  let isNewLongestTime = false;

  if (score > bests.bestScore) {
    bests.bestScore = score;
    isNewBestScore = true;
  }
  if (stats.ducksSaved > bests.mostDucksSaved) {
    bests.mostDucksSaved = stats.ducksSaved;
  }
  if (stats.longestCombo > bests.longestCombo) {
    bests.longestCombo = stats.longestCombo;
  }
  if (stats.timeSurvivedMs > bests.longestTimeMs) {
    bests.longestTimeMs = stats.timeSurvivedMs;
    isNewLongestTime = true;
  }

  saveBests(bests);

  if (isNewBestScore) {
    try {
      localStorage.setItem(LEGACY_SCORE_KEY, String(bests.bestScore));
    } catch {
      /* ignore */
    }
  }

  return { isNewBestScore, isNewLongestTime };
}

function loadBests(): PersonalBests {
  try {
    const raw = localStorage.getItem(BESTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (isValidBests(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }

  return migrateLegacyData();
}

function saveBests(bests: PersonalBests): void {
  try {
    localStorage.setItem(BESTS_KEY, JSON.stringify(bests));
  } catch {
    /* ignore */
  }
}

function migrateLegacyData(): PersonalBests {
  const bests = createEmptyPersonalBests();

  try {
    const boardRaw = localStorage.getItem(LEGACY_BOARD_KEY);
    if (boardRaw) {
      const parsed = JSON.parse(boardRaw) as unknown;
      if (Array.isArray(parsed)) {
        for (const row of parsed) {
          if (!row || typeof row !== 'object') continue;
          const e = row as Record<string, unknown>;
          const score = typeof e.score === 'number' ? e.score : 0;
          const ducksSaved = typeof e.ducksSaved === 'number' ? e.ducksSaved : 0;
          const longestCombo =
            typeof e.longestCombo === 'number' ? e.longestCombo : 0;
          const timeSurvivedMs =
            typeof e.timeSurvivedMs === 'number' ? e.timeSurvivedMs : 0;

          if (score > bests.bestScore) bests.bestScore = score;
          if (ducksSaved > bests.mostDucksSaved) bests.mostDucksSaved = ducksSaved;
          if (longestCombo > bests.longestCombo) bests.longestCombo = longestCombo;
          if (timeSurvivedMs > bests.longestTimeMs) bests.longestTimeMs = timeSurvivedMs;
        }
      }
    }
  } catch {
    /* ignore */
  }

  const legacyScore = readLegacyHighScore();
  if (legacyScore > bests.bestScore) {
    bests.bestScore = legacyScore;
  }

  if (hasAnyPersonalBests(bests)) {
    saveBests(bests);
  }

  return bests;
}

function readLegacyHighScore(): number {
  try {
    const raw = localStorage.getItem(LEGACY_SCORE_KEY);
    if (raw === null) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function isValidBests(value: unknown): value is PersonalBests {
  if (!value || typeof value !== 'object') return false;
  const b = value as PersonalBests;
  return (
    typeof b.bestScore === 'number' &&
    typeof b.mostDucksSaved === 'number' &&
    typeof b.longestCombo === 'number' &&
    typeof b.longestTimeMs === 'number'
  );
}
