import Phaser from 'phaser';
import { POOL_SPRAY } from '../config/gameConfig';
import { isMobileGameplayProfile } from '../config/performanceProfile';
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
  private ambientEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private ambientLoop: PoolSprayAmbientLoop | null = null;
  private waveTimerLtr: Phaser.Time.TimerEvent | null = null;
  private waveTimerRtl: Phaser.Time.TimerEvent | null = null;
  private microTimer: Phaser.Time.TimerEvent | null = null;
  private burstTimers: Phaser.Time.TimerEvent[] = [];
  private microActive = true;
  private fxPaused = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    ensurePoolSprayBubbleTexture(scene);
    this.line = resolveFallsPoolSprayLine(scene);
    this.buildEmitters();
    this.scheduleWave('ltr', Phaser.Math.Between(120, 320));
    this.scheduleWave(
      'rtl',
      Phaser.Math.Between(120, 320) + POOL_SPRAY.reverseWavePhaseMs,
    );
    this.startMicroBursts();
  }

  setSprayMask(mask: Phaser.Display.Masks.GeometryMask): void {
    this.ambientEmitter?.setMask(mask);
    this.ambientLoop?.setMask(mask);
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
  }

  update(time: number, delta: number): void {
    this.ambientLoop?.update(time, delta);
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
    for (const emitter of this.burstEmitters) {
      emitter.destroy();
    }
    this.burstEmitters.length = 0;
  }

  private sprayY(): number {
    return this.line.y + POOL_SPRAY.yOffsetPx;
  }

  private baseConfig(): SprayParticleConfig {
    const cfg = POOL_SPRAY;
    return {
      lifespan: { min: cfg.lifespanMin, max: cfg.lifespanMax },
      speed: { min: cfg.speedMin, max: cfg.speedMax },
      angle: { min: cfg.angleMin, max: cfg.angleMax },
      gravityY: cfg.gravityY,
      scale: { start: cfg.scaleStart, end: cfg.scaleEnd },
      alpha: { start: cfg.alphaStart, end: cfg.alphaEnd },
      tint: 0xf2f9ff,
      blendMode: Phaser.BlendModes.ADD,
    };
  }

  private buildEmitters(): void {
    const cfg = POOL_SPRAY;
    const y = this.sprayY();
    const inset = cfg.spanInsetPx;
    const zoneW = Math.max(24, this.line.width - inset * 2);

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
    const cfg = POOL_SPRAY;
    const schedule = (): void => {
      if (!this.microActive) return;
      this.microTimer = this.scene.time.delayedCall(
        Phaser.Math.Between(cfg.microBurstMinMs, cfg.microBurstMaxMs),
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
              cfg.microBurstQuantityMin,
              cfg.microBurstQuantityMax,
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
    const timerRef = direction === 'ltr' ? 'waveTimerLtr' : 'waveTimerRtl';
    this[timerRef]?.remove(false);
    this[timerRef] = this.scene.time.delayedCall(delayMs, () => {
      this[timerRef] = null;
      if (!this.fxPaused) {
        this.fireWave(direction);
      }
      const gap = Phaser.Math.Between(
        POOL_SPRAY.waveIntervalMinMs,
        POOL_SPRAY.waveIntervalMaxMs,
      );
      this.scheduleWave(direction, gap);
    });
  }

  private fireWave(direction: WaveDirection): void {
    const cfg = POOL_SPRAY;
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
        const qty = Phaser.Math.Between(cfg.burstQuantityMin, cfg.burstQuantityMax);
        emitter.explode(qty);
      });
      this.burstTimers.push(timer);
    });

    if (direction === 'ltr' && this.ambientEmitter?.active) {
      this.scene.time.delayedCall(cfg.waveStaggerMs * 0.5, () => {
        if (this.fxPaused || !this.ambientEmitter?.active) return;
        this.ambientEmitter.explode(
          Phaser.Math.Between(cfg.burstQuantityMin, cfg.burstQuantityMax),
        );
      });
    }
  }
}
