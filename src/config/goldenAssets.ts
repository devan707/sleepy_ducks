/** Texture keys for golden duck atlases. */
export const GOLDEN_ATLAS_KEYS = {
  sleep: 'golden-sleep',
  wake: 'atlas-golden-wake',
  fly: 'atlas-golden-fly',
} as const;

export const GOLDEN_ANIM_KEYS = {
  wake: 'golden_wake',
  fly: 'golden_fly',
} as const;

/** Wake uses frames 2,4,6… — half the frames, same pacing ≈ half the original length. */
export const GOLDEN_WAKE_FRAME_RATE = 10;
export const GOLDEN_WAKE_MIN_FRAME = 2;
export const GOLDEN_WAKE_FRAME_STEP = 2;

export const GOLDEN_FLY_FRAME_RATE = 14;

/**
 * Match on-screen size across sleep (768²), wake (472×542), fly (434×532).
 * Reference height: wake frame.
 */
export const GOLDEN_ATLAS_VISUAL_SCALE = {
  [GOLDEN_ATLAS_KEYS.sleep]: 542 / 768,
  [GOLDEN_ATLAS_KEYS.wake]: 1,
  [GOLDEN_ATLAS_KEYS.fly]: 542 / 532,
} as const;

export function getGoldenAtlasVisualScale(atlasKey: string): number {
  const scales = GOLDEN_ATLAS_VISUAL_SCALE as Record<string, number>;
  return scales[atlasKey] ?? 1;
}
