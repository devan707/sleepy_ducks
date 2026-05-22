import Phaser from 'phaser';
import { POOL_SPRAY } from '../config/gameConfig';
import type { FallsPoolSprayLine } from '../objects/EnvironmentLayout';
import {
  ensurePoolSprayGlowTileTexture,
  POOL_SPRAY_GLOW_TILE_KEY,
} from './poolSprayTextures';

/** Single wide haze tile — anchors the spray band without particles. */
export class PoolSprayBaseGlow {
  private tile: Phaser.GameObjects.TileSprite | null = null;
  private scrollX = 4;
  private paused = false;

  constructor(scene: Phaser.Scene, line: FallsPoolSprayLine, sprayY: number) {
    ensurePoolSprayGlowTileTexture(scene);
    const cfg = POOL_SPRAY;
    const zoneW = Math.max(32, line.width - cfg.spanInsetPx * 2 + 12);
    const bandH = cfg.emitHalfH * 2 + 22;

    this.tile = scene.add.tileSprite(
      line.centerX,
      sprayY + 1,
      zoneW,
      bandH,
      POOL_SPRAY_GLOW_TILE_KEY,
    );
    this.tile.setOrigin(0.5, 0.5);
    this.tile.setDepth(cfg.depth - 0.05);
    this.tile.setScrollFactor(0);
    this.tile.setAlpha(0.42);
    this.tile.setTint(0xe8f4fc);
    this.tile.setBlendMode(Phaser.BlendModes.ADD);
    this.tile.tilePositionX = Phaser.Math.Between(0, 24);
  }

  setMask(mask: Phaser.Display.Masks.GeometryMask): void {
    this.tile?.setMask(mask);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  update(_time: number, delta: number): void {
    if (this.paused || !this.tile) return;
    const dt = delta / 1000;
    this.tile.tilePositionX += this.scrollX * dt;
    const pulse = 0.92 + 0.08 * Math.sin(this.tile.tilePositionX * 0.03);
    this.tile.setAlpha(0.38 * pulse);
  }

  destroy(): void {
    this.tile?.destroy();
    this.tile = null;
  }
}
