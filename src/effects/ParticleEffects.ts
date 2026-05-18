import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets';
import { GAME_HEIGHT, GAME_WIDTH, STAGE } from '../config/gameConfig';

/** Pool mist at bottom only — not in the fall column. */
export function createMistEmitter(
  scene: Phaser.Scene,
): Phaser.GameObjects.Particles.ParticleEmitter {
  return scene.add.particles(0, 0, ASSET_KEYS.fxMist, {
    x: { min: 40, max: GAME_WIDTH - 40 },
    y: { min: STAGE.mistZoneTop, max: GAME_HEIGHT - 40 },
    lifespan: { min: 2000, max: 4200 },
    speedY: { min: -18, max: -6 },
    speedX: { min: -12, max: 12 },
    scale: { start: 0.35, end: 0.05 },
    alpha: { start: 0.35, end: 0 },
    frequency: 180,
    blendMode: Phaser.BlendModes.ADD,
  });
}

export function burstSplash(
  scene: Phaser.Scene,
  x: number,
  y: number,
): Phaser.GameObjects.Particles.ParticleEmitter {
  const emitter = scene.add.particles(x, y, ASSET_KEYS.fxSplash, {
    lifespan: { min: 300, max: 650 },
    speed: { min: 60, max: 180 },
    angle: { min: 200, max: 340 },
    gravityY: 280,
    scale: { start: 0.5, end: 0.1 },
    alpha: { start: 0.85, end: 0 },
    quantity: 14,
    emitting: false,
    blendMode: Phaser.BlendModes.ADD,
  });
  emitter.explode(14);
  scene.time.delayedCall(800, () => emitter.destroy());
  return emitter;
}
