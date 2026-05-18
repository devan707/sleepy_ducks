import Phaser from 'phaser';
import { AssetManager } from '../assets/AssetManager';
import { finalizeGameAssets, queueGameAssets } from '../assets/GameAssetLoader';
import { FallbackTextures } from '../assets/FallbackTextures';
import {
  MENU_MANIFEST,
  type AssetKey,
  type AssetManifestEntry,
} from '../config/assets';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../config/gameConfig';
import { LoadingBar } from '../ui/LoadingBar';

const DEPTH = {
  backdrop: 0,
  bar: 1,
  text: 2,
} as const;

export class PreloadScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text;
  private loadingBar!: LoadingBar;

  constructor() {
    super(SCENE_KEYS.preload);
  }

  preload(): void {
    AssetManager.reset();
    AssetManager.clearGameplayTextures(this);
    this.cameras.main.setBackgroundColor(COLORS.waterDeep);

    this.createLoadingUi();

    this.load.on('progress', (value: number) => {
      this.loadingBar.setProgress(value);
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

    this.loadingBar.setProgress(1);
    this.statusText.setText('Ready!');
    this.time.delayedCall(80, () => {
      this.scene.start(SCENE_KEYS.menu);
    });
  }

  private createLoadingUi(): void {
    const cx = GAME_WIDTH / 2;
    const barY = GAME_HEIGHT * 0.58;

    const backdrop = this.add.graphics().setDepth(DEPTH.backdrop);
    backdrop.fillStyle(0x061820, 0.72);
    backdrop.fillRoundedRect(cx - 176, barY - 92, 352, 184, 22);
    backdrop.lineStyle(3, 0xffffff, 0.18);
    backdrop.strokeRoundedRect(cx - 176, barY - 92, 352, 184, 22);

    this.loadingBar = new LoadingBar(this, cx, barY);
    this.loadingBar.setDepth(DEPTH.bar);

    this.statusText = this.add
      .text(cx, barY - 72, 'Loading…', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#061820',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.text);
  }

  private queueEntry(entry: AssetManifestEntry): void {
    if (entry.type === 'atlas' && entry.atlasPath) {
      this.load.atlas(entry.key, entry.path, entry.atlasPath);
    } else {
      this.load.image(entry.key, entry.path);
    }
  }
}
