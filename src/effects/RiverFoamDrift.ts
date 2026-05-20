import Phaser from 'phaser';
import { RIVER_FOAM } from '../config/gameConfig';
import {
  buildPoolSprayEmitterXs,
  resolveRiverFoamSpawnLine,
  type FallsPoolSprayLine,
} from '../objects/EnvironmentLayout';
import { ensureRiverFoamTexture, RIVER_FOAM_KEY } from './ParticleEffects';

/** Meandering foam patches drifting downstream from the falls foot. */
export class RiverFoamDrift {
  private readonly scene: Phaser.Scene;
  private readonly emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private readonly line: FallsPoolSprayLine;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    ensureRiverFoamTexture(scene);
    this.line = resolveRiverFoamSpawnLine(scene);
    this.buildEmitters();
  }

  setMask(mask: Phaser.Display.Masks.GeometryMask): void {
    for (const emitter of this.emitters) {
      emitter.setMask(mask);
    }
  }

  destroy(): void {
    for (const emitter of this.emitters) {
      emitter.destroy();
    }
    this.emitters.length = 0;
  }

  private buildEmitters(): void {
    const cfg = RIVER_FOAM;
    const xs = buildPoolSprayEmitterXs(this.line, cfg.emitterCount, cfg.spanInsetPx);

    for (let i = 0; i < xs.length; i++) {
      const meander = i % 2 === 0 ? -1 : 1;
      const angleMin = cfg.angleMin + meander * cfg.meanderAngleSpread;
      const angleMax = cfg.angleMax + meander * cfg.meanderAngleSpread;

      const emitter = this.scene.add.particles(xs[i], this.line.y, RIVER_FOAM_KEY, {
        x: { min: -cfg.emitHalfW, max: cfg.emitHalfW },
        y: { min: -cfg.emitHalfH, max: cfg.emitHalfH },
        lifespan: { min: cfg.lifespanMin, max: cfg.lifespanMax },
        speed: { min: cfg.speedMin, max: cfg.speedMax },
        angle: { min: angleMin, max: angleMax },
        gravityY: cfg.gravityY,
        accelerationX: { min: -cfg.meanderAccel, max: cfg.meanderAccel },
        rotate: { min: cfg.rotateMin, max: cfg.rotateMax },
        scale: { start: cfg.scaleStart, end: cfg.scaleEnd },
        alpha: { start: cfg.alphaStart, end: cfg.alphaEnd },
        frequency: cfg.frequency,
        quantity: cfg.quantity,
        tint: cfg.tint,
        blendMode: Phaser.BlendModes.NORMAL,
        emitting: true,
      });
      emitter.setDepth(cfg.depth);
      emitter.setScrollFactor(0);
      this.emitters.push(emitter);
    }
  }
}
