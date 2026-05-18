export const GameEvents = {
  DUCK_TAPPED: 'duck-tapped',
  DUCK_WAKING: 'duck-waking',
  DUCK_SAVED: 'duck-saved',
  DUCK_MISSED: 'duck-missed',
  DECOY_TAPPED: 'decoy-tapped',
  BALLOON_POPPED: 'balloon-popped',
  COMBO_CHANGED: 'combo-changed',
  LIVES_CHANGED: 'lives-changed',
  SCORE_CHANGED: 'score-changed',
  GAME_OVER: 'game-over',
  /** Sun has set behind the crest — twilight begins. */
  SUNSET: 'sunset',
  /** Delayed after sunset — crossfade to night gameplay music. */
  MUSIC_NIGHT_CROSSFADE: 'music-night-crossfade',
  /** First frame stars become visible this run (night). */
  STARS_VISIBLE: 'stars-visible',
  CHARM_COLLECTED: 'charm-collected',
} as const;
