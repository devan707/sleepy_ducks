import Phaser from 'phaser';
import {
  DREAMWEED_ANIM_KEYS,
  DREAMWEED_ATLAS_KEYS,
} from '../config/dreamweedAssets';
import { DREAMWEED, STAGE } from '../config/gameConfig';
import { getCrestApproachPosition, getLipYGame } from './EnvironmentLayout';
import type { StageLayout, WaterfallStage } from './WaterfallStage';

type DreamweedMotionPhase = 'cresting' | 'falling';

/** Prevents gameplay taps from passing through dreamweed grab/swipe. */
export class DreamweedGrabSuppress {
  private static active = false;

  static arm(): void {
    DreamweedGrabSuppress.active = true;
  }

  static consume(): boolean {
    if (!DreamweedGrabSuppress.active) return false;
    DreamweedGrabSuppress.active = false;
    return true;
  }

  static reset(): void {
    DreamweedGrabSuppress.active = false;
  }
}

export class Dreamweed extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Graphics;
  private glowPulse: Phaser.Tweens.Tween | null = null;
  private waterfallStage: WaterfallStage;
  private layout: StageLayout;
  private crestStartX: number;
  private crestProgress = 0;
  private motionPhase: DreamweedMotionPhase = 'cresting';
  private poolMaskApplied = false;
  private spinAngle = 0;
  private hitW = 0;
  private hitH = 0;
  private displayH = 0;
  private fallVelocity: number = DREAMWEED.fallSpeedStart;
  private fallSpin = 0;
  private fallRotation = 0;
  private grabbed = false;
  private rockSnagMs = 0;
  private rockSnagBypassUntilMs = 0;

  constructor(
    scene: Phaser.Scene,
    crestStartX: number,
    layout: StageLayout,
    waterfallStage: WaterfallStage,
    fallSpin: number,
    fallRotation: number,
  ) {
    const start = getCrestApproachPosition(
      crestStartX,
      0,
      DREAMWEED.spawnBelowLip,
      DREAMWEED.crestEndBelowLip,
      DREAMWEED.crestDriftAlongLip,
      layout.laneMinX,
      layout.laneMaxX,
    );
    super(scene, start.x, start.y);

    this.crestStartX = crestStartX;
    this.layout = layout;
    this.waterfallStage = waterfallStage;
    this.fallSpin = fallSpin;
    this.fallRotation = fallRotation;

    this.glow = scene.add.graphics();
    this.glow.setBlendMode(Phaser.BlendModes.ADD);
    this.drawGlow(DREAMWEED.glowAlpha);

    this.sprite = scene.add.sprite(0, 0, DREAMWEED_ATLAS_KEYS.sway, 'frame_000');
    this.sprite.setOrigin(0.5, 1);
    this.fitSprite();
    this.sprite.setAlpha(DREAMWEED.alphaSpawn);
    if (scene.anims.exists(DREAMWEED_ANIM_KEYS.sway)) {
      this.sprite.play(DREAMWEED_ANIM_KEYS.sway);
    }

    this.add([this.glow, this.sprite]);
    this.positionGlow();
    this.setSize(this.hitW, this.hitH);
    this.setRotation(0);

    scene.add.existing(this);
    this.startGlowPulse();
    this.applyCrestVisuals();
    this.applyPoolPhase();
  }

  get isGrabbed(): boolean {
    return this.grabbed;
  }

  /** True while dreamweed is slowed on a cascade rock (easier swipe target). */
  isRockSnagged(): boolean {
    return (
      this.active &&
      this.motionPhase === 'falling' &&
      this.isPastLip() &&
      this.rockSnagMs > 0
    );
  }

  containsWorldPoint(worldX: number, worldY: number): boolean {
    if (!this.active || !this.visible || this.motionPhase !== 'falling') return false;
    return this.isNearWorldPoint(worldX, worldY, this.getHitPad());
  }

  /** Looser proximity test for swipe-to-collect on rock-snagged weed. */
  isNearWorldPoint(worldX: number, worldY: number, pad = this.getHitPad()): boolean {
    const w = this.hitW * pad;
    const h = this.hitH * pad;
    const cx = this.x;
    const cy = this.y - h * 0.5;
    const dx = worldX - cx;
    const dy = worldY - cy;
    const r = Math.max(w, h) * 0.55;
    return dx * dx + dy * dy <= r * r;
  }

  private getHitPad(): number {
    return this.isRockSnagged() ? DREAMWEED.rockSnagHitPad : 1;
  }

  tryBeginGrab(): boolean {
    if (!this.active || this.grabbed || this.motionPhase !== 'falling') return false;
    this.grabbed = true;
    return true;
  }

  releaseGrab(): void {
    this.grabbed = false;
  }

  trySwipeCollect(dx: number): boolean {
    if (!this.grabbed || !this.active) return false;
    return Math.abs(dx) >= DREAMWEED.swipeMinPx;
  }

  updateMotion(deltaMs: number): void {
    if (!this.active) return;
    if (this.motionPhase === 'cresting') {
      this.updateCresting(deltaMs);
      return;
    }
    this.updateFalling(deltaMs);
  }

  isOffScreen(): boolean {
    return this.y > this.layout.mistZoneTop;
  }

  private updateCresting(deltaMs: number): void {
    const dt = deltaMs / DREAMWEED.crestDurationMs;
    this.crestProgress = Math.min(
      1,
      this.crestProgress + dt * DREAMWEED.crestApproachSpeed,
    );
    this.applyCrestPosition();
    this.applyCrestVisuals();
    this.applyPoolPhase();

    if (this.crestProgress >= 0.999) {
      this.beginFreefall();
    }
  }

  private updateFalling(deltaMs: number): void {
    if (this.grabbed) {
      this.fallVelocity = 0;
      this.applyFallVisuals();
      this.applyPoolPhase();
      return;
    }

    const dt = deltaMs / 1000;
    const prevY = this.y;
    const now = this.scene.time.now;
    let overRock =
      now >= this.rockSnagBypassUntilMs && this.isOverRock(prevY, dt);

    if (overRock) {
      this.rockSnagMs += deltaMs;
      if (this.rockSnagMs >= DREAMWEED.rockMaxSnagMs) {
        this.rockSnagMs = 0;
        this.rockSnagBypassUntilMs = now + DREAMWEED.rockSnagBypassMs;
        this.fallVelocity = Math.max(this.fallVelocity, DREAMWEED.rockSlideOffSpeed);
      } else {
        this.fallVelocity = Phaser.Math.Linear(
          this.fallVelocity,
          DREAMWEED.rockSlowFallSpeed,
          Math.min(1, dt * 14),
        );
      }
    } else {
      this.rockSnagMs = 0;
      this.fallVelocity = Math.min(
        DREAMWEED.maxFallVelocity,
        this.fallVelocity + DREAMWEED.fallGravityAccel * dt,
      );
    }

    this.y += this.fallVelocity * dt;

    this.applyFallVisuals();
    this.applyPoolPhase();
    this.applyFallRotation(deltaMs);
  }

  private isOverRock(prevY: number, dt: number): boolean {
    if (this.motionPhase !== 'falling' || !this.isPastLip()) return false;
    const lead =
      this.fallVelocity < 80
        ? 8
        : Math.min(this.fallVelocity * 0.025, 22);
    const probeY = prevY + this.fallVelocity * dt;
    return (
      this.waterfallStage
        .getRocks()
        .hitTestSegment(this.x, prevY, probeY, lead) != null
    );
  }

  private applyFallRotation(deltaMs: number): void {
    if (!this.isPastLip()) return;
    this.spinAngle += this.fallSpin * deltaMs;
    this.setRotation(this.fallRotation + this.spinAngle);
  }

  private applyCrestPosition(): void {
    const t = this.easeCrest(this.crestProgress);
    const pos = getCrestApproachPosition(
      this.crestStartX,
      t,
      DREAMWEED.spawnBelowLip,
      DREAMWEED.crestEndBelowLip,
      DREAMWEED.crestDriftAlongLip,
      this.layout.laneMinX,
      this.layout.laneMaxX,
    );
    this.x = pos.x;
    this.y = pos.y;
  }

  private beginFreefall(): void {
    if (this.motionPhase === 'falling') return;
    this.motionPhase = 'falling';
    const lipY = getLipYGame(this.x);
    this.y = lipY + this.layout.lipFallThreshold + 1;
    this.fallVelocity = DREAMWEED.fallSpeedStart;
    this.rockSnagMs = 0;
    this.rockSnagBypassUntilMs = 0;
    this.setRotation(0);
    this.applyFallVisuals();
    this.applyPoolPhase();
  }

  private isPastLip(): boolean {
    if (this.motionPhase !== 'falling') return false;
    const lipY = getLipYGame(this.x);
    return this.y > lipY + this.layout.lipFallThreshold;
  }

  /** Hidden until past the lip; then masked on the falls with alpha ramp. */
  private applyPoolPhase(): void {
    const visible = this.isPastLip();
    this.setVisible(visible);
    this.glow.setVisible(visible);

    if (!visible) {
      this.setRotation(0);
      this.spinAngle = 0;
      return;
    }

    this.updateAlpha();
    this.ensurePoolMask();
  }

  private updateAlpha(): void {
    if (!this.isPastLip()) {
      this.sprite.setAlpha(DREAMWEED.alphaSpawn);
      return;
    }

    const lipY = getLipYGame(this.x);
    const pastPx = this.y - lipY - this.layout.lipFallThreshold;
    const t = Phaser.Math.Clamp(pastPx / DREAMWEED.alphaSettlePx, 0, 1);
    this.sprite.setAlpha(
      Phaser.Math.Linear(DREAMWEED.alphaSpawn, DREAMWEED.alphaAfterLip, t),
    );
  }

  private applyCrestVisuals(): void {
    const scale = Phaser.Math.Linear(0.82, 1, this.crestProgress);
    this.setScale(scale);
    this.setDepth(STAGE.duckDepthBehind);
  }

  private applyFallVisuals(): void {
    this.setDepth(STAGE.duckDepthBehind);
  }

  private ensurePoolMask(): void {
    if (this.poolMaskApplied) return;
    this.setMask(this.waterfallStage.getLipPoolMask());
    this.poolMaskApplied = true;
  }

  private clearPoolMask(): void {
    this.clearMask();
    this.poolMaskApplied = false;
  }

  private easeCrest(t: number): number {
    return 1 - Math.pow(1 - t, 3.2);
  }

  private fitSprite(): void {
    const frame = this.sprite.frame;
    const targetH = DREAMWEED.displayHeight;
    const fit = targetH / frame.height;
    const w = frame.width * fit;
    this.displayH = targetH;
    this.sprite.setDisplaySize(w, targetH);
    this.hitW = w * DREAMWEED.hitPad;
    this.hitH = targetH * DREAMWEED.hitPad;
    this.setSize(this.hitW, this.hitH);
  }

  private positionGlow(): void {
    this.glow.y = -this.displayH * 0.48;
  }

  private drawGlow(alpha: number): void {
    this.glow.clear();
    const c = DREAMWEED.glowColor;
    const layers = [
      { r: 32, a: alpha * 0.06 },
      { r: 22, a: alpha * 0.1 },
      { r: 14, a: alpha * 0.18 },
      { r: 7, a: alpha * 0.12 },
    ];
    for (const layer of layers) {
      this.glow.fillStyle(c, layer.a);
      this.glow.fillCircle(0, 0, layer.r);
    }
  }

  private startGlowPulse(): void {
    this.glowPulse?.stop();
    this.glowPulse = this.scene.tweens.add({
      targets: { a: DREAMWEED.glowAlpha },
      a: DREAMWEED.glowPulseAlpha,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      onUpdate: (_t, target) => {
        this.drawGlow((target as { a: number }).a);
      },
    });
  }

  override destroy(fromScene?: boolean): void {
    this.glowPulse?.stop();
    this.clearPoolMask();
    super.destroy(fromScene);
  }
}
