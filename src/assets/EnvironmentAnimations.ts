import Phaser from 'phaser';
import { ENV_ANIM_KEYS, ENV_ATLASES } from '../config/environmentAssets';

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

/** Register waterfall_flow_1 atlas animation (layer 1 only at runtime). */
export function registerEnvironmentAnimations(scene: Phaser.Scene): void {
  const entry = ENV_ATLASES[0];
  if (!entry) return;
  if (scene.anims.exists(entry.animKey)) return;
  if (!scene.textures.exists(entry.key)) return;

  const names = sortedFrameNames(entry.key, scene);
  if (names.length === 0) return;

  scene.anims.create({
    key: entry.animKey,
    frames: names.map((frame) => ({ key: entry.key, frame })),
    frameRate: entry.frameRate,
    repeat: -1,
  });
}

export function getFlow1AnimKey(): string {
  return ENV_ANIM_KEYS.flow1;
}
