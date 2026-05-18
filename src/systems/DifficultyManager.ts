import { DIFFICULTY } from '../config/gameConfig';

export interface MotionDifficulty {
  crestDurationMs: number;
  gravity: number;
  maxFallVelocity: number;
}

export class DifficultyManager {
  private elapsedSec = 0;

  reset(): void {
    this.elapsedSec = 0;
  }

  update(deltaMs: number): void {
    this.elapsedSec += deltaMs / 1000;
  }

  /** Dev watch mode: jump run clock (sunset, spawns, difficulty). */
  skipElapsedSeconds(sec: number): void {
    this.elapsedSec = Math.max(0, this.elapsedSec + sec);
  }

  get elapsedSeconds(): number {
    return this.elapsedSec;
  }

  getMotionParams(): MotionDifficulty {
    const {
      baseCrestDurationMs,
      minCrestDurationMs,
      crestDurationRamp,
      baseGravity,
      maxGravity,
      gravityRamp,
      maxFallVelocity,
    } = DIFFICULTY;

    return {
      crestDurationMs: Math.max(
        minCrestDurationMs,
        baseCrestDurationMs - this.elapsedSec * crestDurationRamp,
      ),
      gravity: Math.min(maxGravity, baseGravity + this.elapsedSec * gravityRamp),
      maxFallVelocity,
    };
  }

  getSpawnIntervalMs(): number {
    const { baseSpawnInterval, minSpawnInterval, intervalRamp } = DIFFICULTY;
    return Math.max(
      minSpawnInterval,
      baseSpawnInterval - this.elapsedSec * intervalRamp,
    );
  }

  getMaxConcurrent(): number {
    const { maxConcurrentBase, maxConcurrentCap, concurrentRampSec } = DIFFICULTY;
    const t = Phaser.Math.Clamp(this.elapsedSec / concurrentRampSec, 0, 1);
    const eased = t * t * (3 - 2 * t);
    return Math.round(
      maxConcurrentBase + (maxConcurrentCap - maxConcurrentBase) * eased,
    );
  }
}
