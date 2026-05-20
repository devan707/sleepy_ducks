import { ASSET_ROOT } from '../config/assetRoot';

const SOUNDFX_BASE = `${import.meta.env.BASE_URL}${ASSET_ROOT}/soundfx/`;

/** Wake quacks only — no legacy plink / surprised-duck clips. */
const WAKE_QUACK_FILES = ['quack1.mp3', 'quack2.mp3', 'quack3.mp3', 'quack4.mp3', 'quack5.mp3', 'quack6.mp3', 'quack7.mp3', 'quack8.mp3', 'quack9.mp3', 'quack10.mp3'] as const;

/** Public URLs for wake quacks (Vite `base`-aware). */
export const WAKE_QUACK_URLS: readonly string[] = WAKE_QUACK_FILES.map(
  (file) => SOUNDFX_BASE + encodeURIComponent(file),
);

/** Golden duck wake SFX. */
export const GOLDEN_WAKE_URL = SOUNDFX_BASE + encodeURIComponent('golden.mp3');

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
