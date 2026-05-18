import Phaser from 'phaser';
import { AssetManager } from '../assets/AssetManager';
import { finalizeGameAssets, queueGameAssets } from '../assets/GameAssetLoader';
import { FallbackTextures } from '../assets/FallbackTextures';
import {
  MENU_MANIFEST,
  type AssetKey,
  type AssetManifestEntry,
} from '../config/assets';
import { COLORS, SCENE_KEYS } from '../config/gameConfig';

export class PreloadScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text;
  private progressGfx!: Phaser.GameObjects.Graphics;
  private barX = 0;
  private barY = 0;
  private barW = 280;
  private barH = 14;

  constructor() {
    super(SCENE_KEYS.preload);
  }

  preload(): void {
    AssetManager.reset();
    AssetManager.clearGameplayTextures(this);
    this.cameras.main.setBackgroundColor(COLORS.skyBottom);

    this.barX = (this.scale.width - this.barW) / 2;
    this.barY = this.scale.height * 0.55;

    const bar = this.add.graphics();
    this.progressGfx = this.add.graphics();
    bar.fillStyle(0x2c3e50, 0.8);
    bar.fillRoundedRect(this.barX, this.barY, this.barW, this.barH, 8);

    this.statusText = this.add
      .text(this.scale.width / 2, this.barY - 28, 'Loading…', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: COLORS.text,
      })
      .setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      this.drawProgress(value);
      const pct = Math.round(value * 100);
      this.statusText.setText(`Loading… ${pct}%`);
    });

    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn('Asset failed:', file.key, file.url);
      AssetManager.markMissing(file.key as AssetKey);
    });

    for (const entry of MENU_MANIFEST) {
      this.queueEntry(entry);
    }

    queueGameAssets(this.load);
  }

  create(): void {
    const menuMissing: AssetKey[] = [];
    for (const entry of MENU_MANIFEST) {
      if (!this.textures.exists(entry.key)) {
        menuMissing.push(entry.key);
        AssetManager.markMissing(entry.key);
      }
    }

    if (menuMissing.length > 0) {
      FallbackTextures.generateAll(this, menuMissing);
    }

    finalizeGameAssets(this);
    AssetManager.markBootstrapped();

    this.statusText.setText('Ready!');
    this.time.delayedCall(80, () => {
      this.scene.start(SCENE_KEYS.menu);
    });
  }

  private drawProgress(value: number): void {
    this.progressGfx.clear();
    this.progressGfx.fillStyle(0x6ec5e8, 1);
    this.progressGfx.fillRoundedRect(
      this.barX + 2,
      this.barY + 2,
      (this.barW - 4) * value,
      this.barH - 4,
      6,
    );
  }

  private queueEntry(entry: AssetManifestEntry): void {
    if (entry.type === 'atlas' && entry.atlasPath) {
      this.load.atlas(entry.key, entry.path, entry.atlasPath);
    } else {
      this.load.image(entry.key, entry.path);
    }
  }
}
