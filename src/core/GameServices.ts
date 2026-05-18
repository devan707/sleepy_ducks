import type { ProgressionSystem, RewardSystem, SocialSystem } from './types';

/**
 * Central registry for future meta-systems (progression, economy, social).
 * Wire implementations here when those features ship.
 */
export class GameServices {
  progression: ProgressionSystem | null = null;
  rewards: RewardSystem | null = null;
  social: SocialSystem | null = null;

  private static instance: GameServices | null = null;

  static getInstance(): GameServices {
    if (!GameServices.instance) {
      GameServices.instance = new GameServices();
    }
    return GameServices.instance;
  }
}
