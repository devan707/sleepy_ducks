import { ASSET_ROOT } from './assetRoot';

/** Texture key — must match `ASSET_KEYS.fxPoolSprayBaked` in assets.ts (no import: avoids circular deps). */
export const POOL_SPRAY_BAKED_TEXTURE_KEY = 'fx-pool-spray-baked';

/** Baked pool-spray loop (replaces live particles + tile FX on mobile when files exist). */
export const POOL_SPRAY_BAKED = {
  textureKey: POOL_SPRAY_BAKED_TEXTURE_KEY,
  animKey: 'fx-pool-spray-baked-loop',
  /** Spritesheet + Phaser atlas JSON under public/assets/effects/ */
  png: `${ASSET_ROOT}/effects/pool_spray_baked.png`,
  atlas: `${ASSET_ROOT}/effects/pool_spray_baked.json`,
  /** Authoring size per frame (keep constant for capture + Aseprite). */
  frameWidth: 224,
  frameHeight: 48,
  frameCount: 12,
  frameRate: 10,
} as const;
