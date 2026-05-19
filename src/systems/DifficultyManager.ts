import { DECOY_SPAWN, DIFFICULTY, COMBO } from '../config/gameConfig';

export interface MotionDifficulty {
  crestDurationMs: number;
  gravity: number;
  maxFallVelocity: number;
}

/** Linear interpolate across stepped keyframes (0, 10s, 20s …). */
function sampleSteppedRamp(
  elapsedSec: number,
  steps: readonly number[],
  stepSec: number,
  rampSec: number,
): number {
  const t = Math.min(Math.max(elapsedSec, 0), rampSec);
  const idx = t / stepSec;
  const i0 = Math.min(Math.floor(idx), steps.length - 2);
  const i1 = i0 + 1;
  const frac = Phaser.Math.Clamp(idx - i0, 0, 1);
  return Phaser.Math.Linear(steps[i0], steps[i1], frac);
}

function tailRamp(
  elapsedSec: number,
  rampEndSec: number,
  startValue: number,
  endValue: number,
  tailSec: number,
): number {
  const tailT = Phaser.Math.Clamp((elapsedSec - rampEndSec) / tailSec, 0, 1);
  return Phaser.Math.Linear(startValue, endValue, tailT);
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

  /** Current 10s intensity tier (0 at start, 6 by 60s). */
  getIntensityStepIndex(): number {
    const { intensityStepSec, intensityRampSec } = DIFFICULTY;
    return Math.min(
      Math.floor(this.elapsedSec / intensityStepSec),
      intensityRampSec / intensityStepSec,
    );
  }

  getMotionParams(): MotionDifficulty {
    const {
      intensityStepSec,
      intensityRampSec,
      crestDurationByStep,
      gravityByStep,
      minCrestDurationMs,
      maxGravity,
      maxFallVelocity,
      postRampSpawnIntervalSec,
    } = DIFFICULTY;

    let crestDurationMs: number;
    let gravity: number;

    if (this.elapsedSec <= intensityRampSec) {
      crestDurationMs = sampleSteppedRamp(
        this.elapsedSec,
        crestDurationByStep,
        intensityStepSec,
        intensityRampSec,
      );
      gravity = sampleSteppedRamp(
        this.elapsedSec,
        gravityByStep,
        intensityStepSec,
        intensityRampSec,
      );
    } else {
      const crestStart = crestDurationByStep[crestDurationByStep.length - 1];
      const gravityStart = gravityByStep[gravityByStep.length - 1];
      crestDurationMs = tailRamp(
        this.elapsedSec,
        intensityRampSec,
        crestStart,
        minCrestDurationMs,
        postRampSpawnIntervalSec,
      );
      gravity = tailRamp(
        this.elapsedSec,
        intensityRampSec,
        gravityStart,
        maxGravity,
        postRampSpawnIntervalSec,
      );
    }

    return {
      crestDurationMs: Math.max(minCrestDurationMs, crestDurationMs),
      gravity: Math.min(maxGravity, gravity),
      maxFallVelocity,
    };
  }

  getSpawnIntervalMs(): number {
    const {
      intensityStepSec,
      intensityRampSec,
      spawnIntervalByStep,
      minSpawnInterval,
      postRampSpawnIntervalSec,
    } = DIFFICULTY;

    if (this.elapsedSec <= intensityRampSec) {
      return Math.round(
        sampleSteppedRamp(
          this.elapsedSec,
          spawnIntervalByStep,
          intensityStepSec,
          intensityRampSec,
        ),
      );
    }

    const tailStart = spawnIntervalByStep[spawnIntervalByStep.length - 1];
    return Math.round(
      Math.max(
        minSpawnInterval,
        tailRamp(
          this.elapsedSec,
          intensityRampSec,
          tailStart,
          minSpawnInterval,
          postRampSpawnIntervalSec,
        ),
      ),
    );
  }

  getMaxConcurrent(): number {
    const { intensityStepSec, intensityRampSec, maxConcurrentByStep } = DIFFICULTY;

    if (this.elapsedSec <= intensityRampSec) {
      return Math.round(
        sampleSteppedRamp(
          this.elapsedSec,
          maxConcurrentByStep,
          intensityStepSec,
          intensityRampSec,
        ),
      );
    }

    return maxConcurrentByStep[maxConcurrentByStep.length - 1];
  }

  /** Ms until the next decoy spawn attempt (separate from mallard schedule). */
  getDecoySpawnIntervalMs(): number {
    const {
      minElapsedSec,
      intensityStepSec,
      intensityRampSec,
      intervalByStep,
      minIntervalMs,
      postRampIntervalSec,
    } = DECOY_SPAWN;

    const decoyElapsed = this.elapsedSec - minElapsedSec;
    if (decoyElapsed <= 0) {
      return intervalByStep[0];
    }

    if (decoyElapsed <= intensityRampSec) {
      return Math.round(
        sampleSteppedRamp(
          decoyElapsed,
          intervalByStep,
          intensityStepSec,
          intensityRampSec,
        ),
      );
    }

    const tailStart = intervalByStep[intervalByStep.length - 1];
    return Math.round(
      Math.max(
        minIntervalMs,
        tailRamp(
          decoyElapsed,
          intensityRampSec,
          tailStart,
          minIntervalMs,
          postRampIntervalSec,
        ),
      ),
    );
  }

  getMaxConcurrentDecoys(): number {
    const {
      minElapsedSec,
      intensityStepSec,
      intensityRampSec,
      maxConcurrentByStep,
    } = DECOY_SPAWN;

    if (this.elapsedSec < minElapsedSec) return 0;

    const decoyElapsed = this.elapsedSec - minElapsedSec;
    if (decoyElapsed <= intensityRampSec) {
      return Math.round(
        sampleSteppedRamp(
          decoyElapsed,
          maxConcurrentByStep,
          intensityStepSec,
          intensityRampSec,
        ),
      );
    }

    return maxConcurrentByStep[maxConcurrentByStep.length - 1];
  }

  /** Combo meter drain rate — generous window; eases slightly as streaks grow. */
  getComboDrainMultiplier(combo: number): number {
    const { spawnIntervalByStep, minSpawnInterval } = DIFFICULTY;
    const {
      drainMultAtStart,
      drainMultAtPeak,
      streakDrainReliefPerLevel,
      streakDrainReliefMax,
    } = COMBO;
    const startInterval = spawnIntervalByStep[0];
    const current = this.getSpawnIntervalMs();
    const span = startInterval - minSpawnInterval;
    const t = span > 0 ? Phaser.Math.Clamp((startInterval - current) / span, 0, 1) : 1;
    const difficultyMult = Phaser.Math.Linear(drainMultAtStart, drainMultAtPeak, t);

    const streakLevels = Math.max(0, combo - 2);
    const streakRelief = Math.min(
      streakDrainReliefMax,
      streakLevels * streakDrainReliefPerLevel,
    );

    return difficultyMult * (1 - streakRelief);
  }
}
