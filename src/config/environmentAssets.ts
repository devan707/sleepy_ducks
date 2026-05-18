import { ASSET_ROOT } from './assetRoot';

/**
 * Environment art. Target folder: `assets/environment/`.
 * Files may live in `assets/backgrounds/` until moved — both paths are listed.
 */
export const ENV_ROOT = `${ASSET_ROOT}/backgrounds`;
export const ENV_ROOT_ALT = `${ASSET_ROOT}/environment`;

/** Authoring size for bg_cliffs, foreground_rocks, and flow mask. */
export const ENV_DESIGN = {
  width: 780,
  height: 1699,
} as const;

export const ENV_KEYS = {
  bgCliffs: 'env-bg-cliffs',
  waterChannelMask: 'env-water-channel-mask',
  waterfallFlowTile: 'env-waterfall-flow-tile',
  waterfallFlow1: 'env-waterfall-flow-1',
  waterfallFlow2: 'env-waterfall-flow-2',
  waterfallFlow3: 'env-waterfall-flow-3',
  foregroundRocks: 'env-foreground-rocks',
  leftCliff: 'env-left-cliff',
  sun: 'env-sun',
} as const;

export type EnvAssetKey = (typeof ENV_KEYS)[keyof typeof ENV_KEYS];

export const ENV_ANIM_KEYS = {
  flow1: 'waterfall_flow_1',
  flow2: 'waterfall_flow_2',
  flow3: 'waterfall_flow_3',
} as const;

export interface EnvAtlasEntry {
  key: EnvAssetKey;
  png: string;
  json: string;
  pngAlt: string;
  jsonAlt: string;
  animKey: string;
  frameRate: number;
  alpha: number;
  offsetX: number;
}

/** Legacy atlas entries — not loaded at runtime; kept for reference. */
export const ENV_ATLASES: EnvAtlasEntry[] = [
  {
    key: ENV_KEYS.waterfallFlow1,
    png: `${ENV_ROOT}/waterfall_flow_1.png`,
    json: `${ENV_ROOT}/waterfall_flow_1.json`,
    pngAlt: `${ENV_ROOT_ALT}/waterfall_flow_1.png`,
    jsonAlt: `${ENV_ROOT_ALT}/waterfall_flow_1.json`,
    animKey: ENV_ANIM_KEYS.flow1,
    frameRate: 10,
    alpha: 1,
    offsetX: 0,
  },
  {
    key: ENV_KEYS.waterfallFlow2,
    png: `${ENV_ROOT}/waterfall_flow_2.png`,
    json: `${ENV_ROOT}/waterfall_flow_2.json`,
    pngAlt: `${ENV_ROOT_ALT}/waterfall_flow_2.png`,
    jsonAlt: `${ENV_ROOT_ALT}/waterfall_flow_2.json`,
    animKey: ENV_ANIM_KEYS.flow2,
    frameRate: 7,
    alpha: 0.5,
    offsetX: 4,
  },
  {
    key: ENV_KEYS.waterfallFlow3,
    png: `${ENV_ROOT}/waterfall_flow_3.png`,
    json: `${ENV_ROOT}/waterfall_flow_3.json`,
    pngAlt: `${ENV_ROOT_ALT}/waterfall_flow_3.png`,
    jsonAlt: `${ENV_ROOT_ALT}/waterfall_flow_3.json`,
    animKey: ENV_ANIM_KEYS.flow3,
    frameRate: 13,
    alpha: 0.35,
    offsetX: -5,
  },
];

export const ENV_IMAGES = [
  {
    key: ENV_KEYS.bgCliffs,
    path: `${ENV_ROOT}/bg_cliffs.png`,
    pathAlt: `${ENV_ROOT_ALT}/bg_cliffs.png`,
  },
  {
    key: ENV_KEYS.foregroundRocks,
    path: `${ENV_ROOT}/foreground_rocks.png`,
    pathAlt: `${ENV_ROOT_ALT}/foreground_rocks.png`,
  },
  {
    key: ENV_KEYS.leftCliff,
    path: `${ENV_ROOT_ALT}/left_cliff.png`,
    pathAlt: `${ENV_ROOT}/left_cliff.png`,
  },
  {
    key: ENV_KEYS.waterChannelMask,
    path: `${ENV_ROOT}/water_channel_mask.png`,
    pathAlt: `${ENV_ROOT_ALT}/water_channel_mask.png`,
  },
  {
    key: ENV_KEYS.waterfallFlowTile,
    path: `${ENV_ROOT}/waterfall_flow_tile.png`,
    pathAlt: `${ENV_ROOT_ALT}/waterfall_flow_tile.png`,
  },
  {
    key: ENV_KEYS.sun,
    path: `${ENV_ROOT_ALT}/sun.png`,
    pathAlt: `${ENV_ROOT}/sun.png`,
  },
] as const;
