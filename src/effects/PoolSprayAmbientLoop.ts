import Phaser from 'phaser';
import { POOL_SPRAY } from '../config/gameConfig';
import type { FallsPoolSprayLine } from '../objects/EnvironmentLayout';

const AMBIENT_TILE_KEY = 'fx-pool-spray-ambient-tile';

type AmbientLayer = {
  tile: Phaser.GameObjects.TileSprite;
  scrollY: number;
  scrollX: number;
};

/** Tileable soft churn — replaces the mobile ambient particle emitter. */
function ensureAmbientSprayTileTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(AMBIENT_TILE_KEY)) return;

  const size = 64;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const dots: [number, number, number][] = [
    [14, 18, 5],
    [38, 12, 4],
    [52, 28, 3.5],
    [22, 42, 4.5],
    [46, 48, 5],
    [8, 34, 3],
    [30, 26, 3.5],
    [18, 52, 4],
    [44, 22, 3],
  ];

  for (const [x, y, r] of dots) {
    g.fillStyle(0xffffff, 0.22);
    g.fillCircle(x, y, r * 1.1);
    g.fillStyle(0xffffff, 0.55);
    g.fillCircle(x, y, r * 0.55);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(x, y, r * 0.28);
  }

  g.generateTexture(AMBIENT_TILE_KEY, size, size);
  g.destroy();
}

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
    ensureAmbientSprayTileTexture(scene);
    const cfg = POOL_SPRAY;
    const zoneW = Math.max(24, line.width - cfg.spanInsetPx * 2);
    const bandH = cfg.emitHalfH * 2 + 10;

    const layerDefs: { alpha: number; scrollY: number; scrollX: number; yOffset: number }[] = [
      { alpha: 0.62, scrollY: 52, scrollX: 6, yOffset: 0 },
      { alpha: 0.38, scrollY: 84, scrollX: -10, yOffset: 1 },
    ];

    for (const def of layerDefs) {
      const tile = scene.add.tileSprite(line.centerX, sprayY + def.yOffset, zoneW, bandH, AMBIENT_TILE_KEY);
      tile.setOrigin(0.5, 0.5);
      tile.setDepth(cfg.depth);
      tile.setScrollFactor(0);
      tile.setAlpha(def.alpha);
      tile.setTint(0xf2f9ff);
      tile.setBlendMode(Phaser.BlendModes.ADD);
      tile.tilePositionX = Phaser.Math.Between(0, 32);
      tile.tilePositionY = Phaser.Math.Between(0, 32);
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
