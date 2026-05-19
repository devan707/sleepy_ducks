import Phaser from 'phaser';
import { ASSET_KEYS } from './assets';
import {
  DUCK_ANIM_KEYS,
  DUCK_WAKE_START_FRAME,
  FEMALE_ANIM_KEYS,
} from './duckAssets';
import { GOLDEN_ANIM_KEYS } from './goldenAssets';
import type { DuckKind, DuckSex } from './gameConfig';

export interface DuckSpriteSet {
  crestTexture: string;
  crestAnimKey: string | null;
  wakeTexture: string;
  wakeAnimKey: string;
  flyTexture: string;
  flyAnimKey: string;
}

const MALE_MALLARD: Omit<DuckSpriteSet, 'crestTexture' | 'crestAnimKey'> = {
  wakeTexture: ASSET_KEYS.atlasDuckWake,
  wakeAnimKey: DUCK_ANIM_KEYS.wake,
  flyTexture: ASSET_KEYS.atlasDuckFly,
  flyAnimKey: DUCK_ANIM_KEYS.fly,
};

const FEMALE_MALLARD: Omit<DuckSpriteSet, 'crestTexture' | 'crestAnimKey'> = {
  wakeTexture: ASSET_KEYS.atlasFemaleWake,
  wakeAnimKey: FEMALE_ANIM_KEYS.wake,
  flyTexture: ASSET_KEYS.atlasFemaleFly,
  flyAnimKey: FEMALE_ANIM_KEYS.fly,
};

const GOLDEN: DuckSpriteSet = {
  crestTexture: ASSET_KEYS.goldenSleep,
  crestAnimKey: null,
  wakeTexture: ASSET_KEYS.atlasGoldenWake,
  wakeAnimKey: GOLDEN_ANIM_KEYS.wake,
  flyTexture: ASSET_KEYS.atlasGoldenFly,
  flyAnimKey: GOLDEN_ANIM_KEYS.fly,
};

function textureReady(scene: Phaser.Scene, key: string, needsAtlasFrames = false): boolean {
  if (!scene.textures.exists(key)) return false;
  if (!needsAtlasFrames) return true;
  const frames = scene.textures
    .get(key)
    .getFrameNames()
    .filter((n) => n.startsWith('frame_'));
  return frames.length > 0;
}

function goldenReady(scene: Phaser.Scene): boolean {
  return (
    textureReady(scene, ASSET_KEYS.goldenSleep) &&
    textureReady(scene, ASSET_KEYS.atlasGoldenWake, true) &&
    textureReady(scene, ASSET_KEYS.atlasGoldenFly, true)
  );
}

function mallardCrest(sex: DuckSex): Pick<DuckSpriteSet, 'crestTexture' | 'crestAnimKey'> {
  if (sex === 'male') {
    return {
      crestTexture: ASSET_KEYS.atlasDuckSleep,
      crestAnimKey: DUCK_ANIM_KEYS.sleep,
    };
  }
  return {
    crestTexture: ASSET_KEYS.femaleAsleep,
    crestAnimKey: null,
  };
}

function heavyCrest(
  scene: Phaser.Scene,
  sex: DuckSex,
): Pick<DuckSpriteSet, 'crestTexture' | 'crestAnimKey'> {
  if (sex === 'female' && textureReady(scene, ASSET_KEYS.femaleDeepSleep)) {
    return { crestTexture: ASSET_KEYS.femaleDeepSleep, crestAnimKey: null };
  }
  if (sex === 'male' && textureReady(scene, ASSET_KEYS.maleDeepSleep)) {
    return { crestTexture: ASSET_KEYS.maleDeepSleep, crestAnimKey: null };
  }
  const fallback =
    textureReady(scene, ASSET_KEYS.maleDeepSleep)
      ? ASSET_KEYS.maleDeepSleep
      : ASSET_KEYS.femaleDeepSleep;
  return { crestTexture: fallback, crestAnimKey: null };
}

function femaleMallardReady(scene: Phaser.Scene): boolean {
  return (
    textureReady(scene, ASSET_KEYS.femaleAsleep) &&
    textureReady(scene, ASSET_KEYS.atlasFemaleWake, true) &&
    textureReady(scene, ASSET_KEYS.atlasFemaleFly, true)
  );
}

/** Normal asleep art for sex (used when heavy sleeper gets first tap). */
export function resolveMallardCrest(
  scene: Phaser.Scene,
  sex: DuckSex,
): Pick<DuckSpriteSet, 'crestTexture' | 'crestAnimKey'> {
  const useFemale = sex === 'female' && femaleMallardReady(scene);
  return mallardCrest(useFemale ? 'female' : 'male');
}

/** Pick loaded art for sex + kind; falls back when sheets are missing. */
export function resolveDuckSpriteSet(
  scene: Phaser.Scene,
  sex: DuckSex,
  kind: DuckKind,
): DuckSpriteSet {
  if (kind === 'golden' && goldenReady(scene)) {
    return GOLDEN;
  }

  if (kind === 'decoy') {
    return {
      crestTexture: ASSET_KEYS.decoy,
      crestAnimKey: null,
      wakeTexture: ASSET_KEYS.decoy,
      wakeAnimKey: '',
      flyTexture: ASSET_KEYS.decoy,
      flyAnimKey: '',
    };
  }

  const useFemale = sex === 'female' && femaleMallardReady(scene);
  const mallard = useFemale ? FEMALE_MALLARD : MALE_MALLARD;
  const crest =
    kind === 'heavy'
      ? heavyCrest(scene, sex)
      : mallardCrest(useFemale ? 'female' : 'male');

  if (sex === 'female' && !femaleMallardReady(scene)) {
    console.warn('Female duck art missing — using male sprites for this duck');
  }

  return { ...crest, ...mallard };
}

export function isFemaleWakeTexture(textureKey: string): boolean {
  return textureKey === ASSET_KEYS.atlasFemaleWake;
}

export function isMaleWakeTexture(textureKey: string): boolean {
  return textureKey === ASSET_KEYS.atlasDuckWake;
}

export function isGoldenWakeTexture(textureKey: string): boolean {
  return textureKey === ASSET_KEYS.atlasGoldenWake;
}

export function isGoldenFlyTexture(textureKey: string): boolean {
  return textureKey === ASSET_KEYS.atlasGoldenFly;
}

export function wakeStartFrameName(textureKey?: string): string {
  if (textureKey && isGoldenWakeTexture(textureKey)) {
    return 'frame_002';
  }
  return `frame_${String(DUCK_WAKE_START_FRAME).padStart(3, '0')}`;
}
