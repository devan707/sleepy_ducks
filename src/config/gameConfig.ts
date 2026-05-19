export const GAME_WIDTH = 390;
export const GAME_HEIGHT = 844;

export const HUD_TOP_PADDING = 48;

/** Gameplay HUD safe-area layout (390×844). */
export const HUD_LAYOUT = {
  marginLeft: 16,
  marginRight: 16,
  marginBottom: 28,
  /** Nudged above default safe-area top. */
  scoreTop: HUD_TOP_PADDING - 14,
  scorePanelRadius: 12,
  scorePanelPadX: 10,
  scorePanelPadY: 8,
} as const;

/** Waterfall stage layout — player at bottom looking up at the lip. */
export const STAGE = {
  crestTravelY: 18,
  lipFallThreshold: 3,
  mistZoneTop: 718,
  /** Fallback; runtime uses getSpawnLaneBounds() from the lip segment. */
  laneMinX: 48,
  laneMaxX: 320,
  /** Above night purple (53), below left cliff (55) when falling. */
  duckDepthBehind: 54,
  duckDepthFront: 56,
  depthBgCliffs: 0,
  depthCalibrationDim: 5,
  depthMaskPreview: 8,
  depthCalibrationDebug: 55,
  depthWaterfallFlow: 10,
  /** Night multiply on pool/waterfall only (between flow and foreground). */
  depthWaterNight: 11,
  /** Warm rim on the falls when the sun reaches the lip. */
  depthCrestSunGlow: 12,
  depthForegroundRocks: 50,
  /** Left rock column over waterfall edge (above foreground). */
  depthLeftCliff: 55,
  /** Full-screen sky tint (behind cliffs, masked above lip). */
  depthSkyTint: -2,
  /** Night veil — above bg, below sun/flow, lip-masked. */
  depthNightVeil: 4,
  /** Stars — same band as night veil. */
  depthStars: 5,
  /** Sun disc — behind foreground rocks, in front of cliffs/flow. */
  depthSun: 6,
  /** Sun halo (ADD) — just under the disc. */
  depthSunGlow: 5,
  /** Sunset / night color grade — sky wedge only (same mask as sky tint). */
  depthAtmosphere: 49,
  /** Subtle purple night wash over the scene (below ducks & moonflower). */
  depthNightPurple: 53,
  lipCrestDepthThreshold: 0.58,
  lipMaskInsetY: 0,
  mistDepth: 60,
  hudDepth: 100,
  /** Heart balloon floats above gameplay ducks. */
  balloonDepth: 90,
  /** Moonflower collectible on the left cliff. */
  depthMoonflower: 56,
  /** Charm box reveal overlay. */
  depthCharmReveal: 120,
} as const;

/** Spawn lane padding along the lip (game X; negative left = further screen-left). */
export const SPAWN_LANE = {
  /** Extra reach past lip.left toward the left edge of the falls. */
  leftExtendPx: 16,
  /** Inset from lip.left when not extending (small gutter). */
  leftGutterPx: 2,
  rightGutterPx: 4,
} as const;

export const FLOW_LOOP_LAYERS = 1;
export const FLOW_LOOP_OVERLAY_ALPHA = 0.4;
export const FLOW_LOOP_START_DELAY_SEC = 0.5;

export type DuckSex = 'male' | 'female';
export type DuckKind = 'normal' | 'heavy' | 'golden' | 'decoy';

/** Mallard spawn mix within the non-special slice (sums to 1). */
export const DUCK_SPAWN_PROFILES: readonly {
  sex: DuckSex;
  kind: Exclude<DuckKind, 'golden' | 'decoy'>;
  weight: number;
}[] = [
  { sex: 'male', kind: 'normal', weight: 0.50 },
  { sex: 'female', kind: 'normal', weight: 0.28 },
  { sex: 'male', kind: 'heavy', weight: 0.08 },
  { sex: 'female', kind: 'heavy', weight: 0.14 },
];

/** Independent roll before mallard table. */
export const SPAWN_DECOY_CHANCE = 0.12;

/** Golden skyfall only after losing a life (still alive). */
export const GOLDEN_REWARD = {
  minDelayMs: 1_000,
  maxDelayMs: 10_000,
} as const;

export const MAX_LIVES = 3;
/** Bonus hearts from balloons can raise lives up to this cap. */
export const MAX_LIVES_CAP = 5;
export const BASE_POINTS = 100;
export const GOLDEN_POINTS_MULTIPLIER = 3;
export const COMBO_TIMEOUT_MS = 2000;

/** Per-duck score multipliers (see `scoring/runScore.ts`). */
export const SCORING = {
  /** Added per combo level after the first save in a streak. */
  comboPerLevel: 0.14,
  comboMaxMult: 4,
  /** Seconds survived for +100% survival bonus (linear, capped). */
  survivalFullBonusSec: 150,
  survivalMaxMult: 2,
  /** Bonus per duck already saved this run before the current save. */
  savedPerDuck: 0.04,
  savedMaxMult: 1.8,
} as const;

export const BALLOON = {
  firstMinDelayMs: 5_000,
  firstMaxDelayMs: 60_000,
  secondMinDelayMs: 60_000,
  secondMaxDelayMs: 120_000,
  entryOffScreenX: 56,
  entryYMin: HUD_TOP_PADDING + 24,
  entryYMax: GAME_HEIGHT - 120,
  floatSpeedMin: 110,
  floatSpeedMax: 150,
  displayHeight: 72,
  floatFrameRate: 10,
  popFrameRate: 14,
} as const;

export const COMBO_UI = {
  y: GAME_HEIGHT - 132,
  width: 148,
  height: 76,
  radius: 18,
} as const;

export const COLORS = {
  skyTop: 0x87ceeb,
  skyBottom: 0xb8dce8,
  cliff: 0x5d4e37,
  cliffDark: 0x3e3428,
  rock: 0x6b5b4a,
  rockDark: 0x4a3f35,
  rockHighlight: 0x8a7a68,
  moss: 0x3d7a4a,
  mossLight: 0x5a9e62,
  waterDeep: 0x1a5f7a,
  waterMid: 0x2e8aaa,
  waterLight: 0x6ec5e8,
  waterFoam: 0xc8eef8,
  mist: 0xd8eef5,
  duckBody: 0xf1c40f,
  duckBill: 0xe67e22,
  goldenBody: 0xffd700,
  goldenBill: 0xff8c00,
  heavyBody: 0xd4ac6e,
  text: '#ecf0f1',
  textMuted: '#bdc3c7',
  combo: '#f39c12',
} as const;

/** Sun descent then night; gameplay continues until lives run out. */
export const DAY_NIGHT = {
  sunSetDurationSec: 90,
  /** Skip early arc time where the sun is above the frame (game starts further along). */
  sunSetStartOffsetSec: 25,
  /** >1 = sun stays high longer, then drops quickly toward the crest. */
  sunSetEasePower: 1.75,
  /** Orange/pink sky ramps when the sun bottom is within this many px of the lip. */
  crestSunsetRangePx: 165,
  /** Warmth only ramps in the last fraction of that range (later orange). */
  sunsetWarmthStartFrac: 0.78,
  /** Keep warm sky overlay near full strength this long after the sun kisses the lip. */
  sunsetOverlayHoldSec: 5,
  /** Max multiply strength on waterfall/pool at deep night (0–1). */
  waterNightMaxAlpha: 0.4,
  /**
   * SUN COLOR (disk + halo only — sky uses crestSunsetRangePx above).
   * Bigger sunTintStartAboveLipPx → orange starts earlier (~35px ≈ 1s near crest).
   * Bigger sunTintPeakBelowLipPx → full orange later (capped to how far the sun can dip).
   */
  sunTintStartAboveLipPx: 91,
  sunTintPeakBelowLipPx: 95,
  /** Seconds after the sun dips below the crest: pink → purple → black + stars. */
  nightFadeInSec: 18,
  /** Purple gradient at bottom of screen at full night (top is 0). */
  nightPurpleBottomAlpha: 0.2,
  /** How quickly the purple wash fades in after sunset (seconds). */
  nightPurpleFadeInSec: 14,
  /** Daytime music fade window (game elapsed seconds). */
  gameplayDayMusicFadeOutStartSec: 40,
  gameplayDayMusicFadeOutEndSec: 48,
  /** Night music fade-in window (game elapsed seconds). */
  gameplayNightMusicFadeInStartSec: 45,
  gameplayNightMusicFadeInEndSec: 50,
  /** Night track begins at this offset (seconds into the loop). */
  gameplayNightStartSec: 32,
  sunDisplayHeight: 96,
  /** Screen X for sun path (right side of sky). */
  sunX: GAME_WIDTH * 0.68,
  /** Starts just above the visible frame. */
  sunStartY: -72,
  /** Lip Y used as sunset horizon (small inset = sun kisses the falls). */
  sunHorizonInsetY: 10,
  /** After the lip, sun keeps descending this many px while fading out. */
  sunDipBelowHorizonPx: 72,
  starCount: 96,
  starSkyMaxY: GAME_HEIGHT * 0.52,
} as const;

export const DIFFICULTY = {
  baseCrestDurationMs: 2200,
  minCrestDurationMs: 1500,
  crestDurationRamp: 18,
  baseGravity: 220,
  maxGravity: 620,
  gravityRamp: 5,
  maxFallVelocity: 780,
  lipFallKickVelocity: 0,
  baseSpawnInterval: 1800,
  minSpawnInterval: 600,
  intervalRamp: 18,
  /** Sleeping ducks on screen at once (ramps smoothly with elapsed time). */
  maxConcurrentBase: 2,
  maxConcurrentCap: 6,
  /** Seconds of run time to reach maxConcurrentCap. */
  concurrentRampSec: 180,
} as const;

export const DUCK = {
  width: 56,
  height: 44,
  minScale: 0.22,
  maxScale: 0.68,
  spawnBelowLip: 34,
  crestEndBelowLip: 8,
  crestDriftAlongLip: 42,
  crestApproachSpeed: 1.8,
  heavyTapRequired: 2,
  /** Min ms between first and second tap on a deep sleeper (avoids double-tap glitches). */
  heavyTapMinIntervalMs: 200,
  heavyCrestMultiplier: 1.35,
  /** Golden ducks spawn above the screen and dive straight down (life-loss reward only). */
  goldenSpawnY: -160,
  /** Scale multiplier for golden.png during the sky dive (before tap). */
  goldenFallScaleMult: 1.2,
  goldenFallGravity: 1400,
  goldenFallTerminalVelocity: 320,
  goldenFallInitialVelocity: 150,
  /** Braking after tap — px/s² until hover. */
  goldenBrakeDecel: 3200,
  goldenHoverMaxFall: 6,
  /** Ascent after wake — wavy path off top of screen. */
  goldenAscendSpeedY: 210,
  goldenAscendSpeedX: 72,
  goldenWaveAmplitudeX: 44,
  goldenWaveAmplitudeY: 14,
  goldenWaveFrequency: 3.1,
  hitAreaWidthPad: 1.5,
  hitAreaHeightPad: 1.4,
  hitAreaMinHeight: 44,
  fallHitAreaBoost: 1.55,
  fallHitLeadMs: 90,
  saveGraceMs: 1000,
  /** Max finger movement (px) between down and up to count as a tap. */
  tapSlopPx: 48,
  minSpawnSeparationX: 56,
  spawnPositionAttempts: 16,
} as const;

export const DUCK_KIND_VISUAL = {
  normal: {
    tint: null,
    tintStrength: 1,
    tintFill: false,
    scaleMult: 1,
    glowColor: 0x000000,
    glowStrength: 0,
  },
  heavy: {
    tint: 0x8a6a3a,
    /** Multiply-tint strength (deep-sleep art carries the look; was full brown wash). */
    tintStrength: 0.05,
    tintFill: false,
    scaleMult: 1.14,
    glowColor: 0x000000,
    glowStrength: 0,
  },
  golden: {
    tint: 0xfff0b8,
    tintStrength: 1,
    tintFill: false,
    scaleMult: 1,
    glowColor: 0xffe8a8,
    glowStrength: 4,
  },
  decoy: {
    tint: null,
    tintStrength: 1,
    tintFill: false,
    scaleMult: 1,
    glowColor: 0x000000,
    glowStrength: 0,
  },
} as const satisfies Record<
  DuckKind,
  {
    tint: number | null;
    tintStrength: number;
    tintFill: boolean;
    scaleMult: number;
    glowColor: number;
    glowStrength: number;
  }
>;

export const SCENE_KEYS = {
  boot: 'BootScene',
  preload: 'PreloadScene',
  assetLoader: 'AssetLoaderScene',
  menu: 'MenuScene',
  rules: 'RulesScene',
  game: 'GameScene',
  gameOver: 'GameOverScene',
} as const;

export const DUCK_SPRITE = {
  displayWidth: 58,
  displayHeight: 58,
} as const;

/** Night-only moonflower on the left cliff (duck-sized). */
export const MOONFLOWER = {
  x: 58,
  /** ~one thumb width above prior placement (left cliff near water). */
  y: 636,
  displayHeight: DUCK_SPRITE.displayHeight,
  fadeInMs: 1200,
  glowColor: 0xa8e8ff,
  glowAlpha: 0.38,
  glowPulseAlpha: 0.52,
  hitPad: 1.45,
  sproutFrameRate: 10,
  bloomFrameRate: 12,
  swayFrameRate: 8,
} as const;

export const CHARM_REVEAL = {
  fadeInMs: 250,
  holdMs: 1200,
  fadeOutMs: 280,
  flyToSlotMs: 420,
  boxBottomY: 118,
} as const;
