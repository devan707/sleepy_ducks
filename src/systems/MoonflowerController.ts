import Phaser from 'phaser';
import { registerMoonflowerAnimations } from '../assets/MoonflowerAnimations';
import { GameEvents } from '../core/GameEvents';
import { MOONFLOWER } from '../config/gameConfig';
import { Moonflower, MoonflowerTapSuppress } from '../objects/Moonflower';
import type { WaterfallStage } from '../objects/WaterfallStage';
import { CharmBoxReveal } from '../ui/CharmBoxReveal';
import { isCharmCollected } from '../storage/charms';

export class MoonflowerController {
  private scene: Phaser.Scene;
  private moonflower: Moonflower | null = null;
  private reveal: CharmBoxReveal;
  private collecting = false;
  private spawnedThisRun = false;
  private enabled = true;

  constructor(scene: Phaser.Scene, _stage: WaterfallStage) {
    this.scene = scene;
    this.reveal = new CharmBoxReveal(scene);

    scene.events.on(GameEvents.STARS_VISIBLE, this.onStarsVisible, this);
    scene.events.on(GameEvents.GAME_OVER, this.onGameOver, this);
  }

  static consumeTapSuppress(): boolean {
    return MoonflowerTapSuppress.consume();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  tryTap(worldX: number, worldY: number): boolean {
    if (!this.moonflower?.active || this.collecting) return false;
    if (!this.moonflower.containsWorldPoint(worldX, worldY)) return false;
    if (!this.moonflower.tap()) return false;
    this.beginCollect();
    return true;
  }

  isBlockingInput(): boolean {
    return this.collecting;
  }

  destroy(): void {
    this.scene.events.off(GameEvents.STARS_VISIBLE, this.onStarsVisible, this);
    this.scene.events.off(GameEvents.GAME_OVER, this.onGameOver, this);
    this.moonflower?.destroy();
    this.moonflower = null;
    this.reveal.destroy();
  }

  private onStarsVisible(): void {
    if (!this.enabled || this.spawnedThisRun || isCharmCollected('moonflower')) return;
    this.spawnedThisRun = true;
    registerMoonflowerAnimations(this.scene);
    this.moonflower = new Moonflower(this.scene, MOONFLOWER.x, MOONFLOWER.y);
  }

  private onGameOver(): void {
    if (this.collecting) return;
    this.moonflower?.destroy();
    this.moonflower = null;
  }

  private beginCollect(): void {
    if (this.collecting || !this.moonflower) return;
    this.collecting = true;

    const fromX = this.moonflower.x;
    const fromY = this.moonflower.y;
    this.moonflower.destroy();
    this.moonflower = null;

    this.reveal.show({
      charmId: 'moonflower',
      fromWorldX: fromX,
      fromWorldY: fromY,
      onComplete: () => {
        this.collecting = false;
        this.scene.events.emit(GameEvents.CHARM_COLLECTED, { id: 'moonflower' });
      },
    });
  }
}
