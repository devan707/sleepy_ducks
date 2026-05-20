import { ASSET_ROOT } from './assetRoot';
import { ENV_ATLASES, ENV_IMAGES, ENV_KEYS } from './environmentAssets';

export { ASSET_ROOT };

export const ASSET_KEYS = {
  ...ENV_KEYS,
  atlasDuckSleep: 'atlas-duck-sleep',
  atlasDuckWake: 'atlas-duck-wake',
  atlasDuckFly: 'atlas-duck-fly',
  femaleAsleep: 'female-asleep',
  maleDeepSleep: 'male-deep-sleep',
  femaleDeepSleep: 'female-deep-sleep',
  atlasFemaleWake: 'atlas-female-wake',
  atlasFemaleFly: 'atlas-female-fly',
  decoy: 'decoy-duck',
  goldenSleep: 'golden-sleep',
  atlasGoldenWake: 'atlas-golden-wake',
  atlasGoldenFly: 'atlas-golden-fly',
  atlasBalloon: 'atlas-balloon',
  atlasBalloonPop: 'atlas-balloon-pop',
  fxMist: 'fx-mist',
  fxSplash: 'fx-splash',
  uiHeart: 'ui-heart',
  homeWaterfall: 'ui-home-waterfall',
  titleLogo: 'ui-title-logo',
  gameOverBanner: 'ui-game-over',
  uiTooSleepy: 'ui-too-sleepy',
  uiLevelPassed: 'ui-level-passed',
  uiLevelPassedMoonflower: 'ui-level-passed-moonflower',
  uiPlay: 'ui-play',
  uiRetry: 'ui-retry',
  uiNextLevel: 'ui-next-level',
  uiGear: 'ui-gear',
  uiSoundOn: 'ui-sound-on',
  uiSoundOff: 'ui-sound-off',
  uiLoading: 'ui-loading',
  charmBox: 'ui-charm-box',
  atlasMoonflowerSprout: 'atlas-moonflower-sprout',
  atlasMoonflowerBloom: 'atlas-moonflower-bloom',
  atlasMoonflowerSway: 'atlas-moonflower-sway',
  atlasZzz: 'atlas-zzz',
} as const;

export type AssetKey = (typeof ASSET_KEYS)[keyof typeof ASSET_KEYS];

export type AssetType = 'image' | 'atlas' | 'audio';

export interface AssetManifestEntry {
  key: AssetKey;
  path: string;
  type: AssetType;
  atlasPath?: string;
}

const envImageEntries: AssetManifestEntry[] = ENV_IMAGES.map((img) => ({
  key: img.key as AssetKey,
  path: img.path,
  type: 'image' as const,
}));

/** waterfall_flow_1 only (~6MB) — layers 2/3 can be added later. */
const envFlow1Atlas: AssetManifestEntry = {
  key: ENV_ATLASES[0].key as AssetKey,
  path: ENV_ATLASES[0].png,
  atlasPath: ENV_ATLASES[0].json,
  type: 'atlas',
};

/** Small pack — home screen shows in ~1s. */
export const MENU_MANIFEST: AssetManifestEntry[] = [
  {
    key: ASSET_KEYS.homeWaterfall,
    path: `${ASSET_ROOT}/ui/home-waterfall.png`,
    type: 'image',
  },
  {
    key: ASSET_KEYS.titleLogo,
    path: `${ASSET_ROOT}/ui/title-logo.png`,
    type: 'image',
  },
  {
    key: ASSET_KEYS.uiHeart,
    path: `${ASSET_ROOT}/ui/heart.png`,
    type: 'image',
  },
  {
    key: ASSET_KEYS.gameOverBanner,
    path: `${ASSET_ROOT}/ui/game-over.png`,
    type: 'image',
  },
  {
    key: ASSET_KEYS.uiTooSleepy,
    path: `${ASSET_ROOT}/ui/too_sleepy.png`,
    type: 'image',
  },
  {
    key: ASSET_KEYS.uiLevelPassed,
    path: `${ASSET_ROOT}/ui/level_passed.png`,
    type: 'image',
  },
  {
    key: ASSET_KEYS.uiLevelPassedMoonflower,
    path: `${ASSET_ROOT}/ui/level_pass_moonflower.png`,
    type: 'image',
  },
  {
    key: ASSET_KEYS.decoy,
    path: `${ASSET_ROOT}/sprites/decoy.png`,
    type: 'image',
  },
  {
    key: ASSET_KEYS.maleDeepSleep,
    path: `${ASSET_ROOT}/sprites/male_deep_sleep.png`,
    type: 'image',
  },
  {
    key: ASSET_KEYS.uiGear,
    path: `${ASSET_ROOT}/ui/gear.png`,
    type: 'image',
  },
  {
    key: ASSET_KEYS.uiSoundOn,
    path: `${ASSET_ROOT}/ui/sound_on.png`,
    type: 'image',
  },
  {
    key: ASSET_KEYS.uiSoundOff,
    path: `${ASSET_ROOT}/ui/sound_off.png`,
    type: 'image',
  },
  {
    key: ASSET_KEYS.uiPlay,
    path: `${ASSET_ROOT}/ui/play.png`,
    type: 'image',
  },
  {
    key: ASSET_KEYS.uiRetry,
    path: `${ASSET_ROOT}/ui/retry.png`,
    type: 'image',
  },
  {
    key: ASSET_KEYS.uiNextLevel,
    path: `${ASSET_ROOT}/ui/next_level.png`,
    type: 'image',
  },
  {
    key: ASSET_KEYS.atlasZzz,
    path: `${ASSET_ROOT}/sprites/zzz.png`,
    atlasPath: `${ASSET_ROOT}/sprites/zzz.json`,
    type: 'atlas',
  },
];

/** Heavy atlases — loaded in background on the menu screen. */
export const GAME_MANIFEST: AssetManifestEntry[] = [
  ...envImageEntries,
  envFlow1Atlas,
  {
    key: ASSET_KEYS.atlasDuckSleep,
    path: `${ASSET_ROOT}/sprites/duck_sleep.png`,
    atlasPath: `${ASSET_ROOT}/sprites/duck_sleep.json`,
    type: 'atlas',
  },
  {
    key: ASSET_KEYS.atlasDuckWake,
    path: `${ASSET_ROOT}/sprites/duck_wake.png`,
    atlasPath: `${ASSET_ROOT}/sprites/duck_wake.json`,
    type: 'atlas',
  },
  {
    key: ASSET_KEYS.atlasDuckFly,
    path: `${ASSET_ROOT}/sprites/duck_fly.png`,
    atlasPath: `${ASSET_ROOT}/sprites/duck_fly.json`,
    type: 'atlas',
  },
  {
    key: ASSET_KEYS.femaleAsleep,
    path: `${ASSET_ROOT}/sprites/female_asleep.png`,
    type: 'image',
  },
  {
    key: ASSET_KEYS.maleDeepSleep,
    path: `${ASSET_ROOT}/sprites/male_deep_sleep.png`,
    type: 'image',
  },
  {
    key: ASSET_KEYS.femaleDeepSleep,
    path: `${ASSET_ROOT}/sprites/female_deep_sleep.png`,
    type: 'image',
  },
  {
    key: ASSET_KEYS.decoy,
    path: `${ASSET_ROOT}/sprites/decoy.png`,
    type: 'image',
  },
  {
    key: ASSET_KEYS.atlasBalloon,
    path: `${ASSET_ROOT}/sprites/balloon.png`,
    atlasPath: `${ASSET_ROOT}/sprites/balloon.json`,
    type: 'atlas',
  },
  {
    key: ASSET_KEYS.atlasBalloonPop,
    path: `${ASSET_ROOT}/sprites/balloon_pop.png`,
    atlasPath: `${ASSET_ROOT}/sprites/balloon_pop.json`,
    type: 'atlas',
  },
  {
    key: ASSET_KEYS.atlasFemaleWake,
    path: `${ASSET_ROOT}/sprites/female_wake.png`,
    atlasPath: `${ASSET_ROOT}/sprites/female_wake.json`,
    type: 'atlas',
  },
  {
    key: ASSET_KEYS.atlasFemaleFly,
    path: `${ASSET_ROOT}/sprites/female_fly.png`,
    atlasPath: `${ASSET_ROOT}/sprites/female_fly.json`,
    type: 'atlas',
  },
  {
    key: ASSET_KEYS.goldenSleep,
    path: `${ASSET_ROOT}/sprites/golden.png`,
    type: 'image',
  },
  {
    key: ASSET_KEYS.atlasGoldenWake,
    path: `${ASSET_ROOT}/sprites/golden_wake.png`,
    atlasPath: `${ASSET_ROOT}/sprites/golden_wake.json`,
    type: 'atlas',
  },
  {
    key: ASSET_KEYS.atlasGoldenFly,
    path: `${ASSET_ROOT}/sprites/golden_fly.png`,
    atlasPath: `${ASSET_ROOT}/sprites/golden_fly.json`,
    type: 'atlas',
  },
  {
    key: ASSET_KEYS.fxMist,
    path: `${ASSET_ROOT}/effects/mist.png`,
    type: 'image',
  },
  {
    key: ASSET_KEYS.fxSplash,
    path: `${ASSET_ROOT}/effects/splash.png`,
    type: 'image',
  },
  {
    key: ASSET_KEYS.atlasMoonflowerSprout,
    path: `${ASSET_ROOT}/sprites/moonflower_sprout.png`,
    atlasPath: `${ASSET_ROOT}/sprites/moonflower_sprout.json`,
    type: 'atlas',
  },
  {
    key: ASSET_KEYS.atlasMoonflowerBloom,
    path: `${ASSET_ROOT}/sprites/moonflower_bloom.png`,
    atlasPath: `${ASSET_ROOT}/sprites/moonflower_bloom.json`,
    type: 'atlas',
  },
  {
    key: ASSET_KEYS.atlasMoonflowerSway,
    path: `${ASSET_ROOT}/sprites/moonflower_sway.png`,
    atlasPath: `${ASSET_ROOT}/sprites/moonflower_sway.json`,
    type: 'atlas',
  },
];

export const ASSET_MANIFEST: AssetManifestEntry[] = [
  ...MENU_MANIFEST,
  ...GAME_MANIFEST,
];
