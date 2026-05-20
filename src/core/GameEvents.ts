export const GameEvents = {
  DUCK_TAPPED: 'duck-tapped',
  DUCK_WAKING: 'duck-waking',
  DUCK_SAVED: 'duck-saved',
  DUCK_MISSED: 'duck-missed',
  EARLY_TAP: 'early-tap',
  BAD_TAP: 'bad-tap',
  BALLOON_POPPED: 'balloon-popped',
  COMBO_CHANGED: 'combo-changed',
  LIVES_CHANGED: 'lives-changed',
  SCORE_CHANGED: 'score-changed',
  GAME_OVER: 'game-over',
  /** Sun has set behind the crest — twilight begins. */
  SUNSET: 'sunset',
  /** First frame stars become visible this run (night). */
  STARS_VISIBLE: 'stars-visible',
  CHARM_COLLECTED: 'charm-collected',
  DECOY_ROCK_HIT: 'decoy-rock-hit',
} as const;
