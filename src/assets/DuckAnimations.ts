import Phaser from 'phaser';
import {
  DUCK_ANIM_KEYS,
  DUCK_ATLAS_KEYS,
  DUCK_WAKE_END_TRIM,
  DUCK_WAKE_FRAME_RATE,
  DUCK_WAKE_START_FRAME,
  FEMALE_ANIM_KEYS,
  FEMALE_ATLAS_KEYS,
} from '../config/duckAssets';
import {
  GOLDEN_ANIM_KEYS,
  GOLDEN_ATLAS_KEYS,
  GOLDEN_FLY_FRAME_RATE,
  GOLDEN_WAKE_FRAME_RATE,
  GOLDEN_WAKE_FRAME_STEP,
  GOLDEN_WAKE_MIN_FRAME,
} from '../config/goldenAssets';

type AnimBinding = {
  atlas: string;
  anim: string;
  repeat: number;
  frameRate: number;
  skipFrames?: number;
  endTrimFrames?: number;
  /** Keep frames where index % step === 0 and index >= minFrame (e.g. 2,4,6…). */
  evenFramesFrom?: number;
};

const ANIM_BINDINGS: AnimBinding[] = [
  { atlas: DUCK_ATLAS_KEYS.sleep, anim: DUCK_ANIM_KEYS.sleep, repeat: -1, frameRate: 8 },
  {
    atlas: DUCK_ATLAS_KEYS.wake,
    anim: DUCK_ANIM_KEYS.wake,
    repeat: 0,
    frameRate: DUCK_WAKE_FRAME_RATE,
    skipFrames: DUCK_WAKE_START_FRAME,
    endTrimFrames: DUCK_WAKE_END_TRIM,
  },
  { atlas: DUCK_ATLAS_KEYS.fly, anim: DUCK_ANIM_KEYS.fly, repeat: -1, frameRate: 12 },
  {
    atlas: FEMALE_ATLAS_KEYS.wake,
    anim: FEMALE_ANIM_KEYS.wake,
    repeat: 0,
    frameRate: DUCK_WAKE_FRAME_RATE,
    skipFrames: DUCK_WAKE_START_FRAME,
    endTrimFrames: DUCK_WAKE_END_TRIM,
  },
  { atlas: FEMALE_ATLAS_KEYS.fly, anim: FEMALE_ANIM_KEYS.fly, repeat: -1, frameRate: 12 },
  {
    atlas: GOLDEN_ATLAS_KEYS.wake,
    anim: GOLDEN_ANIM_KEYS.wake,
    repeat: 0,
    frameRate: GOLDEN_WAKE_FRAME_RATE,
    evenFramesFrom: GOLDEN_WAKE_MIN_FRAME,
  },
  {
    atlas: GOLDEN_ATLAS_KEYS.fly,
    anim: GOLDEN_ANIM_KEYS.fly,
    repeat: -1,
    frameRate: GOLDEN_FLY_FRAME_RATE,
  },
];

function frameIndex(name: string): number {
  return parseInt(name.replace('frame_', ''), 10);
}

function sortedFrameNames(textureKey: string, scene: Phaser.Scene): string[] {
  return scene.textures
    .get(textureKey)
    .getFrameNames()
    .filter((n) => n.startsWith('frame_'))
    .sort((a, b) => frameIndex(a) - frameIndex(b));
}

function selectFrameNames(names: string[], binding: AnimBinding): string[] {
  if (binding.evenFramesFrom !== undefined) {
    const min = binding.evenFramesFrom;
    return names.filter((n) => {
      const idx = frameIndex(n);
      return idx >= min && idx % GOLDEN_WAKE_FRAME_STEP === 0;
    });
  }

  const skip = binding.skipFrames ?? 0;
  const endTrim = binding.endTrimFrames ?? 0;
  return names.slice(skip, endTrim > 0 ? -endTrim : undefined);
}

function registerBinding(scene: Phaser.Scene, binding: AnimBinding): void {
  if (scene.anims.exists(binding.anim)) {
    scene.anims.remove(binding.anim);
  }
  if (!scene.textures.exists(binding.atlas)) return;

  const useNames = selectFrameNames(sortedFrameNames(binding.atlas, scene), binding);
  if (useNames.length === 0) return;

  scene.anims.create({
    key: binding.anim,
    frames: useNames.map((frame) => ({
      key: binding.atlas,
      frame,
    })),
    frameRate: binding.frameRate,
    repeat: binding.repeat,
  });
}

export function registerDuckAnimations(scene: Phaser.Scene): void {
  for (const binding of ANIM_BINDINGS) {
    registerBinding(scene, binding);
  }
}

export function hasDuckAtlases(scene: Phaser.Scene): boolean {
  return (
    scene.textures.exists(DUCK_ATLAS_KEYS.sleep) &&
    scene.textures.exists(DUCK_ATLAS_KEYS.wake) &&
    scene.textures.exists(DUCK_ATLAS_KEYS.fly)
  );
}

export function hasGoldenAtlases(scene: Phaser.Scene): boolean {
  return (
    scene.textures.exists(GOLDEN_ATLAS_KEYS.wake) &&
    scene.textures.exists(GOLDEN_ATLAS_KEYS.fly)
  );
}
