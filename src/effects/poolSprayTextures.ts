import type Phaser from 'phaser';

/** Tileable ambient churn at the falls foot. */
export const POOL_SPRAY_AMBIENT_TILE_KEY = 'fx-pool-spray-ambient-v2';
/** Horizontal foam streaks for crossing wave bands. */
export const POOL_SPRAY_WAVE_TILE_KEY = 'fx-pool-spray-wave-v2';
/** Wide soft lift under the impact line. */
export const POOL_SPRAY_GLOW_TILE_KEY = 'fx-pool-spray-glow-v2';

function paintSoftEllipse(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  alphas: [number, number, number],
): void {
  g.fillStyle(0xffffff, alphas[0]);
  g.fillEllipse(x, y, w * 1.15, h * 1.1);
  g.fillStyle(0xffffff, alphas[1]);
  g.fillEllipse(x, y, w * 0.72, h * 0.68);
  g.fillStyle(0xffffff, alphas[2]);
  g.fillEllipse(x, y, w * 0.38, h * 0.4);
}

/** Dense foam dots with a soft fade toward the top of the tile. */
export function ensurePoolSprayAmbientTileTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(POOL_SPRAY_AMBIENT_TILE_KEY)) return;

  const w = 128;
  const h = 96;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  for (let row = 0; row < 6; row++) {
    const t = row / 5;
    const bandAlpha = 0.08 + (1 - t) * 0.22;
    g.fillStyle(0xe8f6ff, bandAlpha);
    g.fillRect(0, row * (h / 6), w, h / 6 + 1);
  }

  const dots: [number, number, number, number, number][] = [
    [18, 72, 9, 12, 0.2],
    [42, 64, 11, 14, 0.24],
    [68, 78, 8, 11, 0.18],
    [96, 58, 10, 13, 0.22],
    [28, 48, 7, 9, 0.14],
    [54, 42, 8, 10, 0.16],
    [82, 36, 9, 11, 0.15],
    [110, 68, 7, 10, 0.17],
    [12, 28, 6, 8, 0.1],
    [64, 22, 7, 9, 0.11],
    [100, 26, 6, 8, 0.1],
  ];

  for (const [x, y, ew, eh, a] of dots) {
    paintSoftEllipse(g, x, y, ew, eh, [a * 0.55, a * 0.85, a]);
  }

  g.generateTexture(POOL_SPRAY_AMBIENT_TILE_KEY, w, h);
  g.destroy();
}

/** Elongated foam streaks biased for horizontal scrolling wave bands. */
export function ensurePoolSprayWaveTileTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(POOL_SPRAY_WAVE_TILE_KEY)) return;

  const w = 160;
  const h = 48;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  g.fillStyle(0xffffff, 0.06);
  g.fillRect(0, h * 0.35, w, h * 0.55);

  const streaks: [number, number, number, number, number][] = [
    [20, 28, 22, 8, 0.22],
    [52, 22, 26, 9, 0.28],
    [88, 30, 24, 8, 0.24],
    [120, 20, 20, 7, 0.2],
    [36, 14, 18, 6, 0.14],
    [72, 12, 22, 7, 0.16],
    [104, 16, 19, 6, 0.15],
  ];

  for (const [x, y, ew, eh, a] of streaks) {
    paintSoftEllipse(g, x, y, ew, eh, [a * 0.5, a * 0.8, a * 1.05]);
  }

  g.generateTexture(POOL_SPRAY_WAVE_TILE_KEY, w, h);
  g.destroy();
}

/** Low-frequency haze hugging the impact line. */
export function ensurePoolSprayGlowTileTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(POOL_SPRAY_GLOW_TILE_KEY)) return;

  const w = 192;
  const h = 32;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const cx = w / 2;
  const cy = h * 0.72;

  for (let i = 4; i >= 0; i--) {
    const t = i / 4;
    g.fillStyle(0xd8f0ff, 0.07 + t * 0.1);
    g.fillEllipse(cx, cy, w * (0.45 + t * 0.18), h * (0.35 + t * 0.25));
  }

  g.generateTexture(POOL_SPRAY_GLOW_TILE_KEY, w, h);
  g.destroy();
}
