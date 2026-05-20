import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';

export type SceneScaleMode = 'fit' | 'cover';

export type CropInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

const MIN_INSET_FLOOR = 10;

const MOBILE_PHONE_MEDIA = '(max-width: 767px) and (pointer: coarse)';

/** Phones only — tablets/desktop are excluded. */
export function isMobilePhone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MOBILE_PHONE_MEDIA).matches;
}

export function isCoverLayoutActive(game: Phaser.Game): boolean {
  return isMobilePhone() && game.scale.scaleMode === Phaser.Scale.ENVELOP;
}

/** Switch FIT / ENVELOP on mobile; no-op on desktop/tablet. */
export function applySceneScale(game: Phaser.Game, mode: SceneScaleMode): void {
  if (!isMobilePhone()) return;

  const scaleMode = mode === 'cover' ? Phaser.Scale.ENVELOP : Phaser.Scale.FIT;
  if (game.scale.scaleMode === scaleMode) {
    game.scale.refresh();
    return;
  }

  game.scale.scaleMode = scaleMode;
  if (scaleMode !== Phaser.Scale.RESIZE && scaleMode !== Phaser.Scale.EXPAND) {
    game.scale.displaySize.setAspectMode(scaleMode);
  }
  game.scale.refresh();
}

/** Cropped game-space margins under ENVELOP (cover) on mobile. */
export function getCoverCropInsets(game: Phaser.Game): CropInsets {
  if (!isCoverLayoutActive(game)) {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  const rect = game.canvas.getBoundingClientRect();
  const sx = rect.width / GAME_WIDTH;
  const sy = rect.height / GAME_HEIGHT;
  const scale = Math.max(sx, sy);
  const renderedW = GAME_WIDTH * scale;
  const renderedH = GAME_HEIGHT * scale;
  const cropScreenX = Math.max(0, (renderedW - rect.width) / 2);
  const cropScreenY = Math.max(0, (renderedH - rect.height) / 2);

  return {
    left: cropScreenX / scale,
    right: cropScreenX / scale,
    top: cropScreenY / scale,
    bottom: cropScreenY / scale,
  };
}

export function getSceneCropInsets(scene: Phaser.Scene): CropInsets {
  return getCoverCropInsets(scene.game);
}

function floorInset(value: number): number {
  return value > 0 ? Math.max(value, MIN_INSET_FLOOR) : 0;
}

/** Y measured from top — nudge downward when top is cropped. */
export function insetFromTop(y: number, cropTop: number): number {
  return y + floorInset(cropTop);
}

/** Distance from bottom edge — increase inset when bottom is cropped. */
export function insetFromBottom(distanceFromBottom: number, cropBottom: number): number {
  return distanceFromBottom + floorInset(cropBottom);
}

/** Absolute Y from top, anchored from bottom edge. */
export function yFromBottom(distanceFromBottom: number, cropBottom: number): number {
  return GAME_HEIGHT - insetFromBottom(distanceFromBottom, cropBottom);
}

/** Absolute X — nudge left when right edge is cropped. */
export function insetFromRight(x: number, cropRight: number): number {
  return x - floorInset(cropRight);
}

/** Extra lift for bottom-anchored menu controls under cover (game px). */
export const MENU_BOTTOM_EXTRA_LIFT = 36;

/** Game over — lift bottom buttons and stats on mobile cover. */
export const GAME_OVER_BOTTOM_LIFT = 32;
/** Additional lift for the menu button (above retry). */
export const GAME_OVER_MENU_EXTRA_LIFT = 28;
/** Pull stats block upward to make room for buttons. */
export const GAME_OVER_STATS_LIFT = 24;

/** Push menu gear slightly below crop-safe top inset (game px). */
export const MENU_GEAR_DOWN_NUDGE = 14;

const DRAWER_REFERENCE_W = 318;
/** Compact settings panel height (matches SettingsDrawer content layout). */
export const DRAWER_PANEL_H = 614;
const DRAWER_SAFE_PAD = 14;

export type SafeRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type DrawerLayout = {
  panelWidth: number;
  panelHeight: number;
  panelY: number;
  panelXOpen: number;
  panelXClosed: number;
  panelScale: number;
  safeRect: SafeRect | null;
};

/** Visible game-space rect under mobile cover (null when full frame is shown). */
export function getVisibleSafeRect(game: Phaser.Game): SafeRect | null {
  if (!isCoverLayoutActive(game)) return null;

  const crop = getCoverCropInsets(game);
  const left = crop.left + DRAWER_SAFE_PAD;
  const top = crop.top + DRAWER_SAFE_PAD;
  const width = GAME_WIDTH - crop.left - crop.right - DRAWER_SAFE_PAD * 2;
  const height = GAME_HEIGHT - crop.top - crop.bottom - DRAWER_SAFE_PAD * 2;

  if (width <= 0 || height <= 0) return null;

  return { left, top, width, height };
}

/** Fit settings drawer inside the visible frame on mobile cover. */
export function getDrawerLayout(game: Phaser.Game): DrawerLayout {
  const scaledWAtFull = DRAWER_REFERENCE_W;
  const scaledHAtFull = DRAWER_PANEL_H;

  const centerInSafe = (
    safe: SafeRect,
    scale: number,
  ): Pick<DrawerLayout, 'panelY' | 'panelXOpen' | 'panelHeight' | 'panelScale'> => {
    const scaledW = scaledWAtFull * scale;
    const scaledH = scaledHAtFull * scale;
    return {
      panelScale: scale,
      panelHeight: scaledH,
      panelY: safe.top + (safe.height - scaledH) / 2,
      panelXOpen: safe.left + safe.width - scaledW,
    };
  };

  if (!isCoverLayoutActive(game)) {
    return {
      panelWidth: DRAWER_REFERENCE_W,
      panelHeight: DRAWER_PANEL_H,
      panelY: (GAME_HEIGHT - DRAWER_PANEL_H) / 2,
      panelXOpen: GAME_WIDTH - DRAWER_REFERENCE_W,
      panelXClosed: GAME_WIDTH + 4,
      panelScale: 1,
      safeRect: null,
    };
  }

  let safe = getVisibleSafeRect(game);
  if (!safe) {
    const edgeCrop = GAME_HEIGHT * 0.085;
    safe = {
      left: DRAWER_SAFE_PAD,
      top: edgeCrop + DRAWER_SAFE_PAD,
      width: GAME_WIDTH - DRAWER_SAFE_PAD * 2,
      height: GAME_HEIGHT - edgeCrop * 2 - DRAWER_SAFE_PAD * 2,
    };
  }

  const panelScale = Math.min(
    1,
    safe.height / DRAWER_PANEL_H,
    safe.width / DRAWER_REFERENCE_W,
  );

  return {
    panelWidth: DRAWER_REFERENCE_W,
    panelXClosed: GAME_WIDTH + 4,
    safeRect: safe,
    ...centerInSafe(safe, panelScale),
  };
}
