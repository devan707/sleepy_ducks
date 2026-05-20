import Phaser from 'phaser';
import { getDuckAtlasVisualScale } from '../config/duckAssets';
import {
  isFemaleWakeTexture,
  isGoldenFlyTexture,
  isGoldenWakeTexture,
  isMaleWakeTexture,
  resolveDuckSpriteSet,
  wakeStartFrameName,
  type DuckSpriteSet,
} from '../config/duckSprites';
import {
  BASE_POINTS,
  DUCK,
  DUCK_KIND_VISUAL,
  DUCK_SPRITE,
  GAME_WIDTH,
  GOLDEN_POINTS_MULTIPLIER,
  STAGE,
  type DuckKind,
  type DuckSex,
} from '../config/gameConfig';
import { GameEvents } from '../core/GameEvents';
import type { MotionDifficulty } from '../systems/DifficultyManager';
import { getCrestApproachPosition } from './EnvironmentLayout';
import type { StageLayout, WaterfallStage } from './WaterfallStage';

function isWakeTextureKey(textureKey: string): boolean {
  return (
    isMaleWakeTexture(textureKey) ||
    isFemaleWakeTexture(textureKey) ||
    isGoldenWakeTexture(textureKey)
  );
}

export type { DuckKind, DuckSex };
export type DuckLifecycle = 'sleeping' | 'waking' | 'escaping' | 'gone';
export type DuckMotionPhase = 'cresting' | 'falling';
export type GoldenMotionPhase = 'braking' | 'wake-play' | 'ascend';
export type DuckTapResult = 'none' | 'partial' | 'woke' | 'early';

export interface DuckSavedPayload {
  duck: Duck;
  kind: DuckKind;
  points: number;
}

export interface DuckMissedPayload {
  duck: Duck;
  kind: DuckKind;
  x: number;
  y: number;
}

export interface DuckEarlyTapPayload {
  duck: Duck;
  x: number;
  y: number;
  /** False for heavy-sleeper conversion taps (those use partial-tap instead). */
  breaksCombo: boolean;
}

export class Duck extends Phaser.GameObjects.Container {
  readonly kind: DuckKind;
  readonly sex: DuckSex;

  private sprite: Phaser.GameObjects.Sprite;
  private sprites: DuckSpriteSet;
  private waterfallStage: WaterfallStage;
  private lifecycle: DuckLifecycle = 'sleeping';
  private motionPhase: DuckMotionPhase = 'cresting';

  private layout!: StageLayout;
  private crestProgress = 0;
  private crestDurationMs = 2400;
  private fallVelocity = 0;
  private gravity = 200;
  private maxFallVelocity = 680;

  private tapsReceived = 0;
  private lastHeavyTapAtMs = 0;
  private tapsRequired: number;
  private readonly pointsMultiplier: number;
  private readonly crestDurationScale: number;

  private escapeVelocityX = 0;
  private escapeVelocityY = 0;
  private goldenPhase: GoldenMotionPhase | null = null;
  private goldenWavePhase = 0;
  private goldenAscendDir = 1;
  private animSizingHandler: (() => void) | null = null;
  private readonly spawnedAtMs: number;
  /** Fixed spawn X — crest path drifts right along the lip from here. */
  private readonly crestStartX: number;
  private crestMaskApplied = false;
  /** Texture key when lip mask was applied (re-mask on crest art swap). */
  private crestMaskTextureKey: string | null = null;
  /** Heavy duck switched to normal asleep art after first tap. */
  private mallardCrestActive = false;
  private lastAppliedDepth = -1;
  private earlyTapPausedUntilMs = 0;
  private isEarlyTapWakePose = false;
  private earlyTapResumeTimer: Phaser.Time.TimerEvent | null = null;

  constructor(
    scene: Phaser.Scene,
    sex: DuckSex,
    kind: DuckKind,
    layout: StageLayout,
    waterfallStage: WaterfallStage,
    spawnX: number,
  ) {
    const crestStartX = spawnX;
    const isGoldenSkyfall = kind === 'golden';

    if (isGoldenSkyfall) {
      super(scene, spawnX, DUCK.goldenSpawnY);
    } else {
      const start = getCrestApproachPosition(
        crestStartX,
        0,
        DUCK.spawnBelowLip,
        DUCK.crestEndBelowLip,
        DUCK.crestDriftAlongLip,
        layout.laneMinX,
        layout.laneMaxX,
      );
      super(scene, start.x, start.y);
    }

    this.crestStartX = crestStartX;
    this.sex = sex;
    this.kind = kind;
    this.layout = layout;
    this.waterfallStage = waterfallStage;
    this.spawnedAtMs = scene.time.now;
    this.sprites = resolveDuckSpriteSet(scene, sex, kind);
    this.tapsRequired =
      kind === 'heavy' ? DUCK.heavyTapRequired : 1;
    this.pointsMultiplier =
      kind === 'golden'
        ? GOLDEN_POINTS_MULTIPLIER
        : kind === 'heavy'
          ? 1.5
          : 1;
    this.crestDurationScale =
      kind === 'heavy' ? DUCK.heavyCrestMultiplier : 1;

    this.sprite = scene.add.sprite(0, 0, this.sprites.crestTexture);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setFlipX(false);
    this.fitSpriteToDisplay();
    this.applyKindVisual();
    this.add(this.sprite);

    if (isGoldenSkyfall) {
      this.motionPhase = 'falling';
      this.crestProgress = 1;
      this.fallVelocity = DUCK.goldenFallInitialVelocity;
      this.gravity = DUCK.goldenFallGravity;
      this.maxFallVelocity = DUCK.goldenFallTerminalVelocity;
      this.showFullBody();
      this.setScale(this.getVisualScale());
      this.lastAppliedDepth = STAGE.duckDepthFront;
      this.setDepth(STAGE.duckDepthFront);
    } else {
      this.playCrestVisual();
      this.applyCrestVisuals();
    }

    scene.add.existing(this);
  }

  destroy(fromScene?: boolean): void {
    this.earlyTapResumeTimer?.remove(false);
    this.earlyTapResumeTimer = null;
    this.unbindAnimSizing();
    super.destroy(fromScene);
  }

  isSleeping(): boolean {
    return this.lifecycle === 'sleeping';
  }

  /** Whether a cresting too-early tap should break the player's combo. */
  doesEarlyTapBreakCombo(): boolean {
    if (this.kind === 'normal') return true;
    if (this.kind === 'heavy' && this.mallardCrestActive) return true;
    return false;
  }

  /** True once the duck has gone over the lip and can be rescued (normal / heavy). */
  isSaveable(): boolean {
    if (this.isEarlyTapLocked()) return false;
    if (
      !this.isSleeping() ||
      this.motionPhase !== 'falling' ||
      this.kind === 'golden' ||
      this.kind === 'decoy'
    ) {
      return false;
    }
    return this.y >= this.lipYAtDuck() + DUCK.saveableBelowLipMin;
  }

  /** Too-early penalty in progress — no taps or crest/fall advances for this duck. */
  isEarlyTapLocked(): boolean {
    return (
      this.isEarlyTapWakePose ||
      this.scene.time.now < this.earlyTapPausedUntilMs
    );
  }

  canReceiveTap(): boolean {
    if (this.kind === 'decoy') return false;
    if (!this.isSleeping()) return false;
    if (this.scene.time.now - this.spawnedAtMs < DUCK.saveGraceMs) return false;
    if (this.isEarlyTapLocked()) return false;

    if (
      this.kind === 'heavy' &&
      this.tapsReceived > 0 &&
      this.scene.time.now - this.lastHeavyTapAtMs < DUCK.heavyTapMinIntervalMs
    ) {
      return false;
    }

    return true;
  }

  /**
   * Scene-level tap test (padded). Uses sprite display size + container position
   * (bottom origin) — getBounds() sat too low vs visible crest art (see debug H1).
   */
  containsWorldPoint(worldX: number, worldY: number): boolean {
    const fallBoost = this.motionPhase === 'falling' ? DUCK.fallHitAreaBoost : 1;
    const sx = Math.abs(this.scaleX) || 1;
    const sy = Math.abs(this.scaleY) || 1;
    const w = this.sprite.displayWidth * sx;
    const h = this.sprite.displayHeight * sy;

    let padX = ((w * (DUCK.hitAreaWidthPad - 1)) / 2) * fallBoost;
    let padY =
      Math.max((h * (DUCK.hitAreaHeightPad - 1)) / 2, (DUCK.hitAreaMinHeight * sy - h) / 2) *
      fallBoost;
    const headPad =
      (this.motionPhase === 'cresting'
        ? Math.max(h * 0.5, 65 * sy)
        : this.kind === 'golden'
          ? h * 0.35
          : h * 0.15) * fallBoost;
    const leadMs =
      this.kind === 'golden' ? DUCK.fallHitLeadMs * 1.6 : DUCK.fallHitLeadMs;
    const leadY =
      this.motionPhase === 'falling' ? (this.fallVelocity * leadMs) / 1000 : 0;

    const left = this.x - w / 2 - padX;
    const right = this.x + w / 2 + padX;
    const top = this.y - h - padY - headPad;
    const bottom = this.y + padY + leadY;

    return worldX >= left && worldX <= right && worldY >= top && worldY <= bottom;
  }

  tap(): DuckTapResult {
    return this.handleTap();
  }

  getMotionPhase(): DuckMotionPhase {
    return this.motionPhase;
  }

  setMotionDifficulty(params: MotionDifficulty): void {
    if (this.kind === 'golden') {
      this.gravity = DUCK.goldenFallGravity;
      this.maxFallVelocity = DUCK.goldenFallTerminalVelocity;
      return;
    }

    this.crestDurationMs =
      (params.crestDurationMs * this.crestDurationScale) / DUCK.crestApproachSpeed;
    this.gravity = params.gravity;
    this.maxFallVelocity = params.maxFallVelocity;
    if (this.kind === 'heavy') this.gravity *= 0.92;
  }

  updateDuck(_time: number, delta: number): void {
    if (this.lifecycle === 'sleeping') {
      if (this.kind === 'golden') {
        this.updateGoldenSkyFall(delta);
        this.checkFallenIntoMist();
      } else {
        this.updateSleepingMotion(delta);
      }
      return;
    }
    if (this.lifecycle === 'waking' && this.kind === 'golden') {
      if (this.goldenPhase === 'braking') {
        this.updateGoldenBraking(delta);
      }
      return;
    }
    if (this.lifecycle === 'escaping') {
      if (this.kind === 'golden') {
        this.updateGoldenAscend(delta);
      } else {
        this.updateEscapeMotion(delta);
      }
    }
  }

  private lipYAtDuck(): number {
    return this.layout.getLipY(this.x);
  }

  private hasReachedCrest(): boolean {
    return this.crestProgress >= 0.999;
  }

  private applyCrestPosition(): void {
    const t = this.easeCrest(this.crestProgress);
    const pos = getCrestApproachPosition(
      this.crestStartX,
      t,
      DUCK.spawnBelowLip,
      DUCK.crestEndBelowLip,
      DUCK.crestDriftAlongLip,
      this.layout.laneMinX,
      this.layout.laneMaxX,
    );
    this.x = pos.x;
    this.y = pos.y;
  }

  private beginFreefall(): void {
    if (this.motionPhase === 'falling') return;
    if (this.isEarlyTapLocked()) return;
    this.motionPhase = 'falling';
    const lipY = this.lipYAtDuck();
    this.y = lipY + this.layout.lipFallThreshold + 1;
    this.fallVelocity = 0;
    this.isEarlyTapWakePose = false;
    this.showFullBody();
    if (isWakeTextureKey(this.sprite.texture.key)) {
      this.playCrestVisual();
    }
    this.setScale(this.getVisualScale());
    this.applyDepth();
  }

  private updateSleepingMotion(delta: number): void {
    if (this.motionPhase === 'cresting') {
      const locked = this.isEarlyTapLocked();
      if (!locked) {
        const dt = delta / this.crestDurationMs;
        this.crestProgress = Math.min(1, this.crestProgress + dt * 0.72);
      }

      this.applyCrestPosition();
      this.applyCrestVisuals();

      if (!locked && this.hasReachedCrest()) {
        this.beginFreefall();
      }
      return;
    }

    if (this.motionPhase === 'falling') {
      if (this.isEarlyTapLocked()) return;
      this.fallVelocity = Math.min(
        this.maxFallVelocity,
        this.fallVelocity + (this.gravity * delta) / 1000,
      );
      this.y += (this.fallVelocity * delta) / 1000;

      this.setScale(this.getVisualScale());
      this.applyDepth();

      this.checkFallenIntoMist();
    }
  }

  /** Past the mist line: decoys/golden vanish silently; mallards count as missed. */
  private checkFallenIntoMist(): void {
    if (this.y <= this.layout.mistZoneTop) return;
    if (this.kind === 'decoy' || this.kind === 'golden') {
      if (this.lifecycle !== 'sleeping') return;
      this.lifecycle = 'gone';
      this.disableInteractive();
      this.destroy();
      return;
    }
    this.triggerMissed();
  }

  /** Golden ducks: straight-down dive from above the screen. */
  private updateGoldenSkyFall(delta: number): void {
    const dt = delta / 1000;
    this.fallVelocity = Math.min(
      this.maxFallVelocity,
      this.fallVelocity + this.gravity * dt,
    );
    this.y += this.fallVelocity * dt;
    this.setScale(this.getVisualScale());
    this.setDepth(STAGE.duckDepthFront);
  }

  private updateGoldenBraking(delta: number): void {
    const dt = delta / 1000;
    this.fallVelocity = Math.max(
      0,
      this.fallVelocity - DUCK.goldenBrakeDecel * dt,
    );
    this.y += this.fallVelocity * dt;
    this.setScale(this.getGoldenHoverScale());
    this.setDepth(STAGE.duckDepthFront);

    if (this.fallVelocity <= DUCK.goldenHoverMaxFall) {
      this.fallVelocity = 0;
      this.startGoldenWakeAnim();
    }
  }

  private startGoldenWakeAnim(): void {
    if (this.goldenPhase !== 'braking') return;
    this.goldenPhase = 'wake-play';
    this.fallVelocity = 0;
    this.scene.events.emit(GameEvents.DUCK_WAKING);

    const scale = this.getGoldenHoverScale();
    this.sprite.setFlipX(false);
    this.playAnim(this.sprites.wakeAnimKey, this.sprites.wakeTexture);
    this.setScale(scale);

    const wakeAnimKey = this.sprites.wakeAnimKey;
    const finishWake = () => {
      if (this.lifecycle !== 'waking' || this.goldenPhase !== 'wake-play') return;
      this.beginGoldenAscent();
    };

    this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE);
    if (wakeAnimKey && this.scene.anims.exists(wakeAnimKey)) {
      const anim = this.scene.anims.get(wakeAnimKey);
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, finishWake);
      this.scene.time.delayedCall(anim.duration + 60, finishWake);
    } else {
      this.scene.time.delayedCall(400, finishWake);
    }
  }

  private beginGoldenRescue(): void {
    this.lifecycle = 'waking';
    this.goldenPhase = 'braking';
    this.disableInteractive();
    this.clearLipMask();
    this.showFullBody();
    this.setScale(this.getVisualScale());
    this.setDepth(STAGE.duckDepthFront);
  }

  private beginGoldenAscent(): void {
    if (this.lifecycle !== 'waking') return;

    const scale = this.getGoldenHoverScale();
    this.lifecycle = 'escaping';
    this.goldenPhase = 'ascend';
    this.fallVelocity = 0;

    const points = Math.round(BASE_POINTS * this.pointsMultiplier);
    const payload: DuckSavedPayload = {
      duck: this,
      kind: this.kind,
      points,
    };
    this.scene.events.emit(GameEvents.DUCK_SAVED, payload);

    const goLeft = this.x < GAME_WIDTH / 2;
    this.goldenAscendDir = goLeft ? -1 : 1;
    this.goldenWavePhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.sprite.setFlipX(goLeft);
    this.playFlyLoop();
    this.setScale(scale);
    this.angle = goLeft ? -10 : 10;
  }

  private updateGoldenAscend(delta: number): void {
    const dt = delta / 1000;
    this.goldenWavePhase += dt * DUCK.goldenWaveFrequency;
    const wobbleX =
      Math.sin(this.goldenWavePhase) * DUCK.goldenWaveAmplitudeX;
    const wobbleY =
      Math.sin(this.goldenWavePhase * 0.7 + 0.5) * DUCK.goldenWaveAmplitudeY;

    this.x += (this.goldenAscendDir * DUCK.goldenAscendSpeedX + wobbleX) * dt;
    this.y += (-DUCK.goldenAscendSpeedY + wobbleY) * dt;
    this.setScale(this.getGoldenHoverScale());
    this.setDepth(STAGE.duckDepthFront);

    if (this.y < -140 || this.x < -100 || this.x > GAME_WIDTH + 100) {
      this.lifecycle = 'gone';
      this.destroy();
    }
  }

  private getGoldenHoverScale(): number {
    const kindMult = DUCK_KIND_VISUAL.golden.scaleMult;
    return DUCK.maxScale * 1.1 * kindMult;
  }

  private updateEscapeMotion(delta: number): void {
    const dt = delta / 1000;
    this.escapeVelocityY -= 420 * dt;
    this.escapeVelocityX *= 1 + dt * 0.4;
    this.x += this.escapeVelocityX * dt;
    this.y += this.escapeVelocityY * dt;
    this.angle += (this.escapeVelocityX > 0 ? 1 : -1) * 45 * dt;
    this.clearLipMask();
    this.applyDepth();

    if (this.y < -100 || this.x < -80 || this.x > GAME_WIDTH + 80) {
      this.lifecycle = 'gone';
      this.destroy();
    }
  }

  private applyDepth(): void {
    const depth =
      this.lifecycle === 'escaping'
        ? STAGE.duckDepthFront
        : this.waterfallStage.getDuckDepth(this.crestProgress, this.motionPhase);
    if (depth === this.lastAppliedDepth) return;
    this.lastAppliedDepth = depth;
    this.setDepth(depth);
  }

  private handleTap(): DuckTapResult {
    if (!this.canReceiveTap()) return 'none';

    if (this.kind === 'heavy' && !this.mallardCrestActive) {
      this.convertHeavyToMallardSleeper();
      this.playCrestVisual();
      this.applyCrestVisuals();
      this.setScale(this.getVisualScale());
      this.pulseTap();
      this.scene.events.emit('duck-partial-tap', this);
      return 'partial';
    }

    if (this.kind !== 'golden' && !this.isSaveable()) {
      this.handleEarlyTap();
      return 'early';
    }

    this.tapsReceived += 1;

    if (this.tapsReceived < this.tapsRequired) {
      this.pulseTap();
      this.scene.events.emit('duck-partial-tap', this);
      return 'partial';
    }

    this.scene.events.emit(GameEvents.DUCK_TAPPED, { duck: this });
    if (this.kind === 'golden') {
      this.beginGoldenRescue();
    } else {
      this.beginWaking();
    }
    return 'woke';
  }

  /** Heavy → normal sleeper look (no hat/mask); one falling tap saves after this. */
  private convertHeavyToMallardSleeper(): void {
    if (this.kind !== 'heavy' || this.mallardCrestActive) return;

    this.mallardCrestActive = true;
    this.tapsRequired = 1;
    this.sprites = resolveDuckSpriteSet(this.scene, this.sex, 'normal');
    this.crestMaskApplied = false;
    this.crestMaskTextureKey = null;
  }

  private pulseTap(): void {
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: this.sprite.scaleX * 1.08,
      scaleY: this.sprite.scaleY * 1.08,
      duration: 70,
      yoyo: true,
    });
  }

  private handleEarlyTap(): void {
    this.isEarlyTapWakePose = true;
    this.earlyTapPausedUntilMs = this.scene.time.now + DUCK.earlyTapPauseMs;
    this.showEarlyTapWakePose();
    this.flashEarlyTapYellow();

    this.earlyTapResumeTimer?.remove(false);
    this.earlyTapResumeTimer = this.scene.time.delayedCall(
      DUCK.earlyTapPauseMs,
      () => {
        this.earlyTapResumeTimer = null;
        this.resumeCrestAfterEarlyTap();
      },
    );

    const payload: DuckEarlyTapPayload = {
      duck: this,
      x: this.x,
      y: this.y,
      breaksCombo: this.doesEarlyTapBreakCombo(),
    };
    this.scene.events.emit(GameEvents.EARLY_TAP, payload);
  }

  /** Hold first wake frame (eyes open) for the early-tap pause. */
  private showEarlyTapWakePose(): void {
    const { wakeTexture } = this.sprites;
    if (!wakeTexture || !this.scene.textures.exists(wakeTexture)) return;

    this.isEarlyTapWakePose = true;
    this.unbindAnimSizing();
    this.clearLipMask();
    this.showFullBody();
    this.sprite.setFlipX(false);
    this.sprite.anims.stop();

    const frame = wakeStartFrameName(wakeTexture);
    this.sprite.setTexture(wakeTexture, frame);
    this.applyKindVisual();
    this.fitSpriteToDisplay();
    this.setScale(this.getVisualScale());
    this.applyDepth();
  }

  private resumeCrestAfterEarlyTap(): void {
    if (!this.isSleeping()) {
      this.isEarlyTapWakePose = false;
      return;
    }

    this.isEarlyTapWakePose = false;
    this.restoreSleepingVisualAfterEarlyTap();
  }

  /** Swap wake penalty frame back to asleep crest art (cresting or falling). */
  private restoreSleepingVisualAfterEarlyTap(): void {
    this.unbindAnimSizing();
    this.sprite.anims.stop();
    this.sprite.setFlipX(false);

    if (this.motionPhase === 'falling') {
      this.showFullBody();
      this.playCrestVisual();
    } else {
      this.playCrestVisual();
      this.applyCrestVisuals();
    }

    this.setScale(this.getVisualScale());
    this.applyDepth();
  }

  private flashEarlyTapYellow(): void {
    this.sprite.setTint(0xffe566);
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: { from: 1, to: 0.85 },
      duration: 60,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        this.sprite.clearTint();
        this.sprite.setAlpha(1);
        this.applyKindVisual();
      },
    });
  }

  private beginWaking(): void {
    const scale = this.getVisualScale();
    this.lifecycle = 'waking';
    this.disableInteractive();
    this.fallVelocity = 0;
    this.clearLipMask();
    this.showFullBody();
    this.applyDepth();

    this.scene.events.emit(GameEvents.DUCK_WAKING);

    this.sprite.setFlipX(false);
    this.playAnim(this.sprites.wakeAnimKey, this.sprites.wakeTexture);
    this.setScale(scale);

    const wakeAnimKey = this.sprites.wakeAnimKey;
    const finishWake = () => {
      if (this.lifecycle !== 'waking') return;
      this.beginEscaping();
    };

    this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE);
    if (wakeAnimKey && this.scene.anims.exists(wakeAnimKey)) {
      const anim = this.scene.anims.get(wakeAnimKey);
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, finishWake);
      this.scene.time.delayedCall(anim.duration + 80, finishWake);
    } else {
      this.scene.time.delayedCall(320, finishWake);
    }
  }

  private beginEscaping(): void {
    if (this.lifecycle !== 'waking') return;

    const scale = this.getVisualScale();
    this.lifecycle = 'escaping';
    this.applyDepth();

    const points = Math.round(BASE_POINTS * this.pointsMultiplier);
    const payload: DuckSavedPayload = {
      duck: this,
      kind: this.kind,
      points,
    };
    this.scene.events.emit(GameEvents.DUCK_SAVED, payload);

    const goLeft = this.x < GAME_WIDTH / 2;
    this.sprite.setFlipX(goLeft);
    this.playFlyLoop();
    this.setScale(scale);

    this.escapeVelocityX = (goLeft ? -1 : 1) * Phaser.Math.Between(140, 200);
    this.escapeVelocityY = Phaser.Math.Between(-80, -40);
    this.angle = goLeft ? 12 : -12;
  }

  private triggerMissed(): void {
    if (this.lifecycle !== 'sleeping') return;
    this.lifecycle = 'gone';
    this.disableInteractive();

    if (this.kind === 'decoy' || this.kind === 'golden') {
      this.destroy();
      return;
    }

    const payload: DuckMissedPayload = {
      duck: this,
      kind: this.kind,
      x: this.x,
      y: this.y,
    };

    this.flashDamageRed(() => {
      this.scene.events.emit(GameEvents.DUCK_MISSED, payload);
      this.destroy();
    });
  }

  /** Red damage flash before splash / life loss. */
  private flashDamageRed(onComplete: () => void): void {
    this.sprite.setTint(0xff4444);
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: { from: 1, to: 0.35 },
      duration: 65,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        this.sprite.setAlpha(1);
        onComplete();
      },
    });
  }

  /** Crest/fall scale; re-applied after clearMask so save doesn't shrink the duck. */
  private getKindScaleMult(): number {
    if (this.kind === 'heavy' && this.mallardCrestActive) {
      return DUCK_KIND_VISUAL.normal.scaleMult;
    }
    return DUCK_KIND_VISUAL[this.kind].scaleMult;
  }

  private getVisualScale(): number {
    const kindMult = this.getKindScaleMult();
    if (this.kind === 'golden' && this.motionPhase === 'falling') {
      const diveRange = this.layout.mistZoneTop - DUCK.goldenSpawnY;
      const t = Phaser.Math.Clamp((this.y - DUCK.goldenSpawnY) / diveRange, 0, 1);
      return (
        Phaser.Math.Linear(DUCK.maxScale * 0.9, DUCK.maxScale * 1.14, t) *
        kindMult *
        DUCK.goldenFallScaleMult
      );
    }
    if (this.motionPhase === 'falling') {
      const lipY = this.lipYAtDuck();
      const fallT = Math.min(1, Math.max(0, (this.y - lipY) / 360));
      return Phaser.Math.Linear(DUCK.maxScale, DUCK.maxScale * 1.12, fallT) * kindMult;
    }
    return Phaser.Math.Linear(DUCK.minScale, DUCK.maxScale, this.crestProgress) * kindMult;
  }

  /** Mask/crop for crest; re-applied when frame size changes (e.g. heavy → mallard). */
  private ensureCrestMask(): void {
    if (this.mallardCrestActive) return;

    const textureKey = this.sprite.texture.key;
    const frame = this.sprite.frame;
    const cropW = frame.width;
    const cropH = frame.height;

    if (
      this.crestMaskApplied &&
      this.crestMaskTextureKey === textureKey
    ) {
      const cur = this.sprite.frame;
      if (cur.width === cropW && cur.height === cropH) return;
      this.clearLipMask();
      this.crestMaskApplied = false;
    }

    this.sprite.setCrop(0, 0, cropW, cropH);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.y = 0;
    this.setMask(this.waterfallStage.getLipEmergenceMask());
    this.crestMaskApplied = true;
    this.crestMaskTextureKey = textureKey;
  }

  private applyCrestVisuals(): void {
    if (!this.mallardCrestActive && !this.isEarlyTapWakePose) {
      this.ensureCrestMask();
    }
    this.setScale(this.getVisualScale());
    this.applyDepth();
  }

  private showFullBody(): void {
    this.crestMaskApplied = false;
    this.crestMaskTextureKey = null;
    this.clearLipMask();
    const frame = this.sprite.frame;
    this.sprite.setCrop(0, 0, frame.width, frame.height);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.y = 0;
    this.applyDepth();
  }

  private clearLipMask(): void {
    this.clearMask();
    this.crestMaskTextureKey = null;
  }

  private easeCrest(t: number): number {
    return 1 - Math.pow(1 - t, 3.2);
  }

  /** Fit current frame; sleep atlas is the visual size reference (see DUCK_ATLAS_VISUAL_SCALE). */
  private fitSpriteToDisplay(): void {
    const frame = this.sprite.frame;
    const atlasScale = getDuckAtlasVisualScale(this.sprite.texture.key);
    const targetH = DUCK_SPRITE.displayHeight * atlasScale;
    const fit = targetH / frame.height;
    this.sprite.setDisplaySize(frame.width * fit, targetH);
  }

  private playCrestVisual(): void {
    this.playAnim(this.sprites.crestAnimKey, this.sprites.crestTexture);
  }

  private playAnim(animKey: string | null, textureKey: string): void {
    if (this.sprite.texture.key !== textureKey) {
      if (
        isMaleWakeTexture(textureKey) ||
        isFemaleWakeTexture(textureKey) ||
        isGoldenWakeTexture(textureKey)
      ) {
        this.sprite.setTexture(textureKey, wakeStartFrameName(textureKey));
      } else if (isGoldenFlyTexture(textureKey)) {
        this.sprite.setTexture(textureKey, 'frame_000');
      } else {
        this.sprite.setTexture(textureKey);
      }
      this.applyKindVisual();
      if (textureKey === this.sprites.crestTexture) {
        this.sprite.setFlipX(false);
      }
    }

    this.sprite.anims.stop();
    if (animKey && this.scene.anims.exists(animKey)) {
      const loop = animKey === this.sprites.flyAnimKey;
      this.sprite.anims.play({
        key: animKey,
        repeat: loop ? -1 : 0,
      });
    }

    this.fitSpriteToDisplay();
    this.bindAnimSizing(animKey);
  }

  /** Start fly atlas loop (explicit repeat; golden fly was sticking on frame 0). */
  private playFlyLoop(): void {
    const { flyAnimKey, flyTexture } = this.sprites;
    this.unbindAnimSizing();

    if (this.sprite.texture.key !== flyTexture) {
      if (isGoldenFlyTexture(flyTexture)) {
        this.sprite.setTexture(flyTexture, 'frame_000');
      } else {
        this.sprite.setTexture(flyTexture);
      }
      this.applyKindVisual();
    }

    this.sprite.anims.stop();
    this.fitSpriteToDisplay();

    if (flyAnimKey && this.scene.anims.exists(flyAnimKey)) {
      this.sprite.anims.play({
        key: flyAnimKey,
        repeat: -1,
      });
    }

    if (this.kind !== 'golden') {
      this.bindAnimSizing(flyAnimKey);
    }
  }

  private bindAnimSizing(animKey: string | null): void {
    this.unbindAnimSizing();
    if (!animKey || animKey === this.sprites.crestAnimKey) return;
    if (this.kind === 'golden') return;

    this.animSizingHandler = () => {
      this.fitSpriteToDisplay();
    };
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.animSizingHandler);
  }

  private unbindAnimSizing(): void {
    if (!this.animSizingHandler) return;
    this.sprite.off(Phaser.Animations.Events.ANIMATION_UPDATE, this.animSizingHandler);
    this.animSizingHandler = null;
  }

  /** Lerp multiply-tint toward white so strength 0.05 ≈ barely visible wash. */
  private blendTintColor(color: number, strength: number): number {
    const t = Phaser.Math.Clamp(strength, 0, 1);
    if (t >= 1) return color;
    if (t <= 0) return 0xffffff;

    const r = Math.round(((color >> 16) & 0xff) * t + 255 * (1 - t));
    const g = Math.round(((color >> 8) & 0xff) * t + 255 * (1 - t));
    const b = Math.round((color & 0xff) * t + 255 * (1 - t));
    return (r << 16) | (g << 8) | b;
  }

  private applyKindVisual(): void {
    const v =
      this.kind === 'heavy' && this.mallardCrestActive
        ? DUCK_KIND_VISUAL.normal
        : DUCK_KIND_VISUAL[this.kind];
    this.sprite.clearTint();
    if (this.sprite.preFX) {
      this.sprite.preFX.clear();
    }

    if (v.tint !== null) {
      const tint = this.blendTintColor(v.tint, v.tintStrength);
      if (v.tintFill) {
        this.sprite.setTintFill(tint);
      } else {
        this.sprite.setTint(tint);
      }
    }

    if (v.glowStrength > 0 && this.sprite.preFX) {
      this.sprite.preFX.addGlow(v.glowColor, v.glowStrength, 0, false, 0.08, 12);
    }
  }
}
