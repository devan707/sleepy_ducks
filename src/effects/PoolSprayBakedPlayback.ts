import Phaser from 'phaser';
import { POOL_SPRAY } from '../config/gameConfig';
import { POOL_SPRAY_BAKED } from '../config/poolSprayBake';
import type { FallsPoolSprayLine } from '../objects/EnvironmentLayout';

/** True when the baked spritesheet loaded and has usable frames. */
export function hasPoolSprayBakedAssets(scene: Phaser.Scene): boolean {
  const cfg = POOL_SPRAY_BAKED;
  if (!scene.textures.exists(cfg.textureKey)) return false;
  const names = scene.textures
    .get(cfg.textureKey)
    .getFrameNames()
    .filter((n) => n !== '__BASE');
  return names.length >= 4;
}

/** Register the loop animation after the atlas is in the texture manager. */
export function registerPoolSprayBakedAnimation(scene: Phaser.Scene): void {
  const cfg = POOL_SPRAY_BAKED;
  if (!scene.textures.exists(cfg.textureKey)) return;
  if (scene.anims.exists(cfg.animKey)) return;

  const names = scene.textures
    .get(cfg.textureKey)
    .getFrameNames()
    .filter((n) => n !== '__BASE')
    .sort();

  if (names.length === 0) return;

  const frames = names.map((frame) => ({ key: cfg.textureKey, frame }));

  scene.anims.create({
    key: cfg.animKey,
    frames,
    frameRate: cfg.frameRate,
    repeat: -1,
  });
}

/**
 * Single masked sprite loop — replaces tile layers + burst emitters on mobile.
 */
export class PoolSprayBakedPlayback {
  private sprite: Phaser.GameObjects.Sprite | null = null;

  constructor(scene: Phaser.Scene, line: FallsPoolSprayLine, sprayY: number) {
    const cfg = POOL_SPRAY_BAKED;
    registerPoolSprayBakedAnimation(scene);

    this.sprite = scene.add.sprite(line.centerX, sprayY + POOL_SPRAY.yOffsetPx, cfg.textureKey, 0);
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.setDepth(POOL_SPRAY.depth + 0.35);
    this.sprite.setScrollFactor(0);
    this.sprite.setTint(0xf2f9ff);
    this.sprite.setBlendMode(Phaser.BlendModes.ADD);

    const scaleX = Math.max(0.85, Math.min(1.35, line.width / cfg.frameWidth));
    this.sprite.setDisplaySize(cfg.frameWidth * scaleX, cfg.frameHeight);

    if (scene.anims.exists(cfg.animKey)) {
      this.sprite.play(cfg.animKey);
    }
  }

  setMask(mask: Phaser.Display.Masks.GeometryMask): void {
    this.sprite?.setMask(mask);
  }

  setPaused(paused: boolean): void {
    if (!this.sprite) return;
    if (paused) {
      this.sprite.anims?.pause();
    } else {
      this.sprite.anims?.resume();
    }
  }

  update(_time: number, _delta: number): void {
    /* Animation-driven — no per-frame simulation. */
  }

  destroy(): void {
    this.sprite?.destroy();
    this.sprite = null;
  }
}
