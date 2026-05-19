import Phaser from 'phaser';
import {
  DECOY_SPAWN,
  DUCK,
  DUCK_SPAWN_PROFILES,
  DIFFICULTY,
  GOLDEN_REWARD,
  type DuckKind,
  type DuckSex,
} from '../config/gameConfig';
import type { Duck } from '../objects/Duck';
import { createDuck } from '../objects/DuckFactory';
import type { StageLayout, WaterfallStage } from '../objects/WaterfallStage';
import type { DifficultyManager } from './DifficultyManager';

export type MallardSpawnPick = {
  sex: DuckSex;
  kind: Exclude<DuckKind, 'golden' | 'decoy'>;
};

export class SpawnController {
  private scene: Phaser.Scene;
  private difficulty: DifficultyManager;
  private ducks: Phaser.GameObjects.Group;
  private layout: StageLayout;
  private waterfallStage: WaterfallStage;
  private timer: Phaser.Time.TimerEvent | null = null;
  private decoyTimer: Phaser.Time.TimerEvent | null = null;
  private goldenTimer: Phaser.Time.TimerEvent | null = null;

  constructor(
    scene: Phaser.Scene,
    difficulty: DifficultyManager,
    ducks: Phaser.GameObjects.Group,
    layout: StageLayout,
    waterfallStage: WaterfallStage,
  ) {
    this.scene = scene;
    this.difficulty = difficulty;
    this.ducks = ducks;
    this.layout = layout;
    this.waterfallStage = waterfallStage;
  }

  start(): void {
    for (let i = 0; i < DIFFICULTY.initialSpawnCount; i++) {
      this.spawnMallard();
    }
    this.scheduleNextMallard();
    this.scheduleNextDecoy();
  }

  stop(): void {
    if (this.timer) {
      this.timer.remove(false);
      this.timer = null;
    }
    if (this.decoyTimer) {
      this.decoyTimer.remove(false);
      this.decoyTimer = null;
    }
    this.cancelGoldenReward();
  }

  /** Schedule a golden skyfall 1–10s after the player loses a life (while still alive). */
  scheduleGoldenAfterLifeLoss(): void {
    this.cancelGoldenReward();
    if (this.hasActiveGolden()) return;

    const delay = Phaser.Math.Between(
      GOLDEN_REWARD.minDelayMs,
      GOLDEN_REWARD.maxDelayMs,
    );
    this.goldenTimer = this.scene.time.addEvent({
      delay,
      callback: () => {
        this.goldenTimer = null;
        this.trySpawnGoldenReward();
      },
      callbackScope: this,
    });
  }

  private cancelGoldenReward(): void {
    if (this.goldenTimer) {
      this.goldenTimer.remove(false);
      this.goldenTimer = null;
    }
  }

  private hasActiveGolden(): boolean {
    return (this.ducks.getChildren() as Duck[]).some(
      (d) => d.active && d.kind === 'golden',
    );
  }

  private trySpawnGoldenReward(): void {
    if (this.hasActiveGolden()) return;

    const spawnX = this.pickSpawnX();
    if (spawnX === null) return;

    const sex: DuckSex = Math.random() < 0.5 ? 'male' : 'female';
    const duck = createDuck(
      this.scene,
      sex,
      'golden',
      this.layout,
      this.waterfallStage,
      spawnX,
    );
    this.ducks.add(duck);
    this.scene.events.emit('duck-spawned', duck);
  }

  private scheduleNextMallard(): void {
    const delay = this.difficulty.getSpawnIntervalMs();
    this.timer = this.scene.time.addEvent({
      delay,
      callback: () => this.trySpawnMallard(),
      callbackScope: this,
    });
  }

  private scheduleNextDecoy(): void {
    const elapsed = this.difficulty.elapsedSeconds;
    const delay =
      elapsed < DECOY_SPAWN.minElapsedSec
        ? Math.max(250, (DECOY_SPAWN.minElapsedSec - elapsed) * 1000)
        : this.difficulty.getDecoySpawnIntervalMs();

    this.decoyTimer = this.scene.time.addEvent({
      delay,
      callback: () => {
        this.trySpawnDecoy();
        this.scheduleNextDecoy();
      },
      callbackScope: this,
    });
  }

  private countSleepingMallards(): number {
    return (this.ducks.getChildren() as Duck[]).filter(
      (d) =>
        d.active &&
        d.isSleeping() &&
        d.kind !== 'decoy' &&
        d.kind !== 'golden',
    ).length;
  }

  private countSleepingDecoys(): number {
    return (this.ducks.getChildren() as Duck[]).filter(
      (d) => d.active && d.isSleeping() && d.kind === 'decoy',
    ).length;
  }

  private trySpawnMallard(): void {
    const max = this.difficulty.getMaxConcurrent();
    if (this.countSleepingMallards() < max) {
      this.spawnMallard();
    }
    this.scheduleNextMallard();
  }

  private trySpawnDecoy(): void {
    if (this.difficulty.elapsedSeconds < DECOY_SPAWN.minElapsedSec) return;

    const maxDecoys = this.difficulty.getMaxConcurrentDecoys();
    if (maxDecoys <= 0 || this.countSleepingDecoys() >= maxDecoys) return;

    this.spawnDecoy();
  }

  pickMallardSpawn(): MallardSpawnPick {
    const mallardR = Math.random();
    let acc = 0;
    for (const profile of DUCK_SPAWN_PROFILES) {
      acc += profile.weight;
      if (mallardR < acc) {
        return { sex: profile.sex, kind: profile.kind };
      }
    }

    const last = DUCK_SPAWN_PROFILES[DUCK_SPAWN_PROFILES.length - 1];
    return { sex: last.sex, kind: last.kind };
  }

  /** Bias toward screen-left; crest drift pushes ducks right as they rise. */
  private randomLaneX(): number {
    const { laneMinX, laneMaxX } = this.layout;
    const width = laneMaxX - laneMinX;
    const t = Math.pow(Math.random(), 1.45);
    return laneMinX + Math.round(t * width);
  }

  /** Pick lane X far enough from other sleeping ducks; null = skip this spawn tick. */
  private pickSpawnX(): number | null {
    const minSep = DUCK.minSpawnSeparationX;
    const occupied = (this.ducks.getChildren() as Duck[])
      .filter((d) => d.active && d.isSleeping())
      .map((d) => d.x);

    if (occupied.length === 0) {
      return this.randomLaneX();
    }

    for (let i = 0; i < DUCK.spawnPositionAttempts; i++) {
      const x = this.randomLaneX();
      const gap = Math.min(...occupied.map((ox) => Math.abs(ox - x)));
      if (gap >= minSep) return x;
    }

    return null;
  }

  private spawnMallard(): void {
    const pick = this.pickMallardSpawn();
    const spawnX = this.pickSpawnX();
    if (spawnX === null) return;

    const duck = createDuck(
      this.scene,
      pick.sex,
      pick.kind,
      this.layout,
      this.waterfallStage,
      spawnX,
    );
    this.ducks.add(duck);
    this.scene.events.emit('duck-spawned', duck);
  }

  private spawnDecoy(): void {
    let spawnX = this.pickSpawnX();
    if (spawnX === null) {
      for (let i = 0; i < 4; i++) {
        spawnX = this.pickSpawnX();
        if (spawnX !== null) break;
      }
    }
    if (spawnX === null) return;

    const duck = createDuck(
      this.scene,
      'male',
      'decoy',
      this.layout,
      this.waterfallStage,
      spawnX,
    );
    this.ducks.add(duck);
    this.scene.events.emit('duck-spawned', duck);
  }

  destroy(): void {
    this.stop();
  }
}
