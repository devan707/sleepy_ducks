import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets';
import {
  LOADING_BAR_ART,
  getLoadingBarFillMetrics,
} from '../config/loadingBarLayout';

/** Lily-pad green from the title logo (main leaf + lighter top edge). */
const FILL_COLOR = 0x76c442;
const FILL_HIGHLIGHT = 0xa2d149;

export class LoadingBar extends Phaser.GameObjects.Container {
  private readonly fillGfx: Phaser.GameObjects.Graphics;
  private readonly frame?: Phaser.GameObjects.Image;
  private readonly fillMetrics: ReturnType<typeof getLoadingBarFillMetrics>;
  private progress = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    displayWidth = LOADING_BAR_ART.displayWidth,
  ) {
    super(scene, x, y);

    this.fillMetrics = getLoadingBarFillMetrics(displayWidth);

    this.fillGfx = scene.add.graphics();
    this.add(this.fillGfx);

    if (scene.textures.exists(ASSET_KEYS.uiLoading)) {
      this.frame = scene.add.image(0, 0, ASSET_KEYS.uiLoading);
      this.frame.setDisplaySize(displayWidth, displayWidth);
      this.add(this.frame);
    }

    this.setProgress(0);
    scene.add.existing(this);
  }

  setProgress(value: number): void {
    this.progress = Phaser.Math.Clamp(value, 0, 1);
    this.redrawFill();
  }

  private redrawFill(): void {
    const { left, top, width, height, radius } = this.fillMetrics;
    this.fillGfx.clear();
    if (this.progress <= 0) return;

    const fillWidth = Math.max(height * 0.5, width * this.progress);
    this.fillGfx.fillStyle(FILL_COLOR, 0.95);
    this.fillGfx.fillRoundedRect(left, top, fillWidth, height, radius);

    if (this.progress > 0.04) {
      const shineHeight = Math.max(3, height * 0.32);
      this.fillGfx.fillStyle(FILL_HIGHLIGHT, 0.55);
      this.fillGfx.fillRoundedRect(
        left + 2,
        top + 2,
        Math.max(0, fillWidth - 4),
        shineHeight,
        shineHeight / 2,
      );
    }
  }

  destroy(fromScene?: boolean): void {
    this.fillGfx.destroy(fromScene);
    this.frame?.destroy(fromScene);
    super.destroy(fromScene);
  }
}
