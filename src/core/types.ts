import type { RunStats } from '../models/RunStats';

export type GameOverOutcome = 'failed' | 'passed' | 'passedWithMoonflower';

/** Payload passed between scenes when a run ends. */
export interface GameOverData {
  score: number;
  stats: RunStats;
  isNewHighScore: boolean;
  isNewLongestTime: boolean;
  /** Reached nightfall this run. */
  levelPassed: boolean;
  moonflowerCollected: boolean;
  outcome: GameOverOutcome;
}

/** Future: hook for meta-progression (unlocks, XP, etc.). */
export interface ProgressionSystem {
  onRunComplete(data: GameOverData): void;
}

/** Future: hook for soft currency / rewards. */
export interface RewardSystem {
  grantRunRewards(data: GameOverData): void;
}

/** Future: hook for friends / leaderboards. */
export interface SocialSystem {
  shareRun?(data: GameOverData): void;
}
