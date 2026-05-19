import Phaser from 'phaser';
import {
  ensureMoonflowerHudSilhouetteTexture,
  MOONFLOWER_HUD_SILHOUETTE_KEY,
} from '../assets/moonflowerHudSilhouette';
import { MOONFLOWER_ATLAS_KEYS, MOONFLOWER_ANIM_KEYS } from '../config/moonflowerAssets';

const ICON_H = 28;

/**
 * Empty slot: grey moonflower silhouette (from sway frame) with 1px outline.
 * This run: real sway animation fills in bottom-up when collected.
 */
export class MoonflowerHudIcon {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container;
  private silhouette: Phaser.GameObjects.Image;
  private fillMask: Phaser.GameObjects.Graphics;
  private colored: Phaser.GameObjects.Sprite;
  private displayW: number;
  private displayH: number;
  private fillLevel01 = 0;
  private fillTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.root = scene.add.container(x, y);

    ensureMoonflowerHudSilhouetteTexture(scene);
    const silFrame = scene.textures.get(MOONFLOWER_HUD_SILHOUETTE_KEY).get();
    const silAspect = silFrame.width / silFrame.height;
    this.displayH = ICON_H;
    this.displayW = ICON_H * silAspect;

    this.silhouette = scene.add.image(0, 0, MOONFLOWER_HUD_SILHOUETTE_KEY);
    this.silhouette.setDisplaySize(this.displayW, this.displayH);
    this.silhouette.setOrigin(0.5);

    this.fillMask = scene.add.graphics();
    this.colored = this.createColoredSprite();
    this.colored.setMask(this.fillMask.createGeometryMask());

    this.root.add([this.silhouette, this.colored]);
    this.setCollectedThisRun(false, false);
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.root;
  }

  /** Sync HUD slot with whether this run's moonflower was collected. */
  setCollectedThisRun(collected: boolean, animate: boolean): void {
    if (!collected) {
      this.fillTween?.stop();
      this.fillTween = null;
      this.setFillLevel(0);
      return;
    }

    if (!animate || this.fillLevel01 >= 0.999) {
      this.fillTween?.stop();
      this.fillTween = null;
      this.setFillLevel(1);
      return;
    }

    this.playFillUp();
  }

  destroy(): void {
    this.fillTween?.stop();
    this.root.destroy();
  }

  private playFillUp(): void {
    this.fillTween?.stop();
    this.setFillLevel(0);

    const state = { t: 0 };
    this.fillTween = this.scene.tweens.add({
      targets: state,
      t: 1,
      duration: 720,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        this.setFillLevel(state.t);
      },
      onComplete: () => {
        this.fillTween = null;
        this.setFillLevel(1);
      },
    });
  }

  private setFillLevel(level01: number): void {
    this.fillLevel01 = Phaser.Math.Clamp(level01, 0, 1);

    const showColor = this.fillLevel01 > 0.02;
    this.colored.setVisible(showColor);
    this.silhouette.setVisible(this.fillLevel01 < 0.98);
    this.silhouette.setAlpha(1 - this.fillLevel01 * 0.9);

    this.fillMask.clear();
    if (showColor) {
      const fillH = this.displayH * this.fillLevel01;
      const top = this.displayH / 2 - fillH;
      this.fillMask.fillStyle(0xffffff);
      this.fillMask.fillRect(
        -this.displayW / 2 - 2,
        top,
        this.displayW + 4,
        fillH + 2,
      );
    }
  }

  private createColoredSprite(): Phaser.GameObjects.Sprite {
    const key = this.scene.textures.exists(MOONFLOWER_ATLAS_KEYS.sway)
      ? MOONFLOWER_ATLAS_KEYS.sway
      : MOONFLOWER_ATLAS_KEYS.bloom;
    const sprite = this.scene.add.sprite(0, 0, key, 'frame_003');
    const frame = sprite.frame;
    const fit = ICON_H / frame.height;
    sprite.setDisplaySize(frame.width * fit, frame.height * fit);
    sprite.setOrigin(0.5);
    sprite.setTint(0xffffff);
    sprite.setVisible(false);
    if (this.scene.anims.exists(MOONFLOWER_ANIM_KEYS.sway)) {
      sprite.play(MOONFLOWER_ANIM_KEYS.sway);
    }
    return sprite;
  }
}
