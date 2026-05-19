import Phaser from 'phaser';
import {
  DUCK_SPAWN,
  DUCK_SPAWN_PROFILES,
  type DuckKind,
  type DuckSex,
} from '../config/gameConfig';
import type { MallardSpawnPick } from './SpawnController';

type MallardKind = Exclude<DuckKind, 'golden' | 'decoy'>;

/** Long-run target rates derived from profile weights. */
export function getDuckSpawnProbabilities(): {
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
  const profiles = DUCK_SPAWN_PROFILES.map((p) => ({
    sex: p.sex,
    kind: p.kind,
    weight: p.weight,
    percent: Math.round(p.weight * 1000) / 10,
  }));

  const heavy = DUCK_SPAWN_PROFILES
    .filter((p) => p.kind === 'heavy')
    .reduce((sum, p) => sum + p.weight, 0);
  const female = DUCK_SPAWN_PROFILES
    .filter((p) => p.sex === 'female')
    .reduce((sum, p) => sum + p.weight, 0);

  return {
    profiles,
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

  pick(): MallardSpawnPick {
    if (this.bag.length === 0) {
      this.bag = buildShuffledSpawnBag(DUCK_SPAWN.bagSize);
    }
    return this.bag.pop()!;
  }

  reset(): void {
    this.bag = [];
  }
}

function buildShuffledSpawnBag(bagSize: number): MallardSpawnPick[] {
  const slots = DUCK_SPAWN_PROFILES.map((profile) => ({
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
  deClusterBag(bag, DUCK_SPAWN.maxHeavyStreak, (pick) => pick.kind === 'heavy');
  deClusterBag(bag, DUCK_SPAWN.maxSexStreak, (pick, other) => pick.sex === other.sex);

  return bag;
}

/** Swap away runs longer than maxStreak when another slot exists. */
function deClusterBag(
  bag: MallardSpawnPick[],
  maxStreak: number,
  matches: (pick: MallardSpawnPick, ref: MallardSpawnPick) => boolean,
): void {
  if (maxStreak < 2 || bag.length <= maxStreak) return;

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
      }
    }
    streakStart = i;
  }
}
