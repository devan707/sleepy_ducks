import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets';
import {
  FALLS_BASE_MIST,
  FALLS_STREAK_BUBBLES,
  ROCK_OBSTACLES,
  STAGE,
} from '../config/gameConfig';
import {
  resolveFallsPoolSprayLine,
} from '../objects/EnvironmentLayout';

export const SPRAY_BUBBLE_KEY = 'fx-spray-bubble';
export const POOL_SPRAY_BUBBLE_KEY = 'fx-pool-spray-bubble';
export const FALLS_STREAK_BUBBLE_KEY = 'fx-falls-streak-bubble';

export type RockSprayAnchor = {
  x: number;
  hitTopY: number;
  hitBottomY: number;
  hitRadiusX: number;
};

/** Soft white dot for cascade spray — generated once per scene. */
export function ensureSprayBubbleTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(SPRAY_BUBBLE_KEY)) return;

  const size = 14;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 0.4);
  g.fillCircle(size / 2, size / 2, size * 0.44);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(size / 2, size / 2, size * 0.16);
  g.generateTexture(SPRAY_BUBBLE_KEY, size, size);
  g.destroy();
}

/** Slightly larger soft dot for pool-base spray waves. */
export function ensurePoolSprayBubbleTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(POOL_SPRAY_BUBBLE_KEY)) return;

  const size = 18;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 0.32);
  g.fillCircle(size / 2, size / 2, size * 0.46);
  g.fillStyle(0xffffff, 0.65);
  g.fillCircle(size / 2, size / 2, size * 0.26);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(size / 2, size / 2, size * 0.14);
  g.generateTexture(POOL_SPRAY_BUBBLE_KEY, size, size);
  g.destroy();
}

/** Vertical micro-streak for lip-to-base bubble sheets. */
export function ensureFallsStreakBubbleTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(FALLS_STREAK_BUBBLE_KEY)) return;

  const w = 6;
  const h = 18;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 0.35);
  g.fillEllipse(w / 2, h / 2, w * 0.9, h * 0.92);
  g.fillStyle(0xffffff, 0.85);
  g.fillEllipse(w / 2, h / 2, w * 0.45, h * 0.55);
  g.generateTexture(FALLS_STREAK_BUBBLE_KEY, w, h);
  g.destroy();
}

/** Single lip/rock streak emitter — shared particle tuning. */
export function createFallsStreakEmitter(
  scene: Phaser.Scene,
  x: number,
  y: number,
  depth = FALLS_STREAK_BUBBLES.depth,
  scaleMul = 1,
): Phaser.GameObjects.Particles.ParticleEmitter {
  ensureFallsStreakBubbleTexture(scene);
  const cfg = FALLS_STREAK_BUBBLES;

  const emitter = scene.add.particles(x, y, FALLS_STREAK_BUBBLE_KEY, {
    x: { min: -cfg.driftX, max: cfg.driftX },
    y: { min: -2, max: 4 },
    lifespan: { min: cfg.lifespanMin, max: cfg.lifespanMax },
    speed: { min: cfg.speedMin, max: cfg.speedMax },
    angle: { min: cfg.angleMin, max: cfg.angleMax },
    gravityY: cfg.gravityY,
    scale: { start: cfg.scaleStart * scaleMul, end: cfg.scaleEnd * scaleMul },
    alpha: { start: cfg.alphaStart, end: cfg.alphaEnd },
    frequency: cfg.frequency,
    quantity: cfg.quantity,
    tint: 0xf6fbff,
    blendMode: Phaser.BlendModes.ADD,
    emitting: true,
  });
  emitter.setDepth(depth);
  emitter.setScrollFactor(0);
  return emitter;
}

function createFlankSprayEmitter(
  scene: Phaser.Scene,
  x: number,
  y: number,
  angleMin: number,
  angleMax: number,
): Phaser.GameObjects.Particles.ParticleEmitter {
  const cfg = ROCK_OBSTACLES.spray;

  const emitter = scene.add.particles(x, y, SPRAY_BUBBLE_KEY, {
    x: { min: -cfg.emitHalfW, max: cfg.emitHalfW },
    y: { min: -cfg.emitHalfH, max: cfg.emitHalfH },
    lifespan: { min: cfg.lifespanMin, max: cfg.lifespanMax },
    speed: { min: cfg.speedMin, max: cfg.speedMax },
    angle: { min: angleMin, max: angleMax },
    gravityY: cfg.gravityY,
    scale: { start: cfg.scaleStart, end: cfg.scaleEnd },
    alpha: { start: cfg.alphaStart, end: cfg.alphaEnd },
    frequency: cfg.frequency,
    quantity: cfg.quantity,
    tint: 0xf4faff,
    blendMode: Phaser.BlendModes.ADD,
    emitting: true,
  });
  emitter.setDepth(cfg.depth);
  emitter.setScrollFactor(0);
  return emitter;
}

/** Side spray — one emitter on each rock flank where water deflects outward. */
export function createRockSprayEmitters(
  scene: Phaser.Scene,
  rocks: readonly RockSprayAnchor[],
): Phaser.GameObjects.Particles.ParticleEmitter[] {
  ensureSprayBubbleTexture(scene);
  const cfg = ROCK_OBSTACLES.spray;
  const emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  for (const rock of rocks) {
    const midY = (rock.hitTopY + rock.hitBottomY) * 0.5;
    const flankX = rock.hitRadiusX * cfg.flankOffsetFrac;

    emitters.push(
      createFlankSprayEmitter(
        scene,
        rock.x - flankX,
        midY,
        cfg.leftAngleMin,
        cfg.leftAngleMax,
      ),
      createFlankSprayEmitter(
        scene,
        rock.x + flankX,
        midY,
        cfg.rightAngleMin,
        cfg.rightAngleMax,
      ),
    );
  }

  return emitters;
}

/** Lip-style streak sheets below each rock foot. */
export function createRockStreakEmitters(
  scene: Phaser.Scene,
  rocks: readonly RockSprayAnchor[],
  emittersPerRock: number = ROCK_OBSTACLES.streak.emittersPerRock,
): Phaser.GameObjects.Particles.ParticleEmitter[] {
  const placement = ROCK_OBSTACLES.streak;
  const emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  const count = Math.max(1, emittersPerRock);

  for (const rock of rocks) {
    const spawnY = rock.hitBottomY + placement.spawnBelowHitBottomPx;
    const halfW = rock.hitRadiusX * placement.spanRadiusFrac;
    const inset = rock.hitRadiusX * placement.spanInsetFrac;
    const lo = rock.x - halfW + inset;
    const hi = rock.x + halfW - inset;

    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0.5;
      emitters.push(
        createFallsStreakEmitter(
          scene,
          lo + t * (hi - lo),
          spawnY,
          placement.depth,
          placement.scaleMul,
        ),
      );
    }
  }

  return emitters;
}

/** Larger bubbles rising from the falls base — mask-aligned, behind left cliff. */
export function createFallsBaseMistEmitter(
  scene: Phaser.Scene,
): Phaser.GameObjects.Particles.ParticleEmitter {
  const line = resolveFallsPoolSprayLine(scene);
  const cfg = FALLS_BASE_MIST;
  const anchorY = line.y + cfg.yOffsetPx;
  const zoneW = Math.max(20, line.width - cfg.spanInsetPx * 2);

  const emitter = scene.add.particles(line.centerX, anchorY, ASSET_KEYS.fxMist, {
    x: { min: -zoneW * 0.5, max: zoneW * 0.5 },
    y: { min: -cfg.spawnBandHalfH, max: cfg.spawnBandHalfH },
    lifespan: { min: cfg.lifespanMin, max: cfg.lifespanMax },
    speedY: { min: cfg.riseSpeedMin, max: cfg.riseSpeedMax },
    speedX: { min: -cfg.driftX, max: cfg.driftX },
    scale: { start: cfg.scaleStart, end: cfg.scaleEnd },
    alpha: { start: cfg.alphaStart, end: cfg.alphaEnd },
    frequency: cfg.frequency,
    quantity: cfg.quantity,
    blendMode: Phaser.BlendModes.ADD,
    emitting: true,
  });
  emitter.setDepth(cfg.depth);
  emitter.setScrollFactor(0);
  return emitter;
}

/** @deprecated Use createFallsBaseMistEmitter */
export function createMistEmitter(
  scene: Phaser.Scene,
): Phaser.GameObjects.Particles.ParticleEmitter {
  return createFallsBaseMistEmitter(scene);
}

export function burstComboCelebration(
  scene: Phaser.Scene,
  x: number,
  y: number,
  tier: number,
): Phaser.GameObjects.Particles.ParticleEmitter {
  const count = 10 + tier * 6;
  const emitter = scene.add.particles(x, y, ASSET_KEYS.fxSplash, {
    lifespan: { min: 280, max: 520 + tier * 90 },
    speed: { min: 90 + tier * 25, max: 220 + tier * 45 },
    angle: { min: 0, max: 360 },
    gravityY: 40 + tier * 12,
    scale: { start: 0.32 + tier * 0.06, end: 0.04 },
    alpha: { start: 0.95, end: 0 },
    tint: tier >= 3 ? [0xffcc44, 0xff8844, 0xffeeaa] : [0xffeeaa, 0xffdd66],
    quantity: count,
    emitting: false,
    blendMode: Phaser.BlendModes.ADD,
  }).setDepth(STAGE.hudDepth + 3);
  emitter.explode(count);
  scene.time.delayedCall(950 + tier * 80, () => emitter.destroy());
  return emitter;
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
