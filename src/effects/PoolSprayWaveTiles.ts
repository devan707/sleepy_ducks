import Phaser from 'phaser';
import { POOL_SPRAY } from '../config/gameConfig';
import type { FallsPoolSprayLine } from '../objects/EnvironmentLayout';
import {
  ensurePoolSprayWaveTileTexture,
  POOL_SPRAY_WAVE_TILE_KEY,
} from './poolSprayTextures';

type WaveTile = {
  tile: Phaser.GameObjects.TileSprite;
  scrollX: number;
  scrollY: number;
  alphaBase: number;
  phase: number;
};

/**
 * Cheap LTR/RTL wave impression — masked tile bands instead of burst emitters.
 */
export class PoolSprayWaveTiles {
  private readonly tiles: WaveTile[] = [];
  private paused = false;
  private animPhase = 0;

  constructor(scene: Phaser.Scene, line: FallsPoolSprayLine, sprayY: number) {
    ensurePoolSprayWaveTileTexture(scene);
    const cfg = POOL_SPRAY;
    const zoneW = Math.max(24, line.width - cfg.spanInsetPx * 2);
    const bandH = cfg.emitHalfH * 2 + 14;

    const defs: {
      scrollX: number;
      scrollY: number;
      alpha: number;
      yOffset: number;
      phase: number;
    }[] = [
      { scrollX: 110, scrollY: 42, alpha: 0.38, yOffset: -3, phase: 0 },
      { scrollX: -92, scrollY: 36, alpha: 0.26, yOffset: 2, phase: 1.8 },
      { scrollX: 68, scrollY: 28, alpha: 0.18, yOffset: 0, phase: 3.1 },
    ];

    for (const def of defs) {
      const tile = scene.add.tileSprite(
        line.centerX,
        sprayY + def.yOffset,
        zoneW,
        bandH,
        POOL_SPRAY_WAVE_TILE_KEY,
      );
      tile.setOrigin(0.5, 0.5);
      tile.setDepth(cfg.depth + 0.05);
      tile.setScrollFactor(0);
      tile.setAlpha(def.alpha);
      tile.setTint(0xf2f9ff);
      tile.setBlendMode(Phaser.BlendModes.ADD);
      tile.tilePositionX = Phaser.Math.Between(0, 32);
      tile.tilePositionY = Phaser.Math.Between(0, 20);
      this.tiles.push({
        tile,
        scrollX: def.scrollX,
        scrollY: def.scrollY,
        alphaBase: def.alpha,
        phase: def.phase,
      });
    }
  }

  setMask(mask: Phaser.Display.Masks.GeometryMask): void {
    for (const { tile } of this.tiles) {
      tile.setMask(mask);
    }
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  update(_time: number, delta: number): void {
    if (this.paused) return;
    const dt = delta / 1000;
    this.animPhase += dt;

    for (const layer of this.tiles) {
      layer.tile.tilePositionX += layer.scrollX * dt;
      layer.tile.tilePositionY -= layer.scrollY * dt;
      const wave = 0.82 + 0.18 * Math.sin(this.animPhase * 2.4 + layer.phase);
      const sweep = 0.9 + 0.1 * Math.sin(layer.tile.tilePositionX * 0.025 + layer.phase);
      layer.tile.setAlpha(layer.alphaBase * wave * sweep);
    }
  }

  destroy(): void {
    for (const { tile } of this.tiles) {
      tile.destroy();
    }
    this.tiles.length = 0;
  }
}
