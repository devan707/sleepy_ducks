import Phaser from 'phaser';
import {
  ensureMoonflowerHudSilhouetteTexture,
  MOONFLOWER_HUD_SILHOUETTE_KEY,
} from '../assets/moonflowerHudSilhouette';
import { MOONFLOWER_ATLAS_KEYS, MOONFLOWER_ANIM_KEYS } from '../config/moonflowerAssets';
import { MOONFLOWER, STAGE } from '../config/gameConfig';

const ICON_H = 28;
const FLY_DURATION_MS = 460;

/**
 * Empty slot: grey moonflower silhouette (from sway frame) with 1px outline.
 * Collected: full-color sway — flies in from the cliff collect point.
 */
export class MoonflowerHudIcon {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container;
  private silhouette: Phaser.GameObjects.Image;
  private colored: Phaser.GameObjects.Sprite;
  private displayW: number;
  private displayH: number;

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

    this.colored = this.createColoredSprite();
    this.colored.setVisible(false);

    this.root.add([this.silhouette, this.colored]);
    this.setCollectedThisRun(false, false);
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.root;
  }

  getWorldCenter(): { x: number; y: number } {
    const out = new Phaser.Math.Vector2();
    this.root.getWorldTransformMatrix().transformPoint(0, 0, out);
    return { x: out.x, y: out.y };
  }

  /** Sync HUD slot with whether this run's moonflower was collected. */
  setCollectedThisRun(collected: boolean, _animate = false): void {
    if (!collected) {
      this.colored.setVisible(false);
      this.silhouette.setVisible(true);
      this.silhouette.setAlpha(1);
      return;
    }

    this.showFullColor();
  }

  /** Fast fly from cliff collect point into the HUD slot. */
  flyIntoPlace(fromX: number, fromY: number): void {
    const { x: targetX, y: targetY } = this.getWorldCenter();
    const key = this.scene.textures.exists(MOONFLOWER_ATLAS_KEYS.sway)
      ? MOONFLOWER_ATLAS_KEYS.sway
      : MOONFLOWER_ATLAS_KEYS.bloom;

    const flyer = this.scene.add.sprite(fromX, fromY, key, 'frame_003');
    flyer.setDepth(STAGE.hudDepth + 8);
    flyer.setScrollFactor(0);
    if (this.scene.anims.exists(MOONFLOWER_ANIM_KEYS.sway)) {
      flyer.play(MOONFLOWER_ANIM_KEYS.sway);
    }

    const frame = flyer.frame;
    const startH = MOONFLOWER.displayHeight * 0.72;
    const startFit = startH / frame.height;
    flyer.setDisplaySize(frame.width * startFit, startH);

    this.silhouette.setAlpha(1);
    this.colored.setVisible(false);

    this.scene.tweens.add({
      targets: flyer,
      x: targetX,
      y: targetY,
      displayWidth: this.displayW,
      displayHeight: this.displayH,
      duration: FLY_DURATION_MS,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        flyer.destroy();
        this.showFullColor();
      },
    });
  }

  destroy(): void {
    this.root.destroy();
  }

  private showFullColor(): void {
    this.colored.setVisible(true);
    this.silhouette.setVisible(false);
    this.colored.setAlpha(1);
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
    if (this.scene.anims.exists(MOONFLOWER_ANIM_KEYS.sway)) {
      sprite.play(MOONFLOWER_ANIM_KEYS.sway);
    }
    return sprite;
  }
}
