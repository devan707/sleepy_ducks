import Phaser from 'phaser';
import {
  DREAMWEED_ANIM_KEYS,
  DREAMWEED_ATLAS_KEYS,
} from '../config/dreamweedAssets';
import { DREAMWEED, STAGE, type RockObstacleId } from '../config/gameConfig';
import { getCrestApproachPosition, getLipYGame } from './EnvironmentLayout';
import type { RockObstacleBounds } from './WaterfallRocks';
import type { StageLayout, WaterfallStage } from './WaterfallStage';

type DreamweedMotionPhase = 'cresting' | 'falling';
type DreamweedFallPhase = 'free' | 'rockSnag';

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
  private fallPhase: DreamweedFallPhase = 'free';
  private slideVelocityX = 0;
  private snagRockId: RockObstacleId | null = null;
  private clearedRockIds = new Set<RockObstacleId>();

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

  containsWorldPoint(worldX: number, worldY: number): boolean {
    if (!this.active || !this.visible || this.motionPhase !== 'falling') return false;
    const left = this.x - this.hitW * 0.5;
    const top = this.y - this.hitH;
    return (
      worldX >= left &&
      worldX <= left + this.hitW &&
      worldY >= top &&
      worldY <= this.y
    );
  }

  tryBeginGrab(): boolean {
    if (!this.active || this.grabbed || this.motionPhase !== 'falling') return false;
    this.grabbed = true;
    DreamweedGrabSuppress.arm();
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
    return this.y > DREAMWEED.despawnBelowY;
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
    const dt = deltaMs / 1000;

    if (this.fallPhase === 'rockSnag') {
      this.updateRockSnag(dt, deltaMs);
      return;
    }

    this.fallVelocity = Math.min(
      DREAMWEED.maxFallVelocity,
      this.fallVelocity + DREAMWEED.fallGravityAccel * dt,
    );
    const prevY = this.y;
    this.y += this.fallVelocity * dt;

    if (!this.grabbed) {
      const rock = this.checkRockHit(prevY);
      if (rock && !this.clearedRockIds.has(rock.id)) {
        this.beginRockSnag(rock);
        this.applyFallVisuals();
        this.applyPoolPhase();
        return;
      }
    }

    this.applyFallVisuals();
    this.applyPoolPhase();
    this.applyFallRotation(deltaMs);
  }

  private updateRockSnag(dt: number, deltaMs: number): void {
    this.fallVelocity = Phaser.Math.Linear(
      this.fallVelocity,
      DREAMWEED.rockSnagFallSpeed,
      Math.min(1, dt * 6),
    );
    const prevY = this.y;
    this.y += this.fallVelocity * dt;
    this.x += this.slideVelocityX * dt;
    this.x = Phaser.Math.Clamp(this.x, this.layout.laneMinX, this.layout.laneMaxX);

    this.applyFallVisuals();
    this.applyPoolPhase();

    if (this.isPastLip()) {
      const slideTilt =
        Math.sign(this.slideVelocityX || 1) * DREAMWEED.rockSlideTiltDeg;
      this.spinAngle += this.fallSpin * deltaMs * 0.35;
      this.setRotation(this.fallRotation + this.spinAngle + slideTilt);
    }

    const rock = this.checkRockHit(prevY);
    if (!rock || rock.id !== this.snagRockId) {
      if (this.snagRockId) this.clearedRockIds.add(this.snagRockId);
      this.fallPhase = 'free';
      this.slideVelocityX = 0;
      this.snagRockId = null;
      this.fallVelocity = DREAMWEED.rockSnagFallSpeed;
      this.applyFallRotation(deltaMs);
    }
  }

  private beginRockSnag(rock: RockObstacleBounds): void {
    this.fallPhase = 'rockSnag';
    this.snagRockId = rock.id;
    this.fallVelocity = Math.min(this.fallVelocity, DREAMWEED.rockSnagFallSpeed);

    const dx = this.x - rock.x;
    let slideDir: number;
    if (Math.abs(dx) > 6) {
      slideDir = dx >= 0 ? 1 : -1;
    } else {
      const roomLeft = this.x - this.layout.laneMinX;
      const roomRight = this.layout.laneMaxX - this.x;
      slideDir = roomRight >= roomLeft ? 1 : -1;
    }
    this.slideVelocityX = slideDir * DREAMWEED.rockSlideSpeed;
  }

  private checkRockHit(prevY = this.y): RockObstacleBounds | null {
    if (this.motionPhase !== 'falling' || !this.isPastLip()) return null;
    const lead = Math.min(this.fallVelocity * 0.025, 22);
    return this.waterfallStage
      .getRocks()
      .hitTestSegment(this.x, prevY, this.y, lead);
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
