import Phaser from 'phaser';
import { MOONFLOWER_ATLAS_KEYS } from '../config/moonflowerAssets';

/** Generated grey flower shape for the HUD slot (transparent + 1px outline). */
export const MOONFLOWER_HUD_SILHOUETTE_KEY = 'moonflower-hud-silhouette';

/** Mid sway pose — reads clearly as an open moonflower. */
const SOURCE_FRAME = 'frame_003';

const PROCESS_SIZE = 80;
const ALPHA_THRESHOLD = 24;
const FILL = { r: 118, g: 118, b: 128 };
const OUTLINE = { r: 72, g: 72, b: 80 };

/**
 * Build a grey silhouette texture from one moonflower sway frame.
 * Opaque pixels become flat grey; transparent edge gets a 1px outline.
 */
export function ensureMoonflowerHudSilhouetteTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(MOONFLOWER_HUD_SILHOUETTE_KEY)) {
    return MOONFLOWER_HUD_SILHOUETTE_KEY;
  }

  const sourceKey = scene.textures.exists(MOONFLOWER_ATLAS_KEYS.sway)
    ? MOONFLOWER_ATLAS_KEYS.sway
    : MOONFLOWER_ATLAS_KEYS.bloom;

  if (!scene.textures.exists(sourceKey)) {
    createPlaceholderSilhouette(scene);
    return MOONFLOWER_HUD_SILHOUETTE_KEY;
  }

  const texture = scene.textures.get(sourceKey);
  if (!texture.has(SOURCE_FRAME)) {
    createPlaceholderSilhouette(scene);
    return MOONFLOWER_HUD_SILHOUETTE_KEY;
  }

  const frame = texture.get(SOURCE_FRAME);
  const source = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;

  const w = PROCESS_SIZE;
  const h = PROCESS_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    createPlaceholderSilhouette(scene);
    return MOONFLOWER_HUD_SILHOUETTE_KEY;
  }

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(
    source,
    frame.cutX,
    frame.cutY,
    frame.width,
    frame.height,
    0,
    0,
    w,
    h,
  );

  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const isOpaqueAt = (x: number, y: number): boolean => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    return src.data[(y * w + x) * 4 + 3] > ALPHA_THRESHOLD;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (isOpaqueAt(x, y)) {
        out.data[i] = FILL.r;
        out.data[i + 1] = FILL.g;
        out.data[i + 2] = FILL.b;
        out.data[i + 3] = 255;
      }
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (out.data[i + 3] > 0) continue;

      let edge = false;
      for (let dy = -1; dy <= 1 && !edge; dy++) {
        for (let dx = -1; dx <= 1 && !edge; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (isOpaqueAt(x + dx, y + dy)) edge = true;
        }
      }
      if (edge) {
        out.data[i] = OUTLINE.r;
        out.data[i + 1] = OUTLINE.g;
        out.data[i + 2] = OUTLINE.b;
        out.data[i + 3] = 255;
      }
    }
  }

  ctx.putImageData(out, 0, 0);
  scene.textures.addCanvas(MOONFLOWER_HUD_SILHOUETTE_KEY, canvas);
  return MOONFLOWER_HUD_SILHOUETTE_KEY;
}

function createPlaceholderSilhouette(scene: Phaser.Scene): void {
  const s = PROCESS_SIZE;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x767680, 1);
  g.fillEllipse(s / 2, s / 2 + 2, s * 0.42, s * 0.52);
  g.fillStyle(0x484850, 1);
  g.lineStyle(1, 0x484850, 1);
  g.strokeEllipse(s / 2, s / 2 + 2, s * 0.42, s * 0.52);
  g.generateTexture(MOONFLOWER_HUD_SILHOUETTE_KEY, s, s);
  g.destroy();
}
