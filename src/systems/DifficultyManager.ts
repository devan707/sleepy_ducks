import {
  DECOY_SPAWN,
  DIFFICULTY,
  COMBO,
  DUCK_SPAWN,
  DUCK_SPAWN_PROFILES,
  getMaxHeavyStreakAtSec,
  type DuckKind,
  type DuckSex,
} from '../config/gameConfig';

export type MallardSpawnProfile = {
  sex: DuckSex;
  kind: Exclude<DuckKind, 'golden' | 'decoy'>;
  weight: number;
};

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

function getLatestLateSpike(elapsedSec: number): (typeof DIFFICULTY.lateSpikes)[number] | null {
  let latest: (typeof DIFFICULTY.lateSpikes)[number] | null = null;
  for (const spike of DIFFICULTY.lateSpikes) {
    if (elapsedSec >= spike.atSec) latest = spike;
  }
  return latest;
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
    const interval = Math.round(
      tailRamp(
        this.elapsedSec,
        intensityRampSec,
        tailStart,
        minSpawnInterval,
        postRampSpawnIntervalSec,
      ),
    );
    const spike = getLatestLateSpike(this.elapsedSec);
    if (spike) {
      return Math.min(interval, spike.spawnIntervalMs);
    }
    return Math.max(minSpawnInterval, interval);
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

    const base = maxConcurrentByStep[maxConcurrentByStep.length - 1];
    const spike = getLatestLateSpike(this.elapsedSec);
    return spike ? Math.max(base, spike.maxConcurrent) : base;
  }

  /** Total heavy-sleeper share among mallard spawns (0–1), ramped over the first minute. */
  getHeavySpawnShare(): number {
    const { intensityStepSec, intensityRampSec, heavyShareByStep } =
      DUCK_SPAWN.heavyShareRamp;
    return sampleSteppedRamp(
      this.elapsedSec,
      heavyShareByStep,
      intensityStepSec,
      intensityRampSec,
    );
  }

  /** Max consecutive heavy sleepers in the current spawn bag (ramps at 0 / 10 / 30 / 60s). */
  getMaxHeavyStreak(): number {
    return getMaxHeavyStreakAtSec(this.elapsedSec);
  }

  /** Mallard spawn weights for the current run time (sums to 1). */
  getMallardSpawnProfiles(): MallardSpawnProfile[] {
    const heavyShare = this.getHeavySpawnShare();
    const baseHeavy = DUCK_SPAWN_PROFILES.filter((p) => p.kind === 'heavy').reduce(
      (sum, p) => sum + p.weight,
      0,
    );
    const baseNormal = 1 - baseHeavy;
    const normalShare = 1 - heavyShare;

    const profileWeight = (
      sex: DuckSex,
      kind: Exclude<DuckKind, 'golden' | 'decoy'>,
    ): number => {
      const base = DUCK_SPAWN_PROFILES.find((p) => p.sex === sex && p.kind === kind)!;
      if (kind === 'heavy') {
        return heavyShare * (base.weight / baseHeavy);
      }
      return normalShare * (base.weight / baseNormal);
    };

    return [
      { sex: 'male', kind: 'normal', weight: profileWeight('male', 'normal') },
      { sex: 'female', kind: 'normal', weight: profileWeight('female', 'normal') },
      { sex: 'male', kind: 'heavy', weight: profileWeight('male', 'heavy') },
      { sex: 'female', kind: 'heavy', weight: profileWeight('female', 'heavy') },
    ];
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
