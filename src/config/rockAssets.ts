import { ENV_KEYS } from './environmentAssets';

export const ROCK_ATLAS_KEYS = {
  rock: ENV_KEYS.rock,
  rock2: ENV_KEYS.rock2,
} as const;

export const ROCK_ANIM_KEYS = {
  rock: 'rock_splash',
  rock2: 'rock2_splash',
} as const;

export function rockAtlasKeyForId(id: keyof typeof ROCK_ATLAS_KEYS): string {
  return ROCK_ATLAS_KEYS[id];
}

export function rockAnimKeyForId(id: keyof typeof ROCK_ANIM_KEYS): string {
  return ROCK_ANIM_KEYS[id];
}
