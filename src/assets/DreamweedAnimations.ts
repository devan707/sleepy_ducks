import Phaser from 'phaser';
import {
  DREAMWEED_ANIM_KEYS,
  DREAMWEED_ATLAS_KEYS,
} from '../config/dreamweedAssets';
import { DREAMWEED } from '../config/gameConfig';

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

export function registerDreamweedAnimations(scene: Phaser.Scene): void {
  const atlasKey = DREAMWEED_ATLAS_KEYS.sway;
  const animKey = DREAMWEED_ANIM_KEYS.sway;
  if (!scene.textures.exists(atlasKey)) return;
  if (scene.anims.exists(animKey)) scene.anims.remove(animKey);

  const frames = sortedFrameNames(atlasKey, scene);
  if (frames.length === 0) return;

  scene.anims.create({
    key: animKey,
    frames: frames.map((frame) => ({ key: atlasKey, frame })),
    frameRate: DREAMWEED.swayFrameRate,
    repeat: -1,
  });
}
