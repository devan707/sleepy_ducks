import Phaser from 'phaser';
import { ENV_DESIGN, ENV_KEYS } from '../config/environmentAssets';
import { getEnvironmentGeometry } from '../config/environmentGeometry';
import {
  DUCK_SPRITE,
  GAME_HEIGHT,
  GAME_WIDTH,
  SPAWN_LANE,
  STAGE,
} from '../config/gameConfig';
import { isDevMode } from '../dev/isDevMode';

export interface EnvScale {
  scaleX: number;
  scaleY: number;
}

export interface ChannelBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  centerX: number;
}

let cachedMaskBounds: ChannelBounds | null = null;
let flowMaskImage: Phaser.GameObjects.Image | null = null;
let flowBitmapMask: Phaser.Display.Masks.BitmapMask | null = null;
let lipEmergenceGraphics: Phaser.GameObjects.Graphics | null = null;
let lipEmergenceMask: Phaser.Display.Masks.GeometryMask | null = null;
let lipPoolGraphics: Phaser.GameObjects.Graphics | null = null;
let lipPoolMask: Phaser.Display.Masks.GeometryMask | null = null;

/** Maps 780×1699 environment art to the 390×844 game viewport. */
export function getEnvScale(): EnvScale {
  return {
    scaleX: GAME_WIDTH / ENV_DESIGN.width,
    scaleY: GAME_HEIGHT / ENV_DESIGN.height,
  };
}

export function designToGame(x: number, y: number, scale: EnvScale = getEnvScale()): {
  x: number;
  y: number;
} {
  return {
    x: x * scale.scaleX,
    y: y * scale.scaleY,
  };
}

export function gameToDesign(x: number, y: number, scale: EnvScale = getEnvScale()): {
  x: number;
  y: number;
} {
  return {
    x: x / scale.scaleX,
    y: y / scale.scaleY,
  };
}

/** Diagonal waterfall lip in design space (from environmentGeometry.json). */
export function getLipYDesign(x: number): number {
  const { lipLeft, lipRight } = getEnvironmentGeometry();
  const t = Phaser.Math.Clamp((x - lipLeft.x) / (lipRight.x - lipLeft.x), 0, 1);
  return Phaser.Math.Linear(lipLeft.y, lipRight.y, t);
}

/** Diagonal lip Y in game coordinates for a given screen X. */
export function getLipYGame(x: number, scale: EnvScale = getEnvScale()): number {
  const designX = x / scale.scaleX;
  return getLipYDesign(designX) * scale.scaleY;
}

/** Lip segment endpoints in game space (for debug + calibrator). */
export function getLipSegmentGame(scale: EnvScale = getEnvScale()): {
  left: { x: number; y: number };
  right: { x: number; y: number };
} {
  const { lipLeft, lipRight } = getEnvironmentGeometry();
  return {
    left: designToGame(lipLeft.x, lipLeft.y, scale),
    right: designToGame(lipRight.x, lipRight.y, scale),
  };
}

/** Spawn X range along the lip (game space). Screen-left = lower X. */
export function getSpawnLaneBounds(): { laneMinX: number; laneMaxX: number } {
  const lip = getLipSegmentGame();
  const halfDuck = DUCK_SPRITE.displayWidth * 0.5;
  return {
    laneMinX: Math.round(
      lip.left.x + SPAWN_LANE.leftGutterPx - SPAWN_LANE.leftExtendPx,
    ),
    laneMaxX: Math.round(lip.right.x - halfDuck - SPAWN_LANE.rightGutterPx),
  };
}

/** Unit vector along lip, left → right (game space). */
export function getLipDirectionGame(): { x: number; y: number } {
  const lip = getLipSegmentGame();
  const dx = lip.right.x - lip.left.x;
  const dy = lip.right.y - lip.left.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/**
 * Crest approach position: drift along the diagonal lip while rising (not straight up).
 * progress 0→1 moves from deep pool toward the lip at a left-to-right angle.
 */
export function getCrestApproachPosition(
  startX: number,
  progress: number,
  spawnBelowLip: number,
  crestEndBelowLip: number,
  driftAlongLip: number,
  laneMinX: number,
  laneMaxX: number,
): { x: number; y: number } {
  const t = Phaser.Math.Clamp(progress, 0, 1);
  const dir = getLipDirectionGame();
  const x = Phaser.Math.Clamp(startX + dir.x * driftAlongLip * t, laneMinX, laneMaxX);
  const below = Phaser.Math.Linear(spawnBelowLip, crestEndBelowLip, t);
  const y = getLipYGame(x) + below;
  return { x, y };
}

/**
 * Invisible image + BitmapMask aligned to bg_cliffs (same fit as fitStaticEnvImage).
 * Call once after mask texture is loaded.
 */
export function createFlowBitmapMask(scene: Phaser.Scene): Phaser.Display.Masks.BitmapMask {
  if (flowBitmapMask && flowMaskImage) {
    return flowBitmapMask;
  }

  if (!scene.textures.exists(ENV_KEYS.waterChannelMask)) {
    throw new Error(`Missing texture: ${ENV_KEYS.waterChannelMask}`);
  }

  flowMaskImage = scene.add.image(0, 0, ENV_KEYS.waterChannelMask);
  fitStaticEnvImage(flowMaskImage);
  flowMaskImage.setVisible(false);
  flowBitmapMask = flowMaskImage.createBitmapMask();
  cachedMaskBounds = null;
  return flowBitmapMask;
}

export function getFlowBitmapMask(scene: Phaser.Scene): Phaser.Display.Masks.BitmapMask {
  return flowBitmapMask ?? createFlowBitmapMask(scene);
}

/** Spawn / emitter bounds from white pixels in the mask texture. */
export function getMaskSpawnBounds(scene: Phaser.Scene): ChannelBounds {
  if (cachedMaskBounds) return cachedMaskBounds;

  const tex = scene.textures.get(ENV_KEYS.waterChannelMask);
  const source = tex.getSourceImage();
  const w = source.width;
  const h = source.height;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx || !(source instanceof HTMLImageElement || source instanceof HTMLCanvasElement)) {
    return {
      left: GAME_WIDTH * 0.2,
      top: GAME_HEIGHT * 0.22,
      width: GAME_WIDTH * 0.6,
      height: GAME_HEIGHT * 0.62,
      centerX: GAME_WIDTH / 2,
    };
  }

  ctx.drawImage(source, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const scale = getEnvScale();
  const threshold = 128;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = (py * w + px) * 4;
      const lum = data[i];
      if (lum >= threshold) {
        const gx = px * scale.scaleX;
        const gy = py * scale.scaleY;
        minX = Math.min(minX, gx);
        maxX = Math.max(maxX, gx);
        minY = Math.min(minY, gy);
        maxY = Math.max(maxY, gy);
      }
    }
  }

  if (!Number.isFinite(minX)) {
    cachedMaskBounds = {
      left: GAME_WIDTH * 0.2,
      top: GAME_HEIGHT * 0.22,
      width: GAME_WIDTH * 0.6,
      height: GAME_HEIGHT * 0.62,
      centerX: GAME_WIDTH / 2,
    };
    return cachedMaskBounds;
  }

  cachedMaskBounds = {
    left: minX,
    top: minY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
  };
  return cachedMaskBounds;
}

export function invalidateMaskCache(): void {
  cachedMaskBounds = null;
}

/** Lip segment used for duck emergence clip (+ STAGE.lipMaskInsetY). */
export function getMaskLipSegmentGame(): {
  left: { x: number; y: number };
  right: { x: number; y: number };
} {
  const lip = getLipSegmentGame();
  const inset = STAGE.lipMaskInsetY;
  return {
    left: { x: lip.left.x, y: lip.left.y + inset },
    right: { x: lip.right.x, y: lip.right.y + inset },
  };
}

/** Filled polygon above the diagonal lip (game space) — crest / air side. */
export function fillAboveLipMaskShape(g: Phaser.GameObjects.Graphics): void {
  const lip = getMaskLipSegmentGame();
  g.clear();
  g.fillStyle(0xffffff);
  g.fillTriangle(lip.left.x, lip.left.y, lip.right.x, lip.right.y, GAME_WIDTH, 0);
  g.fillTriangle(lip.left.x, lip.left.y, 0, 0, GAME_WIDTH, 0);
  /** Right cliff pocket above the lip endpoint (avoids unmasked sky sliver). */
  const pocketH = Math.max(lip.left.y, lip.right.y) + 12;
  g.fillRect(lip.right.x, 0, GAME_WIDTH - lip.right.x + 2, pocketH);
}

/** Filled polygon below the diagonal lip (game space) — pool / waterfall side. */
export function fillBelowLipMaskShape(g: Phaser.GameObjects.Graphics): void {
  const lip = getMaskLipSegmentGame();
  const { left, right } = lip;
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(left.x, left.y, right.x, right.y, right.x, GAME_HEIGHT);
  g.fillTriangle(left.x, left.y, left.x, GAME_HEIGHT, right.x, GAME_HEIGHT);
  if (left.x > 0) {
    g.fillRect(0, left.y, left.x, GAME_HEIGHT - left.y);
  }
  if (right.x < GAME_WIDTH) {
    g.fillRect(right.x, right.y, GAME_WIDTH - right.x, GAME_HEIGHT - right.y);
  }
}

/**
 * GeometryMask: visible only above the mask lip (pool side hidden).
 * Apply to the duck Container (not the child sprite).
 */
export function createLipEmergenceMask(scene: Phaser.Scene): Phaser.Display.Masks.GeometryMask {
  destroyLipEmergenceMask();
  lipEmergenceGraphics = scene.add.graphics();
  lipEmergenceGraphics.setScrollFactor(0);
  lipEmergenceGraphics.setVisible(false);
  fillAboveLipMaskShape(lipEmergenceGraphics);
  lipEmergenceMask = lipEmergenceGraphics.createGeometryMask();
  return lipEmergenceMask;
}

export function getLipEmergenceMask(scene: Phaser.Scene): Phaser.Display.Masks.GeometryMask {
  return lipEmergenceMask ?? createLipEmergenceMask(scene);
}

export function invalidateLipEmergenceMask(): void {
  if (lipEmergenceGraphics) {
    fillAboveLipMaskShape(lipEmergenceGraphics);
  }
  invalidateLipPoolMask();
}

export function destroyLipEmergenceMask(): void {
  lipEmergenceGraphics?.destroy();
  lipEmergenceGraphics = null;
  lipEmergenceMask = null;
}

/**
 * GeometryMask: visible only below the mask lip (air / cliff side hidden).
 * Use for dreamweed and other pool-surface objects.
 */
export function createLipPoolMask(scene: Phaser.Scene): Phaser.Display.Masks.GeometryMask {
  destroyLipPoolMask();
  lipPoolGraphics = scene.add.graphics();
  lipPoolGraphics.setScrollFactor(0);
  lipPoolGraphics.setVisible(false);
  fillBelowLipMaskShape(lipPoolGraphics);
  lipPoolMask = lipPoolGraphics.createGeometryMask();
  return lipPoolMask;
}

export function getLipPoolMask(scene: Phaser.Scene): Phaser.Display.Masks.GeometryMask {
  return lipPoolMask ?? createLipPoolMask(scene);
}

export function invalidateLipPoolMask(): void {
  if (lipPoolGraphics) {
    fillBelowLipMaskShape(lipPoolGraphics);
  }
}

export function destroyLipPoolMask(): void {
  lipPoolGraphics?.destroy();
  lipPoolGraphics = null;
  lipPoolMask = null;
}

/** Stretch static 780×1699 layers to fill the viewport (matches setDisplaySize). */
export function fitStaticEnvImage(image: Phaser.GameObjects.Image): void {
  image.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
  image.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  image.setOrigin(0.5, 0.5);
  image.setBlendMode(Phaser.BlendModes.NORMAL);
}

/** Left/right mask edges at a game-space Y (design mask scan). */
export function sampleMaskSpanAtGameY(
  scene: Phaser.Scene,
  gameY: number,
): { left: number; right: number } | null {
  if (!scene.textures.exists(ENV_KEYS.waterChannelMask)) return null;

  const tex = scene.textures.get(ENV_KEYS.waterChannelMask);
  const source = tex.getSourceImage();
  const w = source.width;
  const h = source.height;
  const scale = getEnvScale();
  const designY = Math.round(gameY / scale.scaleY);
  if (designY < 0 || designY >= h) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx || !(source instanceof HTMLImageElement || source instanceof HTMLCanvasElement)) {
    return null;
  }

  ctx.drawImage(source, 0, 0, w, h);
  const row = ctx.getImageData(0, designY, w, 1).data;
  const threshold = 128;
  let leftPx = -1;
  let rightPx = -1;

  for (let px = 0; px < w; px++) {
    if (row[px * 4] >= threshold) {
      if (leftPx < 0) leftPx = px;
      rightPx = px;
    }
  }

  if (leftPx < 0) return null;
  return {
    left: leftPx * scale.scaleX,
    right: rightPx * scale.scaleX,
  };
}

export interface DebugOverlay {
  destroy: () => void;
}

/** Dev-only: mask channel preview + lip lines above the waterfall. */
export function drawDebugLipLine(scene: Phaser.Scene): DebugOverlay | null {
  if (!isDevMode()) return null;

  let preview: Phaser.GameObjects.Image | null = null;
  if (scene.textures.exists(ENV_KEYS.waterChannelMask)) {
    preview = scene.add.image(0, 0, ENV_KEYS.waterChannelMask);
    fitStaticEnvImage(preview);
    preview.setDepth(STAGE.depthCalibrationDebug);
    preview.setAlpha(0.18);
    preview.setTint(0x00ffff);
    preview.setBlendMode(Phaser.BlendModes.NORMAL);
  }

  const g = scene.add.graphics().setDepth(STAGE.depthCalibrationDebug + 1).setScrollFactor(0);
  drawLipDebugLines(g);

  return {
    destroy: () => {
      g.destroy();
      preview?.destroy();
    },
  };
}

/** Magenta = saved lip. Green = duck clip line (lip + lipMaskInsetY). */
export function drawLipDebugLines(g: Phaser.GameObjects.Graphics): void {
  const lip = getLipSegmentGame();
  const maskLip = getMaskLipSegmentGame();

  g.fillStyle(0x00ff88, 0.1);
  g.fillTriangle(
    maskLip.left.x,
    maskLip.left.y,
    maskLip.right.x,
    maskLip.right.y,
    GAME_WIDTH,
    0,
  );
  g.fillTriangle(maskLip.left.x, maskLip.left.y, 0, 0, GAME_WIDTH, 0);

  g.lineStyle(3, 0x00ff88, 1);
  g.lineBetween(maskLip.left.x, maskLip.left.y, maskLip.right.x, maskLip.right.y);

  g.lineStyle(2, 0xff00ff, 0.95);
  g.lineBetween(lip.left.x, lip.left.y, lip.right.x, lip.right.y);
}

export function destroyFlowMask(): void {
  flowMaskImage?.destroy();
  flowMaskImage = null;
  flowBitmapMask = null;
  cachedMaskBounds = null;
  destroyLipEmergenceMask();
}
