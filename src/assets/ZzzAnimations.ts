import Phaser from 'phaser';
import {
  ZZZ_ANIM_KEYS,
  ZZZ_ATLAS_KEYS,
  ZZZ_LOOP_FRAME_RATE,
} from '../config/zzzAssets';

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

export function registerZzzAnimations(scene: Phaser.Scene): void {
  const atlasKey = ZZZ_ATLAS_KEYS.loop;
  const animKey = ZZZ_ANIM_KEYS.loop;
  if (!scene.textures.exists(atlasKey)) return;
  if (scene.anims.exists(animKey)) scene.anims.remove(animKey);

  const frames = sortedFrameNames(atlasKey, scene);
  if (frames.length === 0) return;

  scene.anims.create({
    key: animKey,
    frames: frames.map((frame) => ({ key: atlasKey, frame })),
    frameRate: ZZZ_LOOP_FRAME_RATE,
    repeat: -1,
  });
}
