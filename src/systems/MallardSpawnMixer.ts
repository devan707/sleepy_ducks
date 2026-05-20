import Phaser from 'phaser';
import {
  DUCK_SPAWN,
  DUCK_SPAWN_PROFILES,
  type DuckKind,
  type DuckSex,
} from '../config/gameConfig';
import type { DifficultyManager, MallardSpawnProfile } from './DifficultyManager';
import type { MallardSpawnPick } from './SpawnController';

type MallardKind = Exclude<DuckKind, 'golden' | 'decoy'>;

/** Long-run target rates derived from profile weights. */
export function getDuckSpawnProbabilities(
  profiles: readonly MallardSpawnProfile[] = DUCK_SPAWN_PROFILES,
): {
  profiles: ReadonlyArray<{
    sex: DuckSex;
    kind: MallardKind;
    weight: number;
    percent: number;
  }>;
  malePercent: number;
  femalePercent: number;
  normalPercent: number;
  heavyPercent: number;
} {
  const mapped = profiles.map((p) => ({
    sex: p.sex,
    kind: p.kind,
    weight: p.weight,
    percent: Math.round(p.weight * 1000) / 10,
  }));

  const heavy = profiles
    .filter((p) => p.kind === 'heavy')
    .reduce((sum, p) => sum + p.weight, 0);
  const female = profiles
    .filter((p) => p.sex === 'female')
    .reduce((sum, p) => sum + p.weight, 0);

  return {
    profiles: mapped,
    malePercent: Math.round((1 - female) * 1000) / 10,
    femalePercent: Math.round(female * 1000) / 10,
    normalPercent: Math.round((1 - heavy) * 1000) / 10,
    heavyPercent: Math.round(heavy * 1000) / 10,
  };
}

/**
 * Shuffled quota bag — exact mix per bag, reshuffled each refill.
 * Long-run rates match weights; short streaks are broken up when possible.
 */
export class MallardSpawnMixer {
  private bag: MallardSpawnPick[] = [];
  /** Heavy share when the current bag was built; rebuild when ramp moves. */
  private lastBagHeavyShare = -1;
  private lastBagMaxHeavyStreak = -1;
  /** Consecutive heavies actually spawned — enforces ramp across bag refills. */
  private heavyRunLength = 0;

  constructor(private readonly difficulty: DifficultyManager) {}

  pick(): MallardSpawnPick {
    const heavyShare = this.difficulty.getHeavySpawnShare();
    const maxHeavyStreak = this.difficulty.getMaxHeavyStreak();
    if (
      this.bag.length === 0 ||
      Math.abs(heavyShare - this.lastBagHeavyShare) > 0.005 ||
      maxHeavyStreak !== this.lastBagMaxHeavyStreak
    ) {
      this.lastBagHeavyShare = heavyShare;
      this.lastBagMaxHeavyStreak = maxHeavyStreak;
      this.bag = buildShuffledSpawnBag(
        DUCK_SPAWN.bagSize,
        this.difficulty.getMallardSpawnProfiles(),
        maxHeavyStreak,
      );
    }
    return this.popRespectingHeavyStreak(maxHeavyStreak);
  }

  reset(): void {
    this.bag = [];
    this.lastBagHeavyShare = -1;
    this.lastBagMaxHeavyStreak = -1;
    this.heavyRunLength = 0;
  }

  /** Prefer a non-heavy pick when the run-time streak cap is already met. */
  private popRespectingHeavyStreak(maxHeavyStreak: number): MallardSpawnPick {
    let pick = this.bag.pop()!;

    if (pick.kind === 'heavy' && this.heavyRunLength >= maxHeavyStreak) {
      const altIndex = findLastNonHeavyIndex(this.bag);
      if (altIndex >= 0) {
        const alt = this.bag[altIndex];
        this.bag[altIndex] = pick;
        pick = alt;
      }
    }

    this.heavyRunLength = pick.kind === 'heavy' ? this.heavyRunLength + 1 : 0;
    return pick;
  }
}

function buildShuffledSpawnBag(
  bagSize: number,
  profiles: readonly MallardSpawnProfile[],
  maxHeavyStreak: number,
): MallardSpawnPick[] {
  const slots = profiles.map((profile) => ({
    pick: { sex: profile.sex, kind: profile.kind } satisfies MallardSpawnPick,
    exact: profile.weight * bagSize,
    count: Math.floor(profile.weight * bagSize),
  }));

  let used = slots.reduce((sum, slot) => sum + slot.count, 0);
  const remainders = slots
    .map((slot, index) => ({ index, frac: slot.exact - slot.count }))
    .sort((a, b) => b.frac - a.frac);

  for (let i = 0; used < bagSize; i++) {
    slots[remainders[i % remainders.length].index].count += 1;
    used += 1;
  }

  const bag: MallardSpawnPick[] = [];
  for (const slot of slots) {
    for (let i = 0; i < slot.count; i++) {
      bag.push({ ...slot.pick });
    }
  }

  Phaser.Utils.Array.Shuffle(bag);
  deClusterBag(bag, DUCK_SPAWN.maxSexStreak, (pick, other) => pick.sex === other.sex);
  // Sex de-cluster can undo heavy spacing — always enforce heavy streak last.
  deClusterBag(bag, maxHeavyStreak, (pick, ref) => pick.kind === 'heavy' && ref.kind === 'heavy');

  return bag;
}

function findLastNonHeavyIndex(bag: MallardSpawnPick[]): number {
  for (let i = bag.length - 1; i >= 0; i--) {
    if (bag[i].kind !== 'heavy') return i;
  }
  return -1;
}

/** Swap away runs longer than maxStreak when another slot exists (repeat until stable). */
function deClusterBag(
  bag: MallardSpawnPick[],
  maxStreak: number,
  matches: (pick: MallardSpawnPick, ref: MallardSpawnPick) => boolean,
): void {
  if (maxStreak < 1 || bag.length <= maxStreak) return;

  const maxPasses = bag.length * 2;
  for (let pass = 0; pass < maxPasses; pass++) {
    let swapped = false;
    let streakStart = 0;
    for (let i = 1; i <= bag.length; i++) {
      const streakBroken =
        i === bag.length || !matches(bag[i], bag[streakStart]);
      if (!streakBroken) continue;

      const streakLen = i - streakStart;
      if (streakLen > maxStreak) {
        const ref = bag[streakStart];
        const swapFrom = bag.findIndex(
          (pick, idx) => idx >= i && !matches(pick, ref),
        );
        if (swapFrom >= 0) {
          const swapTo = streakStart + maxStreak;
          [bag[swapTo], bag[swapFrom]] = [bag[swapFrom], bag[swapTo]];
          swapped = true;
          break;
        }
      }
      streakStart = i;
    }
    if (!swapped) break;
  }
}
