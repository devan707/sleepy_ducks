import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets';

export const UI_ANIM_KEYS = {
  play: 'ui_play',
  retry: 'ui_retry',
} as const;

const UI_FRAME_RATE = 12;

function sortedFrameNames(textureKey: string, scene: Phaser.Scene): string[] {
  return scene.textures
    .get(textureKey)
    .getFrameNames()
    .filter((n) => n.startsWith('frame_'))
    .sort((a, b) => {
      const ai = parseInt(a.replace('frame_', ''), 10);
      const bi = parseInt(b.replace('frame_', ''), 10);
      return ai - bi;
    });
}

function registerLoop(
  scene: Phaser.Scene,
  atlasKey: string,
  animKey: string,
): void {
  if (!scene.textures.exists(atlasKey)) return;
  if (scene.anims.exists(animKey)) {
    scene.anims.remove(animKey);
  }

  const names = sortedFrameNames(atlasKey, scene);
  if (names.length === 0) return;

  scene.anims.create({
    key: animKey,
    frames: names.map((frame) => ({ key: atlasKey, frame })),
    frameRate: UI_FRAME_RATE,
    repeat: -1,
  });
}

export function registerUiButtonAnimations(scene: Phaser.Scene): void {
  registerLoop(scene, ASSET_KEYS.uiPlay, UI_ANIM_KEYS.play);
  registerLoop(scene, ASSET_KEYS.uiRetry, UI_ANIM_KEYS.retry);
}
