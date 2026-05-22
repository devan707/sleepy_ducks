import Phaser from 'phaser';
import { POOL_SPRAY } from '../config/gameConfig';
import type { FallsPoolSprayLine } from '../objects/EnvironmentLayout';
import {
  ensurePoolSprayAmbientTileTexture,
  POOL_SPRAY_AMBIENT_TILE_KEY,
} from './poolSprayTextures';

type AmbientLayer = {
  tile: Phaser.GameObjects.TileSprite;
  scrollY: number;
  scrollX: number;
};

/**
 * Masked scrolling tile layers at the falls foot — cheap substitute for the
 * continuous ambient particle churn on mobile.
 */
export class PoolSprayAmbientLoop {
  private readonly layers: AmbientLayer[] = [];
  private paused = false;

  constructor(
    scene: Phaser.Scene,
    line: FallsPoolSprayLine,
    sprayY: number,
  ) {
    ensurePoolSprayAmbientTileTexture(scene);
    const cfg = POOL_SPRAY;
    const zoneW = Math.max(24, line.width - cfg.spanInsetPx * 2);
    const bandH = cfg.emitHalfH * 2 + 18;

    const layerDefs: {
      alpha: number;
      scrollY: number;
      scrollX: number;
      yOffset: number;
      tileScale: number;
    }[] = [
      { alpha: 0.55, scrollY: 48, scrollX: 5, yOffset: 1, tileScale: 1 },
      { alpha: 0.4, scrollY: 72, scrollX: -8, yOffset: -1, tileScale: 1.05 },
      { alpha: 0.28, scrollY: 96, scrollX: 3, yOffset: 2, tileScale: 0.95 },
    ];

    for (const def of layerDefs) {
      const tile = scene.add.tileSprite(
        line.centerX,
        sprayY + def.yOffset,
        zoneW,
        bandH,
        POOL_SPRAY_AMBIENT_TILE_KEY,
      );
      tile.setOrigin(0.5, 0.5);
      tile.setDepth(cfg.depth);
      tile.setScrollFactor(0);
      tile.setAlpha(def.alpha);
      tile.setTint(0xf2f9ff);
      tile.setBlendMode(Phaser.BlendModes.ADD);
      tile.setTileScale(def.tileScale);
      tile.tilePositionX = Phaser.Math.Between(0, 48);
      tile.tilePositionY = Phaser.Math.Between(0, 40);
      this.layers.push({ tile, scrollY: def.scrollY, scrollX: def.scrollX });
    }
  }

  setMask(mask: Phaser.Display.Masks.GeometryMask): void {
    for (const { tile } of this.layers) {
      tile.setMask(mask);
    }
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  update(_time: number, delta: number): void {
    if (this.paused) return;
    const dt = delta / 1000;
    for (const layer of this.layers) {
      layer.tile.tilePositionY -= layer.scrollY * dt;
      layer.tile.tilePositionX += layer.scrollX * dt;
    }
  }

  destroy(): void {
    for (const { tile } of this.layers) {
      tile.destroy();
    }
    this.layers.length = 0;
  }
}
