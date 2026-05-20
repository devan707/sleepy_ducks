import Phaser from 'phaser';
import { registerMoonflowerAnimations } from '../assets/MoonflowerAnimations';
import { GameEvents } from '../core/GameEvents';
import { MOONFLOWER } from '../config/gameConfig';
import { Moonflower, MoonflowerTapSuppress } from '../objects/Moonflower';
import type { WaterfallStage } from '../objects/WaterfallStage';
import { recordCharmCollect } from '../storage/charms';

/** Night collectible — one sprout sequence per run, scheduled from the HUD clock. */
export class MoonflowerController {
  private scene: Phaser.Scene;
  private moonflower: Moonflower | null = null;
  private spawnedThisRun = false;
  private collectedThisRun = false;
  private enabled = true;

  constructor(scene: Phaser.Scene, _stage: WaterfallStage) {
    this.scene = scene;

    scene.events.on(GameEvents.GAME_OVER, this.onGameOver, this);
  }

  static consumeTapSuppress(): boolean {
    return MoonflowerTapSuppress.consume();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isCollectedThisRun(): boolean {
    return this.collectedThisRun;
  }

  /** Begin sprout animation once the HUD clock reaches its scheduled second. */
  spawnForRun(): void {
    if (!this.enabled || this.spawnedThisRun || this.collectedThisRun) return;

    this.spawnedThisRun = true;
    registerMoonflowerAnimations(this.scene);
    this.moonflower = new Moonflower(this.scene, MOONFLOWER.x, MOONFLOWER.y);
  }

  tryTap(worldX: number, worldY: number): boolean {
    if (this.collectedThisRun) return false;
    if (!this.moonflower?.active) return false;
    if (!this.moonflower.containsWorldPoint(worldX, worldY)) return false;
    if (!this.moonflower.tap()) return false;
    this.beginCollect();
    return true;
  }

  containsWorldPoint(worldX: number, worldY: number): boolean {
    if (this.collectedThisRun || !this.moonflower?.active) return false;
    return this.moonflower.containsWorldPoint(worldX, worldY);
  }

  destroy(): void {
    this.scene.events.off(GameEvents.GAME_OVER, this.onGameOver, this);
    this.moonflower?.destroy();
    this.moonflower = null;
  }

  private onGameOver(): void {
    this.moonflower?.destroy();
    this.moonflower = null;
  }

  private beginCollect(): void {
    if (!this.moonflower || this.collectedThisRun) return;

    const world = new Phaser.Math.Vector2();
    this.moonflower.getWorldTransformMatrix().transformPoint(0, 0, world);
    const fromX = world.x;
    const fromY = world.y;
    this.collectedThisRun = true;
    this.moonflower.destroy();
    this.moonflower = null;

    recordCharmCollect('moonflower', 0);
    this.scene.events.emit(GameEvents.CHARM_COLLECTED, {
      id: 'moonflower',
      x: fromX,
      y: fromY,
    });
  }
}
