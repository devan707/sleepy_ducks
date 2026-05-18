import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets';
import { ASSET_ROOT } from '../config/assetRoot';
import { COLORS, SCENE_KEYS } from '../config/gameConfig';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  preload(): void {
    this.load.image(ASSET_KEYS.uiLoading, `${ASSET_ROOT}/ui/loading.png`);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.waterDeep);
    this.scene.start(SCENE_KEYS.preload);
  }
}
