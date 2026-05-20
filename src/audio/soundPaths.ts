import { ASSET_ROOT } from '../config/assetRoot';

const SOUNDFX_BASE = `${import.meta.env.BASE_URL}${ASSET_ROOT}/soundfx/`;

/** Wake quacks only — no legacy plink / surprised-duck clips. */
const WAKE_QUACK_FILES = ['quack1.mp3', 'quack2.mp3', 'quack3.mp3', 'quack4.mp3', 'quack5.mp3', 'quack6.mp3', 'quack7.mp3', 'quack8.mp3', 'quack10.mp3'] as const;

/** Public URLs for wake quacks (Vite `base`-aware). */
export const WAKE_QUACK_URLS: readonly string[] = WAKE_QUACK_FILES.map(
  (file) => SOUNDFX_BASE + encodeURIComponent(file),
);

/** Golden duck wake SFX. */
export const GOLDEN_WAKE_URL = SOUNDFX_BASE + encodeURIComponent('golden.mp3');

/** Combo meter start / milestone fanfare. */
export const COMBO_URL = SOUNDFX_BASE + encodeURIComponent('combo.mp3');

/** Moonflower collected. */
export const MOONFLOWER_URL = SOUNDFX_BASE + encodeURIComponent('moonflower.mp3');

/** Dreamweed swiped and collected. */
export const DREAMWEED_URL = SOUNDFX_BASE + encodeURIComponent('dreamweed.mp3');

/** Extra heart from balloon or golden egg. */
export const LIFE_URL = SOUNDFX_BASE + encodeURIComponent('life.mp3');

/** Golden egg cracks open before awarding +1 life. */
export const CRACKING_EGG_URL = SOUNDFX_BASE + encodeURIComponent('egg-cracking.mp3');

/** Level passed stinger + crowd cheer. */
export const LEVEL_PASS_URL = SOUNDFX_BASE + encodeURIComponent('pass.mp3');
export const CHEERING_URL = SOUNDFX_BASE + encodeURIComponent('cheering.mp3');

/** Decoy duck bounces off a cascade rock. */
export const WOOD_URL = SOUNDFX_BASE + encodeURIComponent('wood.mp3');

/** Two bad taps in a row (orange X). */
export const BAD_TAP_STREAK_2_URL = SOUNDFX_BASE + encodeURIComponent('xx.mp3');

/** Three or more bad taps in a row (red X). */
export const BAD_TAP_STREAK_3_URL = SOUNDFX_BASE + encodeURIComponent('xxx.mp3');

/**
 * Looping ambient beds that play during gameplay. `peak` is the maximum
 * fraction of the file's original volume when the SFX slider is at 100%.
 */
export const GAMEPLAY_BACKGROUND_LOOPS: ReadonlyArray<{
  url: string;
  peak: number;
}> = [
  { url: SOUNDFX_BASE + encodeURIComponent('river.mp3'), peak: 0.3 },
  { url: SOUNDFX_BASE + encodeURIComponent('waterfall.mp3'), peak: 0.2 },
];
