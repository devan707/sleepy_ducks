import Phaser from 'phaser';
import { registerMoonflowerAnimations } from '../assets/MoonflowerAnimations';
import { GameEvents } from '../core/GameEvents';
import { MOONFLOWER } from '../config/gameConfig';
import { Moonflower, MoonflowerTapSuppress } from '../objects/Moonflower';
import type { WaterfallStage } from '../objects/WaterfallStage';
import { MoonflowerCollectToast } from '../ui/MoonflowerCollectToast';
import type { GameplayBottomToast } from '../ui/GameplayBottomToast';
export class MoonflowerController {
  private scene: Phaser.Scene;
  private moonflower: Moonflower | null = null;
  private toast: MoonflowerCollectToast;
  private spawnedThisRun = false;
  private collectedThisRun = false;
  private enabled = true;

  constructor(
    scene: Phaser.Scene,
    _stage: WaterfallStage,
    bottomToast: GameplayBottomToast,
  ) {
    this.scene = scene;
    this.toast = new MoonflowerCollectToast(bottomToast);

    scene.events.on(GameEvents.STARS_VISIBLE, this.onStarsVisible, this);
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

  resetForNewRun(): void {
    this.spawnedThisRun = false;
    this.collectedThisRun = false;
    this.moonflower?.destroy();
    this.moonflower = null;
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
    if (!this.enabled || this.spawnedThisRun || this.collectedThisRun) return;
    this.spawnedThisRun = true;
    registerMoonflowerAnimations(this.scene);
    this.moonflower = new Moonflower(this.scene, MOONFLOWER.x, MOONFLOWER.y);
  }

  private onGameOver(): void {
    this.moonflower?.destroy();
    this.moonflower = null;
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
