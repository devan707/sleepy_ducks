import Phaser from 'phaser';
import { registerMoonflowerAnimations } from '../assets/MoonflowerAnimations';
import { GameEvents } from '../core/GameEvents';
import { MOONFLOWER } from '../config/gameConfig';
import { Moonflower, MoonflowerTapSuppress } from '../objects/Moonflower';
import type { WaterfallStage } from '../objects/WaterfallStage';
import { MoonflowerCollectToast } from '../ui/MoonflowerCollectToast';
import type { GameplayBottomToast } from '../ui/GameplayBottomToast';

const STAR_SPAWN_THRESHOLD = 0.05;

/** Night collectible — one spawn attempt per run after stars appear (always, even if chest count > 0). */
export class MoonflowerController {
  private scene: Phaser.Scene;
  private stage: WaterfallStage;
  private moonflower: Moonflower | null = null;
  private toast: MoonflowerCollectToast;
  private spawnedThisRun = false;
  private collectedThisRun = false;
  private enabled = true;

  constructor(
    scene: Phaser.Scene,
    stage: WaterfallStage,
    bottomToast: GameplayBottomToast,
  ) {
    this.scene = scene;
    this.stage = stage;
    this.toast = new MoonflowerCollectToast(bottomToast);

    scene.events.on(GameEvents.STARS_VISIBLE, this.onStarsVisible, this);
    scene.events.on(GameEvents.GAME_OVER, this.onGameOver, this);
  }

  static consumeTapSuppress(): boolean {
    return MoonflowerTapSuppress.consume();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      this.trySpawnMoonflower();
    }
  }

  isCollectedThisRun(): boolean {
    return this.collectedThisRun;
  }

  tryTap(worldX: number, worldY: number): boolean {
    if (this.collectedThisRun) return false;
    if (!this.moonflower?.active) return false;
    if (!this.moonflower.containsWorldPoint(worldX, worldY)) return false;
    if (!this.moonflower.tap()) return false;
    this.beginCollect();
    return true;
  }

  destroy(): void {
    this.scene.events.off(GameEvents.STARS_VISIBLE, this.onStarsVisible, this);
    this.scene.events.off(GameEvents.GAME_OVER, this.onGameOver, this);
    this.moonflower?.destroy();
    this.moonflower = null;
  }

  private onStarsVisible(): void {
    this.trySpawnMoonflower();
  }

  private onGameOver(): void {
    this.moonflower?.destroy();
    this.moonflower = null;
  }

  /** Spawn once per run after sunset — independent of charms already in the chest. */
  private trySpawnMoonflower(): void {
    if (!this.enabled || this.spawnedThisRun || this.collectedThisRun) return;
    if (this.stage.getStarVisibility() < STAR_SPAWN_THRESHOLD) return;

    this.spawnedThisRun = true;
    registerMoonflowerAnimations(this.scene);
    this.moonflower = new Moonflower(this.scene, MOONFLOWER.x, MOONFLOWER.y);
  }

  private beginCollect(): void {
    if (!this.moonflower || this.collectedThisRun) return;

    this.collectedThisRun = true;
    this.moonflower.destroy();
    this.moonflower = null;

    this.toast.show({
      onComplete: () => {
        this.scene.events.emit(GameEvents.CHARM_COLLECTED, { id: 'moonflower' });
      },
    });
  }
}
