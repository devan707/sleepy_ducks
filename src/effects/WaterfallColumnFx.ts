import Phaser from 'phaser';
import { FALLS_STREAK_BUBBLES } from '../config/gameConfig';
import { getFallsStreakEmitterCount } from '../config/performanceProfile';
import { sampleLipEmitPoints } from '../objects/EnvironmentLayout';
import { createFallsStreakEmitter } from './ParticleEffects';

/** Falling microbubble streaks in the falls column. */
export class WaterfallColumnFx {
  private readonly scene: Phaser.Scene;
  private readonly emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.buildStreakBubbles();
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

  private buildStreakBubbles(): void {
    const cfg = FALLS_STREAK_BUBBLES;
    const count = getFallsStreakEmitterCount(cfg.emitterCount);
    const lip = sampleLipEmitPoints(count);

    for (const point of lip) {
      this.emitters.push(
        createFallsStreakEmitter(
          this.scene,
          point.x,
          point.y + cfg.lipInsetPx,
        ),
      );
    }
  }
}
