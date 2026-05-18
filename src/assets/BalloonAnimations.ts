import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets';
import { BALLOON } from '../config/gameConfig';

export const BALLOON_ANIM_KEYS = {
  float: 'balloon_float',
  pop: 'balloon_pop',
} as const;

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

export function registerBalloonAnimations(scene: Phaser.Scene): void {
  if (scene.textures.exists(ASSET_KEYS.atlasBalloon)) {
    if (scene.anims.exists(BALLOON_ANIM_KEYS.float)) {
      scene.anims.remove(BALLOON_ANIM_KEYS.float);
    }
    const floatFrames = sortedFrameNames(ASSET_KEYS.atlasBalloon, scene);
    if (floatFrames.length > 0) {
      scene.anims.create({
        key: BALLOON_ANIM_KEYS.float,
        frames: floatFrames.map((frame) => ({
          key: ASSET_KEYS.atlasBalloon,
          frame,
        })),
        frameRate: BALLOON.floatFrameRate,
        repeat: -1,
      });
    }
  }

  if (scene.textures.exists(ASSET_KEYS.atlasBalloonPop)) {
    if (scene.anims.exists(BALLOON_ANIM_KEYS.pop)) {
      scene.anims.remove(BALLOON_ANIM_KEYS.pop);
    }
    const popFrames = sortedFrameNames(ASSET_KEYS.atlasBalloonPop, scene);
    if (popFrames.length > 0) {
      scene.anims.create({
        key: BALLOON_ANIM_KEYS.pop,
        frames: popFrames.map((frame) => ({
          key: ASSET_KEYS.atlasBalloonPop,
          frame,
        })),
        frameRate: BALLOON.popFrameRate,
        repeat: 0,
      });
    }
  }
}
