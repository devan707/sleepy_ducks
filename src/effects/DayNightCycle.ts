import Phaser from 'phaser';
import { ENV_KEYS } from '../config/environmentAssets';
import {
  COLORS,
  DAY_NIGHT,
  GAME_HEIGHT,
  GAME_WIDTH,
  STAGE,
} from '../config/gameConfig';
import { GameEvents } from '../core/GameEvents';
import {
  fillBelowLipMaskShape,
  getLipEmergenceMask,
  getLipSegmentGame,
  getLipYGame,
} from '../objects/EnvironmentLayout';

interface StarPoint {
  x: number;
  y: number;
  radius: number;
  phase: number;
  speed: number;
  baseAlpha: number;
}

/** Deep night — blue-black behind cliffs and in the sky veil. */
const NIGHT_SKY = 0x02040c;
const NIGHT_SKY_TOP = 0x0a1428;

/** Warm sunset while the sun is still up. */
const SUNSET = {
  pinkTop: 0xff6b9a,
  orangeTop: 0xff8f4a,
  peachMid: 0xffa86a,
  goldBottom: 0xffc890,
  hazeBottom: 0xf09078,
} as const;

/** After the sun is down: pink → purple → black. */
const TWILIGHT = {
  pinkTop: 0xf078a8,
  pinkBottom: 0xf8a0b8,
  purpleTop: 0x7a58a8,
  purpleBottom: 0x5a4878,
} as const;

/** Full-screen night wash (below ducks / moonflower). */
const NIGHT_PURPLE = 0x2e1a42;

const CREST_SHIMMER = {
  glint: 0xfff4d8,
  warm: 0xffc868,
  spark: 0xffffff,
} as const;

interface CrestShimmer {
  along: number;
  lateral: number;
  phase: number;
  speed: number;
  size: number;
}

interface NightPhases {
  pinkT: number;
  purpleT: number;
  blackT: number;
  starT: number;
}

function smoothstep(t: number): number {
  const x = Phaser.Math.Clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** Ramp 0→1 between `start` and `end` on timeline t∈[0,1]. */
function phaseWeight(t: number, start: number, end: number): number {
  if (end <= start) return t >= end ? 1 : 0;
  return smoothstep(Phaser.Math.Clamp((t - start) / (end - start), 0, 1));
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(Phaser.Math.Linear(a, b, t));
}

function lerpColor(c0: number, c1: number, t: number): number {
  const t0 = Phaser.Math.Clamp(t, 0, 1);
  const r0 = (c0 >> 16) & 0xff;
  const g0 = (c0 >> 8) & 0xff;
  const b0 = c0 & 0xff;
  const r1 = (c1 >> 16) & 0xff;
  const g1 = (c1 >> 8) & 0xff;
  const b1 = c1 & 0xff;
  return (
    (lerpChannel(r0, r1, t0) << 16) |
    (lerpChannel(g0, g1, t0) << 8) |
    lerpChannel(b0, b1, t0)
  );
}

function computeNightPhases(nightT: number): NightPhases {
  const pinkT =
    phaseWeight(nightT, 0.02, 0.26) * (1 - phaseWeight(nightT, 0.34, 0.58));
  const purpleT =
    phaseWeight(nightT, 0.14, 0.5) * (1 - phaseWeight(nightT, 0.55, 0.88));
  const blackT = phaseWeight(nightT, 0.3, 1);
  const starT = phaseWeight(nightT, 0.28, 1);
  return { pinkT, purpleT, blackT, starT };
}

/**
 * Day → orange sunset (sun arc) → pink → purple → deep night + stars.
 * Driven by run elapsed time; does not end the game.
 */
export class DayNightCycle {
  private scene: Phaser.Scene;
  private sun!: Phaser.GameObjects.Image;
  private sunGlow!: Phaser.GameObjects.Graphics;
  private skyTint!: Phaser.GameObjects.Graphics;
  private crestGlow!: Phaser.GameObjects.Graphics;
  private nightVeil!: Phaser.GameObjects.Graphics;
  private readonly crestShimmers: CrestShimmer[] = [];
  private starsGfx!: Phaser.GameObjects.Graphics;
  private atmosphere!: Phaser.GameObjects.Rectangle;
  private waterNight!: Phaser.GameObjects.Rectangle;
  private nightPurple!: Phaser.GameObjects.Graphics;
  private stars: StarPoint[] = [];
  private sunHorizonY = 0;
  private sunScreenY = 0;
  /** Live warmth from sun position (bottom vs lip). */
  private sunsetWarmth = 0;
  /** Peak warmth — never drops until twilight replaces it (prevents crest flash). */
  private heldSunsetWarmth = 0;
  private twilightStartSec: number | null = null;
  private twinkleClock = 0;
  private starVisibility = 0;
  private starsVisibleEmitted = false;
  private sunsetEmitted = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.sunHorizonY =
      getLipYGame(DAY_NIGHT.sunX) + DAY_NIGHT.sunHorizonInsetY;

    this.createSkyTint();
    this.createCrestGlow();
    this.createNightVeil();
    this.createStars();
    this.createSun();
    this.createSunGlow();
    this.createAtmosphere();
    this.createWaterNight();
    this.createNightPurple();
    this.applySkyMask();
    this.apply(0);
  }

  /** Clip sky effects to the wedge above the waterfall lip. */
  private applySkyMask(): void {
    const mask = getLipEmergenceMask(this.scene);
    this.skyTint.setMask(mask);
    this.nightVeil.setMask(mask);
    this.starsGfx.setMask(mask);
    this.atmosphere.setMask(mask);
    this.sunGlow.setMask(mask);
  }

  update(elapsedSec: number, deltaMs: number): void {
    this.twinkleClock += deltaMs * 0.001;
    this.apply(elapsedSec);
  }

  /** 0–1 star field visibility from the last `apply()` (for moonflower spawn sync). */
  getStarVisibility(): number {
    return this.starVisibility;
  }

  destroy(): void {
    this.skyTint?.destroy();
    this.crestGlow?.destroy();
    this.nightVeil?.destroy();
    this.starsGfx?.destroy();
    this.sun?.destroy();
    this.sunGlow?.destroy();
    this.atmosphere?.destroy();
    this.waterNight?.destroy();
    this.nightPurple?.destroy();
  }

  private createSkyTint(): void {
    this.skyTint = this.scene.add.graphics();
    this.skyTint.setDepth(STAGE.depthSkyTint);
    this.skyTint.setScrollFactor(0);
  }

  private createCrestGlow(): void {
    this.crestGlow = this.scene.add.graphics();
    this.crestGlow.setDepth(STAGE.depthCrestSunGlow);
    this.crestGlow.setScrollFactor(0);
    this.crestGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.seedCrestShimmers();
  }

  private createNightVeil(): void {
    this.nightVeil = this.scene.add.graphics();
    this.nightVeil.setDepth(STAGE.depthNightVeil);
    this.nightVeil.setScrollFactor(0);
  }

  private seedCrestShimmers(): void {
    const rng = new Phaser.Math.RandomDataGenerator(['crest-shimmer']);
    for (let i = 0; i < 36; i++) {
      this.crestShimmers.push({
        along: rng.frac(),
        lateral: rng.realInRange(-10, 3),
        phase: rng.frac() * Math.PI * 2,
        speed: rng.realInRange(2.8, 6.2),
        size: rng.realInRange(1, 2.8),
      });
    }
  }

  private createSun(): void {
    this.sun = this.scene.add.image(
      DAY_NIGHT.sunX,
      DAY_NIGHT.sunStartY,
      ENV_KEYS.sun,
    );
    const scale = DAY_NIGHT.sunDisplayHeight / this.sun.height;
    this.sun.setScale(scale);
    this.sun.setOrigin(0.5);
    this.sun.setDepth(STAGE.depthSun);
    this.sun.setScrollFactor(0);
  }

  private createSunGlow(): void {
    this.sunGlow = this.scene.add.graphics();
    this.sunGlow.setDepth(STAGE.depthSunGlow);
    this.sunGlow.setScrollFactor(0);
    this.sunGlow.setBlendMode(Phaser.BlendModes.ADD);
  }

  private createStars(): void {
    this.starsGfx = this.scene.add.graphics();
    this.starsGfx.setDepth(STAGE.depthStars);
    this.starsGfx.setScrollFactor(0);

    const rng = new Phaser.Math.RandomDataGenerator(['night-stars']);
    for (let i = 0; i < DAY_NIGHT.starCount; i++) {
      this.stars.push({
        x: rng.between(8, GAME_WIDTH - 8),
        y: rng.between(24, DAY_NIGHT.starSkyMaxY),
        radius: rng.frac() < 0.15 ? 2.2 : rng.frac() < 0.4 ? 1.6 : 1.1,
        phase: rng.frac() * Math.PI * 2,
        speed: rng.realInRange(1.2, 3.4),
        baseAlpha: rng.realInRange(0.45, 1),
      });
    }
  }

  private createAtmosphere(): void {
    this.atmosphere = this.scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0xffffff,
      0,
    );
    this.atmosphere.setDepth(STAGE.depthAtmosphere);
    this.atmosphere.setScrollFactor(0);
    this.atmosphere.setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  private createNightPurple(): void {
    this.nightPurple = this.scene.add.graphics();
    this.nightPurple.setDepth(STAGE.depthNightPurple);
    this.nightPurple.setScrollFactor(0);
  }

  private createWaterNight(): void {
    const maskGfx = this.scene.add.graphics();
    maskGfx.setScrollFactor(0);
    maskGfx.setVisible(false);
    fillBelowLipMaskShape(maskGfx);

    this.waterNight = this.scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0xffffff,
      0,
    );
    this.waterNight.setDepth(STAGE.depthWaterNight);
    this.waterNight.setScrollFactor(0);
    this.waterNight.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.waterNight.setMask(maskGfx.createGeometryMask());
  }

  private apply(elapsedSec: number): void {
    const {
      sunSetDurationSec,
      sunSetStartOffsetSec,
      sunSetEasePower,
      nightFadeInSec,
    } = DAY_NIGHT;

    const offsetRaw = Phaser.Math.Clamp(
      sunSetStartOffsetSec / sunSetDurationSec,
      0,
      1,
    );
    const arcStartT = smoothstep(Math.pow(offsetRaw, sunSetEasePower));
    const journeySec = Math.max(1, sunSetDurationSec - sunSetStartOffsetSec);
    const journeyRaw = Phaser.Math.Clamp(elapsedSec / journeySec, 0, 1);
    const journeyT = smoothstep(Math.pow(journeyRaw, sunSetEasePower));
    const sunT = Phaser.Math.Linear(arcStartT, 1, journeyT);

    this.updateSun(sunT);

    const sunBottom = this.sunScreenY + this.sun.displayHeight * 0.5;
    const behindHorizon = sunBottom >= this.sunHorizonY;
    if (behindHorizon && this.twilightStartSec === null) {
      this.twilightStartSec = elapsedSec;
      if (!this.sunsetEmitted) {
        this.sunsetEmitted = true;
        this.scene.events.emit(GameEvents.SUNSET);
      }
    }
    if (elapsedSec <= 0) {
      this.twilightStartSec = null;
      this.sunsetEmitted = false;
      this.heldSunsetWarmth = 0;
    }

    const afterSunset =
      this.twilightStartSec !== null ? elapsedSec - this.twilightStartSec : 0;

    const nightT = smoothstep(afterSunset / nightFadeInSec);
    const phases = computeNightPhases(nightT);
    this.starVisibility = phases.starT;

    if (phases.starT > 0.05 && !this.starsVisibleEmitted) {
      this.starsVisibleEmitted = true;
      this.scene.events.emit(GameEvents.STARS_VISIBLE);
    }

    this.updateSkyTint(nightT, phases, afterSunset);
    this.updateCrestGlow(phases);
    this.updateNightVeil(phases);
    this.updateStars(phases.starT);
    this.updateAtmosphere(nightT, phases);
    this.updateWaterNight(phases);
    this.updateNightPurple(afterSunset);
    this.updateCameraBackground(nightT, phases);
  }

  /**
   * 0–1 warmth from sun bottom vs lip (matches visual crest kiss).
   * Holds at 1 once the bottom reaches the lip.
   */
  private computeSunsetWarmth(sunCenterY: number, halfH: number): number {
    const sunBottom = sunCenterY + halfH;
    const distBottom = this.sunHorizonY - sunBottom;
    const range = DAY_NIGHT.crestSunsetRangePx;
    const start = DAY_NIGHT.sunsetWarmthStartFrac;

    if (distBottom <= 0) return 1;

    const raw = Phaser.Math.Clamp(1 - distBottom / range, 0, 1);
    if (raw <= start) return 0;
    return smoothstep((raw - start) / (1 - start));
  }

  /** Sun sprite tint only — wider ramp than sky warmth (~2s earlier, ~3s later peak). */
  private computeSunTintT(sunCenterY: number, halfH: number): number {
    const sunBottom = sunCenterY + halfH;
    const distBottom = this.sunHorizonY - sunBottom;
    const startPx = DAY_NIGHT.sunTintStartAboveLipPx;
    const maxReachBelow =
      DAY_NIGHT.sunDipBelowHorizonPx + halfH - 4;
    const peakBelow = Math.min(
      DAY_NIGHT.sunTintPeakBelowLipPx,
      maxReachBelow,
    );

    if (distBottom >= startPx) return 0;
    if (distBottom <= -peakBelow) return 1;

    const span = startPx + peakBelow;
    return smoothstep((startPx - distBottom) / span);
  }

  /** Orange / peach sky when the sun nears the waterfall crest. */
  private sunsetSkyColors(warmth: number): {
    top: number;
    bottom: number;
    strength: number;
  } {
    const warmT = smoothstep(warmth);
    const duskPeak = smoothstep(
      Phaser.Math.Clamp((warmth - 0.2) / 0.8, 0, 1),
    );

    const top = lerpColor(
      lerpColor(COLORS.skyTop, SUNSET.orangeTop, warmT),
      SUNSET.pinkTop,
      duskPeak * 0.35,
    );
    const bottom = lerpColor(
      lerpColor(
        lerpColor(COLORS.skyBottom, SUNSET.peachMid, warmT),
        SUNSET.goldBottom,
        duskPeak * 0.88,
      ),
      SUNSET.hazeBottom,
      duskPeak * 0.55,
    );
    const strength = warmT * 0.52 + duskPeak * 0.42;
    return { top, bottom, strength };
  }

  /** Full sky gradient after sunset phases (pink → purple → black). */
  private twilightSkyColors(
    sunset: { top: number; bottom: number },
    phases: NightPhases,
  ): { top: number; bottom: number } {
    let top = sunset.top;
    let bottom = sunset.bottom;

    top = lerpColor(top, TWILIGHT.pinkTop, phases.pinkT);
    bottom = lerpColor(bottom, TWILIGHT.pinkBottom, phases.pinkT);

    top = lerpColor(top, TWILIGHT.purpleTop, phases.purpleT);
    bottom = lerpColor(bottom, TWILIGHT.purpleBottom, phases.purpleT);

    top = lerpColor(top, NIGHT_SKY_TOP, phases.blackT);
    bottom = lerpColor(bottom, NIGHT_SKY, phases.blackT);

    return { top, bottom };
  }

  private updateSun(sunT: number): void {
    const endY = this.sunHorizonY + DAY_NIGHT.sunDipBelowHorizonPx;
    const y = Phaser.Math.Linear(DAY_NIGHT.sunStartY, endY, sunT);
    this.sun.setPosition(DAY_NIGHT.sunX, y);
    this.sunScreenY = y;

    const halfH = this.sun.displayHeight * 0.5;
    const fadeStartY = this.sunHorizonY - halfH * 0.35;
    const fadeEndY = endY;
    const fadeT =
      y <= fadeStartY
        ? 0
        : Phaser.Math.Clamp((y - fadeStartY) / Math.max(1, fadeEndY - fadeStartY), 0, 1);
    const alpha = 1 - smoothstep(fadeT);

    const liveWarmth = this.computeSunsetWarmth(y, halfH);
    this.heldSunsetWarmth = Math.max(this.heldSunsetWarmth, liveWarmth);
    this.sunsetWarmth = this.heldSunsetWarmth;

    const sunTintT = this.computeSunTintT(y, halfH);
    const sunBottom = y + halfH;
    const behindLip = sunBottom >= this.sunHorizonY - 2;
    const lipFade = behindLip
      ? 0
      : Phaser.Math.Clamp(1 - (sunBottom - (this.sunHorizonY - halfH * 0.5)) / (halfH * 0.5), 0, 1);
    const glowStrength =
      sunTintT * (0.22 + 0.78 * alpha) * smoothstep(lipFade);

    const scale = 1 + sunTintT * 0.1;
    this.sun.setScale((DAY_NIGHT.sunDisplayHeight / this.sun.height) * scale);
    this.sun.setTint(lerpColor(0xfff0d8, 0xff7020, sunTintT));

    this.sun.setAlpha(alpha);
    this.sun.setVisible(alpha > 0.02);

    this.updateSunGlow(sunTintT, glowStrength);
  }

  private updateSunGlow(warmth: number, strength: number): void {
    const g = this.sunGlow;
    g.clear();
    if (strength < 0.008) return;

    const x = DAY_NIGHT.sunX;
    const y = this.sunScreenY;
    const maxR = this.sun.displayWidth * 1.45;
    const steps = 20;
    const haloColor = lerpColor(0xffa858, 0xff6620, warmth);
    const coreColor = lerpColor(0xffc070, 0xff8830, warmth);

    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const r = maxR * t;
      const falloff = (1 - t) * (1 - t);
      const a = strength * falloff * 0.13;
      if (a < 0.002) continue;
      g.fillStyle(haloColor, a);
      g.fillCircle(x, y, r);
    }

    const coreA = strength * 0.06;
    if (coreA >= 0.004) {
      g.fillStyle(coreColor, coreA);
      g.fillCircle(x, y - 1, this.sun.displayWidth * 0.3);
    }
  }

  private updateSkyTint(
    nightT: number,
    phases: NightPhases,
    afterSunset: number,
  ): void {
    const g = this.skyTint;
    g.clear();

    if (this.sunsetWarmth <= 0.001 && nightT <= 0.001) return;

    const sunset = this.sunsetSkyColors(this.sunsetWarmth);
    const { top, bottom } =
      nightT > 0.001
        ? this.twilightSkyColors(sunset, phases)
        : { top: sunset.top, bottom: sunset.bottom };

    const warmHold =
      this.twilightStartSec === null
        ? 1
        : 1 -
          smoothstep(
            afterSunset / Math.max(0.1, DAY_NIGHT.sunsetOverlayHoldSec),
          );

    const overlayStrength = Phaser.Math.Clamp(
      sunset.strength * warmHold * (1 - nightT * 0.55) +
        phases.pinkT * 0.45 +
        phases.purpleT * 0.55 +
        phases.blackT * 0.95,
      0,
      0.96,
    );

    g.fillGradientStyle(
      top,
      top,
      bottom,
      bottom,
      overlayStrength,
      overlayStrength,
      overlayStrength * 0.78,
      overlayStrength * 0.78,
    );
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  private updateNightVeil(phases: NightPhases): void {
    const g = this.nightVeil;
    g.clear();

    const veilAlpha = Phaser.Math.Clamp(
      phases.purpleT * 0.35 + phases.blackT * 0.88,
      0,
      0.92,
    );
    if (veilAlpha < 0.02) return;

    g.fillGradientStyle(
      NIGHT_SKY_TOP,
      NIGHT_SKY_TOP,
      NIGHT_SKY,
      NIGHT_SKY,
      veilAlpha,
      veilAlpha,
      veilAlpha * 0.96,
      veilAlpha * 0.96,
    );
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  private updateCrestGlow(phases: NightPhases): void {
    const g = this.crestGlow;
    g.clear();

    const approach = this.sunsetWarmth * (1 - phases.purpleT * 0.5 - phases.blackT * 0.2);

    if (approach < 0.05) return;

    const strength = approach * 1.45;
    if (strength < 0.02) return;

    const lip = getLipSegmentGame();
    const { left, right } = lip;
    const lx = left.x;
    const ly = left.y;
    const dx = right.x - lx;
    const dy = right.y - ly;
    const len = Math.hypot(dx, dy) || 1;
    const tx = dx / len;
    const ty = dy / len;
    const nx = -ty;
    const ny = tx;

    for (const shimmer of this.crestShimmers) {
      const pulse =
        0.5 +
        0.5 * Math.sin(this.twinkleClock * shimmer.speed + shimmer.phase);
      const spark = pulse * pulse * strength;
      if (spark < 0.1) continue;

      const x = lx + dx * shimmer.along + nx * shimmer.lateral;
      const y = ly + dy * shimmer.along + ny * shimmer.lateral;
      const w = shimmer.size * 2.8;
      const h = shimmer.size * 0.9;

      g.fillStyle(CREST_SHIMMER.warm, spark * 0.48);
      g.fillEllipse(x, y, w * 1.15, h * 1.2);
      g.fillStyle(CREST_SHIMMER.spark, spark * 0.85);
      g.fillCircle(x, y - 0.5, shimmer.size * 0.75);
    }

    const rimAlpha = strength * 0.42;
    if (rimAlpha > 0.04) {
      g.lineStyle(3, CREST_SHIMMER.warm, rimAlpha);
      g.lineBetween(lx, ly, right.x, right.y);
      g.lineStyle(5, CREST_SHIMMER.glint, rimAlpha * 0.35);
      g.lineBetween(lx, ly - 1, right.x, right.y - 1);
    }

    for (let i = 0; i < 2; i++) {
      const travel =
        ((this.twinkleClock * (0.38 + i * 0.11) + i * 1.9) % 1 + 1) % 1;
      const x = lx + dx * travel;
      const y = ly + dy * travel;
      const glintWave =
        0.5 + 0.5 * Math.sin(this.twinkleClock * (3.4 + i * 0.7) + i * 2.3);
      const glint = glintWave * glintWave * glintWave * strength;
      if (glint < 0.08) continue;

      const halfW = 16 + i * 6;
      g.lineStyle(2, CREST_SHIMMER.glint, glint * 0.5);
      g.lineBetween(x - tx * halfW, y - ty * halfW, x + tx * halfW, y + ty * halfW);
      g.fillStyle(CREST_SHIMMER.glint, glint * 0.72);
      g.fillEllipse(x, y - 1, 6, 2.4);
      g.fillStyle(CREST_SHIMMER.spark, glint);
      g.fillCircle(x, y - 1, 2);
    }
  }

  private updateStars(starT: number): void {
    const g = this.starsGfx;
    g.clear();

    if (starT <= 0.01) return;

    const fieldAlpha = starT * 1;

    for (const star of this.stars) {
      const twinkle =
        0.5 +
        0.5 *
          Math.sin(this.twinkleClock * star.speed + star.phase);
      const a = fieldAlpha * star.baseAlpha * twinkle;
      if (a < 0.04) continue;
      g.fillStyle(0xffffff, a);
      g.fillCircle(star.x, star.y, star.radius);
    }
  }

  private updateAtmosphere(nightT: number, phases: NightPhases): void {
    const warmT = smoothstep(this.sunsetWarmth);
    const duskPeak = smoothstep(
      Phaser.Math.Clamp((this.sunsetWarmth - 0.45) / 0.55, 0, 1),
    );
    const sunsetTint = lerpColor(0xc87848, 0xe88858, duskPeak);

    let tint = sunsetTint;
    tint = lerpColor(tint, 0xd878a8, phases.pinkT);
    tint = lerpColor(tint, 0x584878, phases.purpleT);
    tint = lerpColor(tint, 0x0a0e18, phases.blackT);

    const sunsetAlpha =
      warmT * 0.32 * (1 - nightT * 0.45) + duskPeak * 0.12;
    const twilightAlpha =
      phases.pinkT * 0.12 +
      phases.purpleT * 0.18 +
      phases.blackT * 0.38;
    const alpha = Phaser.Math.Clamp(sunsetAlpha + twilightAlpha, 0, 0.62);

    this.atmosphere.setFillStyle(tint, alpha);
  }

  private updateWaterNight(phases: NightPhases): void {
    const nightMix = Phaser.Math.Clamp(
      phases.purpleT * 0.35 + phases.blackT * 0.85,
      0,
      1,
    );
    if (nightMix < 0.02) {
      this.waterNight.setAlpha(0);
      return;
    }

    const tint = lerpColor(0x8098b0, 0x1a2438, nightMix);
    const alpha = nightMix * DAY_NIGHT.waterNightMaxAlpha;
    this.waterNight.setFillStyle(tint, alpha);
  }

  /** Subtle purple gradient over the scene; ramps in after sunset (ducks/moonflower above). */
  private updateNightPurple(afterSunset: number): void {
    const g = this.nightPurple;
    g.clear();

    const fade = smoothstep(
      afterSunset / Math.max(0.1, DAY_NIGHT.nightPurpleFadeInSec),
    );
    if (fade < 0.001) return;

    const bottomA = DAY_NIGHT.nightPurpleBottomAlpha * fade;
    g.fillGradientStyle(
      NIGHT_PURPLE,
      NIGHT_PURPLE,
      NIGHT_PURPLE,
      NIGHT_PURPLE,
      0,
      0,
      bottomA,
      bottomA,
    );
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  private updateCameraBackground(nightT: number, phases: NightPhases): void {
    const sunset = this.sunsetSkyColors(this.sunsetWarmth);
    const sky =
      nightT > 0.001
        ? this.twilightSkyColors(sunset, phases)
        : { top: sunset.top, bottom: sunset.bottom };
    const bg =
      phases.blackT > 0.5
        ? lerpColor(sky.bottom, NIGHT_SKY, (phases.blackT - 0.5) * 2)
        : sky.bottom;
    this.scene.cameras.main.setBackgroundColor(bg);
  }
}
