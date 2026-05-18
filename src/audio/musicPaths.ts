import { ASSET_ROOT } from '../config/assetRoot';

const MUSIC_BASE = `${import.meta.env.BASE_URL}${ASSET_ROOT}/music/`;

/** Menu, settings, and how-to-play. */
export const MENU_UI_MUSIC_URL =
  MUSIC_BASE + encodeURIComponent('Riverbank_Picnic.mp3');

/** Waterfall gameplay — day / sunset. */
export const GAMEPLAY_MUSIC_URL =
  MUSIC_BASE + encodeURIComponent('Sunday_Morning_Paddle.mp3');

/** Waterfall gameplay — after sunset (loops until game over). */
export const GAMEPLAY_NIGHT_MUSIC_URL =
  MUSIC_BASE + encodeURIComponent('Beneath_The_First_Star.mp3');

/** Game over screen. */
export const GAME_OVER_MUSIC_URL =
  MUSIC_BASE + encodeURIComponent('Past_The_Lily_Pads.mp3');
