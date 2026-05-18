import { ASSET_ROOT } from './assetRoot';
import { getGoldenAtlasVisualScale } from './goldenAssets';

/** Texture keys created by `load.atlas()`. */
export const DUCK_ATLAS_KEYS = {
  sleep: 'atlas-duck-sleep',
  wake: 'atlas-duck-wake',
  fly: 'atlas-duck-fly',
} as const;

export const FEMALE_ATLAS_KEYS = {
  wake: 'atlas-female-wake',
  fly: 'atlas-female-fly',
} as const;

/** Global Phaser animation keys (shared across atlas textures). */
export const DUCK_ANIM_KEYS = {
  sleep: 'duck_sleep',
  wake: 'duck_wake',
  fly: 'duck_fly',
} as const;

export const FEMALE_ANIM_KEYS = {
  wake: 'duck_wake_female',
  fly: 'duck_fly_female',
} as const;

/** Atlas index for first wake frame (wide eyes / open beak); skips dull holds in frames 0–4. */
export const DUCK_WAKE_START_FRAME = 5;
/** Drop trailing wake frames before switching to fly. */
export const DUCK_WAKE_END_TRIM = 6;
/** Wake playback speed (lower = slower). */
export const DUCK_WAKE_FRAME_RATE = 10;

/**
 * Per-atlas size bump vs sleep (reference). Tune when wake/fly sheets have more padding.
 * Effective on-screen height ≈ DUCK_SPRITE.displayHeight × multiplier × container crest scale.
 */
export const DUCK_ATLAS_VISUAL_SCALE = {
  [DUCK_ATLAS_KEYS.sleep]: 1,
  [DUCK_ATLAS_KEYS.wake]: 1.6,
  [DUCK_ATLAS_KEYS.fly]: 1.6,
  'female-asleep': 1,
  'male-deep-sleep': 1,
  'female-deep-sleep': 1,
  'decoy-duck': 1,
  /** Female sheets are drawn larger in-frame; slightly below male wake/fly. */
  [FEMALE_ATLAS_KEYS.wake]: 1.38,
  [FEMALE_ATLAS_KEYS.fly]: 1.38,
} as const;

export function getDuckAtlasVisualScale(atlasKey: string): number {
  const scales = DUCK_ATLAS_VISUAL_SCALE as Record<string, number>;
  if (atlasKey in scales) return scales[atlasKey];
  return getGoldenAtlasVisualScale(atlasKey);
}

/**
 * Atlas PNG + JSON paths. Primary: `assets/sprites/`.
 * Also supports `assets/sprites/ducks/` if you relocate files there.
 */
const SPRITES = `${ASSET_ROOT}/sprites`;
const DUCKS = `${ASSET_ROOT}/sprites/ducks`;

function atlasPair(name: string, folder: string = SPRITES) {
  return {
    png: `${folder}/${name}.png`,
    json: `${folder}/${name}.json`,
  };
}

export const DUCK_ATLAS_MANIFEST = [
  {
    key: DUCK_ATLAS_KEYS.sleep,
    ...atlasPair('duck_sleep'),
    alt: atlasPair('duck_sleep', DUCKS),
  },
  {
    key: DUCK_ATLAS_KEYS.wake,
    ...atlasPair('duck_wake'),
    alt: atlasPair('duck_wake', DUCKS),
  },
  {
    key: DUCK_ATLAS_KEYS.fly,
    ...atlasPair('duck_fly'),
    alt: atlasPair('duck_fly', DUCKS),
  },
  {
    key: FEMALE_ATLAS_KEYS.wake,
    ...atlasPair('female_wake'),
    alt: atlasPair('female_wake', DUCKS),
  },
  {
    key: FEMALE_ATLAS_KEYS.fly,
    ...atlasPair('female_fly'),
    alt: atlasPair('female_fly', DUCKS),
  },
] as const;
