import Phaser from 'phaser';
import { ENV_ROCK_ATLASES } from '../config/environmentAssets';

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

export function registerRockAnimations(scene: Phaser.Scene): void {
  for (const entry of ENV_ROCK_ATLASES) {
    if (!scene.textures.exists(entry.key)) continue;
    if (scene.anims.exists(entry.animKey)) scene.anims.remove(entry.animKey);

    const frames = sortedFrameNames(entry.key, scene);
    if (frames.length === 0) continue;

    scene.anims.create({
      key: entry.animKey,
      frames: frames.map((frame) => ({ key: entry.key, frame })),
      frameRate: entry.frameRate,
      repeat: -1,
    });
  }
}
