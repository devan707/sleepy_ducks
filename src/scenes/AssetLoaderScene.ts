import Phaser from 'phaser';
import { loadGameAssets } from '../assets/GameAssetLoader';
import { SCENE_KEYS } from '../config/gameConfig';

/**
 * Persistent scene that owns gameplay asset loading so Menu → Game
 * transitions cannot cancel an in-flight LoaderPlugin.
 */
export class AssetLoaderScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.assetLoader);
  }

  create(): void {
    // Headless loader — hide camera so this scene never paints over the menu.
    this.cameras.main.setVisible(false);

    loadGameAssets(this).catch((err) => {
      console.error('AssetLoaderScene failed:', err);
    });
  }
}
