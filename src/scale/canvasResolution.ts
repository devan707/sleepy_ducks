import type Phaser from 'phaser';

/** Cap retina multiplier — 2× is a good balance of sharpness vs GPU cost on phones. */
export const MAX_CANVAS_DPR = 2;

/** Device pixel ratio used for canvas backing store (1 on desktop, up to 2 on mobile). */
export function getCanvasDpr(): number {
  if (typeof window === 'undefined') return 1;
  return Math.min(Math.max(window.devicePixelRatio || 1, 1), MAX_CANVAS_DPR);
}

let applyingResolution = false;

/**
 * Raise internal canvas resolution for crisp FIT scaling on high-DPI screens.
 * Game coordinates stay at GAME_WIDTH × GAME_HEIGHT.
 */
export function applyCanvasResolution(game: Phaser.Game): void {
  if (applyingResolution) return;

  const dpr = getCanvasDpr();
  const scale = game.scale;
  if (scale.zoom === dpr) return;

  applyingResolution = true;
  try {
    scale.setZoom(dpr);
  } finally {
    applyingResolution = false;
  }
}

export type CanvasDiagnosticsSnapshot = {
  devicePixelRatio: number;
  appliedZoom: number;
  gameWidth: number;
  gameHeight: number;
  canvasBackingW: number;
  canvasBackingH: number;
  canvasCssW: number;
  canvasCssH: number;
  displayWidth: number;
  displayHeight: number;
};

export function captureCanvasDiagnostics(game: Phaser.Game): CanvasDiagnosticsSnapshot {
  const canvas = game.canvas;
  const rect = canvas.getBoundingClientRect();
  return {
    devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    appliedZoom: game.scale.zoom,
    gameWidth: game.scale.width,
    gameHeight: game.scale.height,
    canvasBackingW: canvas.width,
    canvasBackingH: canvas.height,
    canvasCssW: Math.round(rect.width),
    canvasCssH: Math.round(rect.height),
    displayWidth: game.scale.displaySize.width,
    displayHeight: game.scale.displaySize.height,
  };
}
