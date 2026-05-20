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
  /** Combo meter — above base HUD, below toasts. */
  depthComboHud: 101,
  /** Bottom gameplay toasts — above combo meter and HUD. */
  depthGameplayToast: 120,
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

/** Shuffled quota bag keeps long-run rates while reducing streaks. */
export const DUCK_SPAWN = {
  /** Mallards drawn per shuffled bag before refill. */
  bagSize: 25,
  /** Max heavy sleepers in a row within one bag (when mix allows). */
  maxHeavyStreak: 2,
  /** Max same-sex mallards in a row within one bag (when mix allows). */
  maxSexStreak: 4,
  /** Heavy share ramps from rare at 0s to common by 60s (sex ratios within each kind preserved). */
  heavyShareRamp: {
    intensityStepSec: 10,
    intensityRampSec: 60,
    heavyShareByStep: [0.05, 0.08, 0.12, 0.16, 0.20, 0.24, 0.30] as const,
  },
} as const;

/** Decoys use a separate spawn clock — never mixed into the mallard schedule. */
export const DECOY_SPAWN = {
  /** Decoys can spawn from run start. */
  minElapsedSec: 0,
  intensityStepSec: 10,
  intensityRampSec: 60,
  /** Ms between decoy spawns at 0s, 10s, 20s … 60s. */
  intervalByStep: [8000, 7000, 6000, 5000, 4000, 3000, 2000] as const,
  /** Max decoys on screen at the same steps. */
  maxConcurrentByStep: [1, 1, 1, 2, 2, 2, 3] as const,
  minIntervalMs: 2000,
  postRampIntervalSec: 60,
} as const;

/** Golden skyfall within 6s after a duck is missed (life lost, still alive). */
export const GOLDEN_REWARD = {
  minDelayMs: 800,
  maxDelayMs: 6_000,
} as const;

export const MAX_LIVES = 3;
/** Bonus hearts from balloons can raise lives up to this cap. */
export const MAX_LIVES_CAP = 5;
export const BASE_POINTS = 100;
export const GOLDEN_POINTS_MULTIPLIER = 3;

/** Golden duck saves fill the egg; full egg grants +1 life. */
export const GOLDEN_EGG = {
  savesRequired: 2,
  /** Full golden egg on screen before the reward toast. */
  fullDisplayMs: 1500,
} as const;

export const COMBO = {
  /** Reference window — actual drain scales gently with spawn difficulty. */
  baseTimeoutMs: 2200,
  /** Drain multiplier at run start (lower = meter empties slower). */
  drainMultAtStart: 0.75,
  /** Drain at peak spawn rate — kept close to start so late game stays chainable. */
  drainMultAtPeak: 0.92,
  /** Each combo level above 2 slightly slows drain (reward longer streaks). */
  streakDrainReliefPerLevel: 0.005,
  streakDrainReliefMax: 0.1,
  /** Combo counts that trigger a celebration sound + burst. */
  milestones: [5, 10, 20, 30, 50, 75, 100] as const,
  /** Score multiplier unlocked at each milestone (same index as `milestones`). */
  milestoneMultipliers: [1.5, 1.8, 2.2, 2.6, 3.2, 3.6, 4.0] as const,
} as const;

export type ComboMilestone = (typeof COMBO.milestones)[number];

/** Highest milestone tier reached (0 = 5 combo …); -1 if below first milestone. */
export function getComboMilestoneIndexReached(combo: number): number {
  let reached = -1;
  for (let i = 0; i < COMBO.milestones.length; i++) {
    if (combo >= COMBO.milestones[i]) reached = i;
  }
  return reached;
}

/** Exact hit on a milestone count — for fanfare / highlight (null if not a milestone). */
export function getComboMilestoneTier(combo: number): number | null {
  const idx = COMBO.milestones.indexOf(combo as ComboMilestone);
  return idx >= 0 ? idx : null;
}

/** @deprecated Use COMBO.baseTimeoutMs */
export const COMBO_TIMEOUT_MS = COMBO.baseTimeoutMs;

/** Per-duck score multipliers (see `scoring/runScore.ts`). */
export const SCORING = {
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
  y: GAME_HEIGHT - 108,
  width: 207,
  height: 107,
  radius: 25,
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
  gameplayNightStartSec: 30,
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

/** Elapsed run seconds when the sun reaches the crest (SUNSET event). */
export function getSunsetElapsedSec(): number {
  return DAY_NIGHT.sunSetDurationSec - DAY_NIGHT.sunSetStartOffsetSec;
}

/** Bottom-screen toast panels (moonflower hint, rewards, etc.). */
export const GAMEPLAY_TOAST = {
  panelAlpha: 0.84,
  fadeInMs: 1000,
  holdMs: 2000,
  fadeOutMs: 1000,
  /** Raise toasts above the combo panel center. */
  yOffsetAboveCombo: 32,
  panelMinWidth: 320,
  panelHeight: 100,
  panelPadX: 22,
  panelRadius: 18,
  imageSize: 54,
  imageGap: 14,
  fontSize: '19px',
} as const;

/** Y center for bottom toasts — layered over the combo panel. */
export function getGameplayToastY(): number {
  return COMBO_UI.y - GAMEPLAY_TOAST.yOffsetAboveCombo;
}

export const MOONFLOWER_HINT = {
  secBeforeSunset: 14,
} as const;

export function getMoonflowerHintAtSec(): number {
  return getSunsetElapsedSec() - MOONFLOWER_HINT.secBeforeSunset;
}

export const DIFFICULTY = {
  maxFallVelocity: 780,
  lipFallKickVelocity: 0,
  minSpawnInterval: 520,
  minCrestDurationMs: 1500,
  maxGravity: 620,
  /** Every N seconds, intensity steps up for the first minute. */
  intensityStepSec: 10,
  intensityRampSec: 60,
  /** Spawn interval (ms) at 0s, 10s, 20s … 60s. */
  spawnIntervalByStep: [1700, 1450, 1200, 1020, 880, 760, 660] as const,
  /** Max sleeping ducks at 0s, 10s, 20s … 60s. */
  maxConcurrentByStep: [3, 3, 4, 5, 6, 6, 7] as const,
  /** Crest cycle length (ms) at each step — shorter = ducks reach lip sooner. */
  crestDurationByStep: [2250, 2100, 1950, 1820, 1680, 1570, 1500] as const,
  /** Fall gravity at each step. */
  gravityByStep: [215, 235, 260, 290, 325, 365, 400] as const,
  /** Ducks on the lane when a run begins (keep low for a gentle open). */
  initialSpawnCount: 2,
  /** After 60s, spawn interval eases down to minSpawnInterval over this duration. */
  postRampSpawnIntervalSec: 90,
  /** Extra mallard pressure at 1:20, 1:40, and 2:00 (applies for the rest of the run). */
  lateSpikes: [
    { atSec: 80, spawnIntervalMs: 470, maxConcurrent: 8 },
    { atSec: 100, spawnIntervalMs: 360, maxConcurrent: 10 },
    { atSec: 120, spawnIntervalMs: 200, maxConcurrent: 12 },
  ] as const,
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
  /** Crest freeze after tapping a duck before it is saveable (eyes-open wake pose). */
  earlyTapPauseMs: 1000,
  /** Min px below the lip (container y) before a falling duck can be saved. */
  saveableBelowLipMin: 14,
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

/** @deprecated Use GAMEPLAY_TOAST — kept for MoonflowerCollectToast layout hints. */
export const MOONFLOWER_COLLECT_TOAST = {
  flowerHeight: 36,
} as const;
