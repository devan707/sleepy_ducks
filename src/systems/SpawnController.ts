import Phaser from 'phaser';
import {
  DUCK,
  DUCK_SPAWN_PROFILES,
  GOLDEN_REWARD,
  SPAWN_DECOY_CHANCE,
  type DuckKind,
  type DuckSex,
} from '../config/gameConfig';
import type { Duck } from '../objects/Duck';
import { createDuck } from '../objects/DuckFactory';
import type { StageLayout, WaterfallStage } from '../objects/WaterfallStage';
import type { DifficultyManager } from './DifficultyManager';

export type SpawnPick =
  | { entity: 'duck'; sex: DuckSex; kind: DuckKind }
  | { entity: 'decoy' };

export class SpawnController {
  private scene: Phaser.Scene;
  private difficulty: DifficultyManager;
  private ducks: Phaser.GameObjects.Group;
  private layout: StageLayout;
  private waterfallStage: WaterfallStage;
  private timer: Phaser.Time.TimerEvent | null = null;
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
    this.scheduleNext();
  }

  stop(): void {
    if (this.timer) {
      this.timer.remove(false);
      this.timer = null;
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

  private scheduleNext(): void {
    const delay = this.difficulty.getSpawnIntervalMs();
    this.timer = this.scene.time.addEvent({
      delay,
      callback: () => this.trySpawn(),
      callbackScope: this,
    });
  }

  private trySpawn(): void {
    const max = this.difficulty.getMaxConcurrent();
    const alive = this.ducks.getChildren().filter((c) => {
      const duck = c as unknown as Duck;
      return duck.active && duck.isSleeping();
    }).length;

    if (alive < max) {
      this.spawnEntity();
    }
    this.scheduleNext();
  }

  pickSpawn(): SpawnPick {
    const r = Math.random();
    if (r < SPAWN_DECOY_CHANCE) {
      return { entity: 'decoy' };
    }

    const mallardR = Math.random();
    let acc = 0;
    for (const profile of DUCK_SPAWN_PROFILES) {
      acc += profile.weight;
      if (mallardR < acc) {
        return { entity: 'duck', sex: profile.sex, kind: profile.kind };
      }
    }

    const last = DUCK_SPAWN_PROFILES[DUCK_SPAWN_PROFILES.length - 1];
    return { entity: 'duck', sex: last.sex, kind: last.kind };
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

  private spawnEntity(): void {
    const spawnX = this.pickSpawnX();
    if (spawnX === null) return;

    const pick = this.pickSpawn();
    if (pick.entity === 'decoy') {
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
      return;
    }

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

  destroy(): void {
    this.stop();
  }
}
