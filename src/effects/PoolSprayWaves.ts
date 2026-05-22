import Phaser from 'phaser';
import { POOL_SPRAY } from '../config/gameConfig';
import { tryLoadPoolSprayBakedWhenPresent } from '../assets/poolSprayBakedLoader';
import {
  hasPoolSprayBakedAssets,
  PoolSprayBakedPlayback,
} from './PoolSprayBakedPlayback';
import {
  getPoolSprayWaveTuning,
  isMobileGameplayProfile,
  shouldUseBakedPoolSprayFx,
  type PoolSprayWaveTuning,
} from '../config/performanceProfile';
import { PoolSprayBaseGlow } from './PoolSprayBaseGlow';
import { PoolSprayWaveTiles } from './PoolSprayWaveTiles';
import {
  buildPoolSprayEmitterXs,
  resolveFallsPoolSprayLine,
  type FallsPoolSprayLine,
} from '../objects/EnvironmentLayout';
import { PoolSprayAmbientLoop } from './PoolSprayAmbientLoop';
import {
  ensurePoolSprayBubbleTexture,
  POOL_SPRAY_BUBBLE_KEY,
} from './ParticleEffects';

type SprayParticleConfig = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;
type WaveDirection = 'ltr' | 'rtl';

/**
 * Chaotic upward spray at the falls base — ambient + LTR/RTL wave layers.
 * On mobile, ambient churn uses a scrolling tile loop; waves stay live particles.
 */
export class PoolSprayWaves {
  private readonly scene: Phaser.Scene;
  private readonly burstEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private readonly line: FallsPoolSprayLine;
  private readonly waveTuning: PoolSprayWaveTuning;
  private ambientEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private ambientLoop: PoolSprayAmbientLoop | null = null;
  private baseGlow: PoolSprayBaseGlow | null = null;
  private waveTiles: PoolSprayWaveTiles | null = null;
  private bakedPlayback: PoolSprayBakedPlayback | null = null;
  private readonly bakedMobile: boolean;
  private waveTimerLtr: Phaser.Time.TimerEvent | null = null;
  private waveTimerRtl: Phaser.Time.TimerEvent | null = null;
  private microTimer: Phaser.Time.TimerEvent | null = null;
  private burstTimers: Phaser.Time.TimerEvent[] = [];
  private microActive = true;
  private fxPaused = false;
  private sprayMask: Phaser.Display.Masks.GeometryMask | null = null;

  constructor(
    scene: Phaser.Scene,
    options?: { forceLiveParticles?: boolean },
  ) {
    this.scene = scene;
    const forceLive = options?.forceLiveParticles === true;
    this.bakedMobile = !forceLive && shouldUseBakedPoolSprayFx();
    this.waveTuning = getPoolSprayWaveTuning(POOL_SPRAY);
    ensurePoolSprayBubbleTexture(scene);
    this.line = resolveFallsPoolSprayLine(scene);
    this.buildEmitters();
    if (this.bakedMobile && !this.bakedPlayback) {
      void this.tryUpgradeToBaked();
    }
    if (!this.bakedMobile) {
      this.scheduleWave('ltr', Phaser.Math.Between(120, 320));
      this.scheduleWave(
        'rtl',
        Phaser.Math.Between(120, 320) + POOL_SPRAY.reverseWavePhaseMs,
      );
      this.startMicroBursts();
    }
  }

  setSprayMask(mask: Phaser.Display.Masks.GeometryMask): void {
    this.sprayMask = mask;
    this.ambientEmitter?.setMask(mask);
    this.ambientLoop?.setMask(mask);
    this.baseGlow?.setMask(mask);
    this.waveTiles?.setMask(mask);
    this.bakedPlayback?.setMask(mask);
    for (const emitter of this.burstEmitters) {
      emitter.setMask(mask);
    }
  }

  setPaused(paused: boolean): void {
    this.fxPaused = paused;
    if (this.ambientEmitter) {
      this.ambientEmitter.emitting = !paused;
    }
    this.ambientLoop?.setPaused(paused);
    this.baseGlow?.setPaused(paused);
    this.waveTiles?.setPaused(paused);
    this.bakedPlayback?.setPaused(paused);
  }

  update(time: number, delta: number): void {
    this.bakedPlayback?.update(time, delta);
    this.baseGlow?.update(time, delta);
    this.ambientLoop?.update(time, delta);
    this.waveTiles?.update(time, delta);
  }

  destroy(): void {
    this.microActive = false;
    this.waveTimerLtr?.remove(false);
    this.waveTimerLtr = null;
    this.waveTimerRtl?.remove(false);
    this.waveTimerRtl = null;
    this.microTimer?.remove(false);
    this.microTimer = null;
    for (const timer of this.burstTimers) {
      timer.remove(false);
    }
    this.burstTimers = [];
    this.ambientEmitter?.destroy();
    this.ambientEmitter = null;
    this.ambientLoop?.destroy();
    this.ambientLoop = null;
    this.baseGlow?.destroy();
    this.baseGlow = null;
    this.waveTiles?.destroy();
    this.waveTiles = null;
    this.bakedPlayback?.destroy();
    this.bakedPlayback = null;
    for (const emitter of this.burstEmitters) {
      emitter.destroy();
    }
    this.burstEmitters.length = 0;
  }

  /** Particle emitters for dev bake capture (RenderTexture snapshot). */
  getLiveCaptureEmitters(): Phaser.GameObjects.Particles.ParticleEmitter[] {
    const list = [...this.burstEmitters];
    if (this.ambientEmitter) list.push(this.ambientEmitter);
    return list;
  }

  private sprayY(): number {
    return this.line.y + POOL_SPRAY.yOffsetPx;
  }

  private baseConfig(): SprayParticleConfig {
    const cfg = POOL_SPRAY;
    const tuning = this.waveTuning;
    return {
      lifespan: { min: cfg.lifespanMin, max: cfg.lifespanMax },
      speed: { min: cfg.speedMin, max: cfg.speedMax },
      angle: { min: cfg.angleMin, max: cfg.angleMax },
      gravityY: cfg.gravityY,
      scale: { start: cfg.scaleStart, end: cfg.scaleEnd },
      alpha: { start: cfg.alphaStart, end: cfg.alphaEnd },
      ...(tuning.burstMaxParticles !== undefined
        ? { maxParticles: tuning.burstMaxParticles }
        : {}),
      tint: 0xf2f9ff,
      blendMode: Phaser.BlendModes.ADD,
    };
  }

  private async tryUpgradeToBaked(): Promise<void> {
    const ok = await tryLoadPoolSprayBakedWhenPresent(this.scene);
    if (!ok || this.scene.sys.settings.status === Phaser.Scenes.SHUTDOWN) return;
    if (!hasPoolSprayBakedAssets(this.scene)) return;
    if (this.bakedPlayback) return;
    this.upgradeToBakedPlayback();
  }

  private upgradeToBakedPlayback(): void {
    this.baseGlow?.destroy();
    this.baseGlow = null;
    this.ambientLoop?.destroy();
    this.ambientLoop = null;
    this.waveTiles?.destroy();
    this.waveTiles = null;

    const y = this.sprayY();
    this.bakedPlayback = new PoolSprayBakedPlayback(this.scene, this.line, y);
    if (this.sprayMask) {
      this.bakedPlayback.setMask(this.sprayMask);
    }
  }

  private buildEmitters(): void {
    const cfg = POOL_SPRAY;
    const y = this.sprayY();
    const inset = cfg.spanInsetPx;
    const zoneW = Math.max(24, this.line.width - inset * 2);

    if (this.bakedMobile && hasPoolSprayBakedAssets(this.scene)) {
      this.bakedPlayback = new PoolSprayBakedPlayback(this.scene, this.line, y);
      return;
    }

    if (this.bakedMobile) {
      this.baseGlow = new PoolSprayBaseGlow(this.scene, this.line, y);
      this.ambientLoop = new PoolSprayAmbientLoop(this.scene, this.line, y);
      this.waveTiles = new PoolSprayWaveTiles(this.scene, this.line, y);
      return;
    }

    if (isMobileGameplayProfile()) {
      this.ambientLoop = new PoolSprayAmbientLoop(this.scene, this.line, y);
    } else {
      this.ambientEmitter = this.scene.add.particles(
        this.line.centerX,
        y,
        POOL_SPRAY_BUBBLE_KEY,
        {
          ...this.baseConfig(),
          x: { min: -zoneW * 0.5, max: zoneW * 0.5 },
          y: { min: -cfg.emitHalfH, max: cfg.emitHalfH },
          frequency: cfg.ambientFrequency,
          quantity: cfg.ambientQuantity,
          emitting: true,
        },
      );
      this.ambientEmitter.setDepth(cfg.depth);
      this.ambientEmitter.setScrollFactor(0);
    }

    const xs = buildPoolSprayEmitterXs(
      this.line,
      cfg.burstEmitterCount,
      cfg.burstInsetPx,
    );

    for (const x of xs) {
      const emitter = this.scene.add.particles(x, y, POOL_SPRAY_BUBBLE_KEY, {
        ...this.baseConfig(),
        x: { min: -cfg.emitHalfW, max: cfg.emitHalfW },
        y: { min: -cfg.emitHalfH, max: cfg.emitHalfH },
        emitting: false,
      });
      emitter.setDepth(cfg.depth);
      emitter.setScrollFactor(0);
      this.burstEmitters.push(emitter);
    }
  }

  private startMicroBursts(): void {
    const tuning = this.waveTuning;
    const schedule = (): void => {
      if (!this.microActive) return;
      this.microTimer = this.scene.time.delayedCall(
        Phaser.Math.Between(tuning.microBurstMinMs, tuning.microBurstMaxMs),
        () => {
          if (!this.microActive || this.fxPaused) {
            schedule();
            return;
          }
          if (this.burstEmitters.length === 0) {
            schedule();
            return;
          }
          const emitter = Phaser.Utils.Array.GetRandom(this.burstEmitters);
          if (emitter?.active) {
            const count = Phaser.Math.Between(
              tuning.microBurstQuantityMin,
              tuning.microBurstQuantityMax,
            );
            emitter.explode(count);
          }
          schedule();
        },
      );
    };
    schedule();
  }

  private scheduleWave(direction: WaveDirection, delayMs: number): void {
    const tuning = this.waveTuning;
    const timerRef = direction === 'ltr' ? 'waveTimerLtr' : 'waveTimerRtl';
    this[timerRef]?.remove(false);
    this[timerRef] = this.scene.time.delayedCall(delayMs, () => {
      this[timerRef] = null;
      if (!this.fxPaused) {
        this.fireWave(direction);
      }
      const gap = Phaser.Math.Between(
        tuning.waveIntervalMinMs,
        tuning.waveIntervalMaxMs,
      );
      this.scheduleWave(direction, gap);
    });
  }

  private fireWave(direction: WaveDirection): void {
    const cfg = POOL_SPRAY;
    const tuning = this.waveTuning;
    const count = this.burstEmitters.length;
    const order =
      direction === 'ltr'
        ? Array.from({ length: count }, (_, i) => i)
        : Array.from({ length: count }, (_, i) => count - 1 - i);

    order.forEach((emitterIndex, staggerIndex) => {
      const timer = this.scene.time.delayedCall(staggerIndex * cfg.waveStaggerMs, () => {
        if (this.fxPaused) return;
        const emitter = this.burstEmitters[emitterIndex];
        if (!emitter?.active) return;
        const qty = Phaser.Math.Between(tuning.burstQuantityMin, tuning.burstQuantityMax);
        emitter.explode(qty);
      });
      this.burstTimers.push(timer);
    });

    if (direction === 'ltr' && this.ambientEmitter?.active) {
      this.scene.time.delayedCall(cfg.waveStaggerMs * 0.5, () => {
        if (this.fxPaused || !this.ambientEmitter?.active) return;
        this.ambientEmitter.explode(
          Phaser.Math.Between(tuning.burstQuantityMin, tuning.burstQuantityMax),
        );
      });
    }
  }
}
