import { ASSET_KEYS } from './assets';

/** Texture keys created by `load.atlas()` / `load.image()` for dreamweed. */
export const DREAMWEED_ATLAS_KEYS = {
  sway: ASSET_KEYS.atlasDreamweedSway,
} as const;

export const DREAMWEED_STATIC_KEY = ASSET_KEYS.dreamweed;

export const DREAMWEED_ANIM_KEYS = {
  sway: 'dreamweed_sway',
} as const;
