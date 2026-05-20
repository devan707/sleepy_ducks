import Phaser from 'phaser';
import { registerDreamweedAnimations } from '../assets/DreamweedAnimations';
import { CHARMS } from '../config/charmConfig';
import { DREAMWEED } from '../config/gameConfig';
import { GameEvents } from '../core/GameEvents';
import { Dreamweed, DreamweedGrabSuppress } from '../objects/Dreamweed';
import { recordCharmCollect } from '../storage/charms';
import type { WaterfallStage } from '../objects/WaterfallStage';

/** Falling dreamweed at the waterfall lip — swipe to collect. */
export class DreamweedController {
  private scene: Phaser.Scene;
  private stage: WaterfallStage;
  private activeDreamweed: Dreamweed | null = null;
  private spawnTimer: Phaser.Time.TimerEvent | null = null;
  private grabbedDreamweed: Dreamweed | null = null;
  private grabStartX = 0;
  private enabled = true;
  private running = false;
  private runCollectCount = 0;

  constructor(scene: Phaser.Scene, stage: WaterfallStage) {
    this.scene = scene;
    this.stage = stage;
    scene.events.on(GameEvents.GAME_OVER, this.onGameOver, this);
  }

  static consumeGrabSuppress(): boolean {
    return DreamweedGrabSuppress.consume();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clearSpawnTimer();
      this.releaseGrab();
    } else if (this.running) {
      this.scheduleNextSpawn();
    }
  }

  start(): void {
    this.running = true;
    this.runCollectCount = 0;
    if (this.enabled) {
      this.scheduleNextSpawn();
    }
  }

  stop(): void {
    this.running = false;
    this.clearSpawnTimer();
    this.releaseGrab();
    this.destroyActiveDreamweed();
  }

  getRunCollectCount(): number {
    return this.runCollectCount;
  }

  tryBeginGrab(worldX: number, worldY: number): boolean {
    if (!this.enabled || !this.activeDreamweed?.active) return false;
    if (!this.activeDreamweed.containsWorldPoint(worldX, worldY)) return false;
    if (!this.activeDreamweed.tryBeginGrab()) return false;
    this.grabbedDreamweed = this.activeDreamweed;
    this.grabStartX = worldX;
    return true;
  }

  containsWorldPoint(worldX: number, worldY: number): boolean {
    return this.activeDreamweed?.containsWorldPoint(worldX, worldY) ?? false;
  }

  trySwipeCollect(worldX: number, gestureStartX?: number): boolean {
    if (!this.grabbedDreamweed?.active) return false;
    const dxGrab = worldX - this.grabStartX;
    const dxGesture =
      gestureStartX != null ? worldX - gestureStartX : dxGrab;
    const dx =
      Math.abs(dxGrab) >= Math.abs(dxGesture) ? dxGrab : dxGesture;
    if (!this.grabbedDreamweed.trySwipeCollect(dx)) return false;
    this.collect();
    return true;
  }

  /**
   * Collect a rock-snagged weed with a horizontal swipe — no grab required.
   * Pointer must pass near the weed at swipe start or end.
   */
  trySwipeCollectSnagged(
    gestureStartX: number,
    worldX: number,
    worldY: number,
  ): boolean {
    const weed = this.activeDreamweed;
    if (!weed?.active || !weed.isRockSnagged()) return false;

    const dx = worldX - gestureStartX;
    if (Math.abs(dx) < DREAMWEED.swipeMinPx) return false;

    const nearPad = DREAMWEED.rockSnagHitPad;
    const nearWeed =
      weed.isNearWorldPoint(worldX, worldY, nearPad) ||
      weed.isNearWorldPoint(gestureStartX, worldY, nearPad) ||
      weed.isNearWorldPoint((gestureStartX + worldX) * 0.5, worldY, nearPad);
    if (!nearWeed) return false;

    this.collect();
    return true;
  }

  releaseGrab(): void {
    this.grabbedDreamweed?.releaseGrab();
    this.grabbedDreamweed = null;
    this.grabStartX = 0;
    DreamweedGrabSuppress.reset();
  }

  update(delta: number): void {
    if (!this.activeDreamweed?.active) return;
    this.activeDreamweed.updateMotion(delta);
    if (this.activeDreamweed.isOffScreen()) {
      this.destroyActiveDreamweed();
      if (this.running && this.enabled) {
        this.scheduleNextSpawn();
      }
    }
  }

  destroy(): void {
    this.stop();
    this.scene.events.off(GameEvents.GAME_OVER, this.onGameOver, this);
  }

  private onGameOver(): void {
    this.stop();
  }

  private scheduleNextSpawn(): void {
    this.clearSpawnTimer();
    if (!this.running || !this.enabled || this.activeDreamweed) return;

    const delay = Phaser.Math.Between(
      DREAMWEED.spawnIntervalMinMs,
      DREAMWEED.spawnIntervalMaxMs,
    );
    this.spawnTimer = this.scene.time.delayedCall(delay, () => {
      this.spawnTimer = null;
      this.spawnFromPool();
    });
  }

  /** Left-biased lane X — same idea as mallard crest spawns. */
  private pickSpawnX(): number {
    const { laneMinX, laneMaxX } = this.stage.getLayout();
    const width = laneMaxX - laneMinX;
    const t = Math.pow(Math.random(), 1.45);
    return laneMinX + Math.round(t * width);
  }

  private spawnFromPool(): void {
    if (!this.running || !this.enabled || this.activeDreamweed) return;
    registerDreamweedAnimations(this.scene);

    const crestStartX = this.pickSpawnX();
    const fallSpin = Phaser.Math.FloatBetween(
      DREAMWEED.spinSpeedMin,
      DREAMWEED.spinSpeedMax,
    ) * (Math.random() < 0.5 ? -1 : 1);
    const fallRotation = Phaser.Math.FloatBetween(
      DREAMWEED.spawnRotationMin,
      DREAMWEED.spawnRotationMax,
    );

    this.activeDreamweed = new Dreamweed(
      this.scene,
      crestStartX,
      this.stage.getLayout(),
      this.stage,
      fallSpin,
      fallRotation,
    );
  }

  private collect(): void {
    const weed = this.grabbedDreamweed ?? this.activeDreamweed;
    if (!weed) return;

    const world = new Phaser.Math.Vector2();
    weed.getWorldTransformMatrix().transformPoint(0, 0, world);
    const fromX = world.x;
    const fromY = world.y;

    this.grabbedDreamweed = null;
    this.grabStartX = 0;
    DreamweedGrabSuppress.reset();
    this.destroyActiveDreamweed();

    this.runCollectCount += 1;
    recordCharmCollect('dreamweed', CHARMS.dreamweed.slotIndex);
    this.scene.events.emit(GameEvents.CHARM_COLLECTED, {
      id: 'dreamweed',
      x: fromX,
      y: fromY,
    });

    if (this.running && this.enabled) {
      this.scheduleNextSpawn();
    }
  }

  private destroyActiveDreamweed(): void {
    this.activeDreamweed?.destroy();
    this.activeDreamweed = null;
    if (this.grabbedDreamweed && !this.grabbedDreamweed.active) {
      this.grabbedDreamweed = null;
    }
  }

  private clearSpawnTimer(): void {
    this.spawnTimer?.remove(false);
    this.spawnTimer = null;
  }
}
