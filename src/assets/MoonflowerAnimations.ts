import Phaser from 'phaser';
import { MOONFLOWER_ATLAS_KEYS, MOONFLOWER_ANIM_KEYS } from '../config/moonflowerAssets';
import { MOONFLOWER } from '../config/gameConfig';

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

function registerMoonflowerAnim(
  scene: Phaser.Scene,
  atlasKey: string,
  animKey: string,
  frameRate: number,
  repeat: number,
): void {
  if (!scene.textures.exists(atlasKey)) return;
  if (scene.anims.exists(animKey)) scene.anims.remove(animKey);

  const frames = sortedFrameNames(atlasKey, scene);
  if (frames.length === 0) return;

  scene.anims.create({
    key: animKey,
    frames: frames.map((frame) => ({ key: atlasKey, frame })),
    frameRate,
    repeat,
  });
}

export function registerMoonflowerAnimations(scene: Phaser.Scene): void {
  registerMoonflowerAnim(
    scene,
    MOONFLOWER_ATLAS_KEYS.sprout,
    MOONFLOWER_ANIM_KEYS.sprout,
    MOONFLOWER.sproutFrameRate,
    0,
  );
  registerMoonflowerAnim(
    scene,
    MOONFLOWER_ATLAS_KEYS.bloom,
    MOONFLOWER_ANIM_KEYS.bloom,
    MOONFLOWER.bloomFrameRate,
    0,
  );
  registerMoonflowerAnim(
    scene,
    MOONFLOWER_ATLAS_KEYS.sway,
    MOONFLOWER_ANIM_KEYS.sway,
    MOONFLOWER.swayFrameRate,
    -1,
  );
}
