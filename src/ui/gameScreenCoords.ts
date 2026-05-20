import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';

type GameToScreenTransform = {
  rect: DOMRect;
  scale: number;
  offsetX: number;
  offsetY: number;
};

/** Uniform scale + centering offset for FIT letterboxing. */
function getGameToScreenTransform(game: Phaser.Game): GameToScreenTransform {
  const rect = game.canvas.getBoundingClientRect();
  const sx = rect.width / GAME_WIDTH;
  const sy = rect.height / GAME_HEIGHT;
  const scale = Math.min(sx, sy);
  const renderedW = GAME_WIDTH * scale;
  const renderedH = GAME_HEIGHT * scale;
  return {
    rect,
    scale,
    offsetX: (rect.width - renderedW) / 2,
    offsetY: (rect.height - renderedH) / 2,
  };
}

/** Map game-space coordinates to CSS pixels over the scaled canvas. */
export function gamePointToScreen(
  game: Phaser.Game,
  gx: number,
  gy: number,
): { left: number; top: number; scale: number } {
  const { rect, scale, offsetX, offsetY } = getGameToScreenTransform(game);
  return {
    left: rect.left + offsetX + gx * scale,
    top: rect.top + offsetY + gy * scale,
    scale,
  };
}

export function gameRectToScreen(
  game: Phaser.Game,
  gx: number,
  gy: number,
  gw: number,
  gh: number,
): { left: number; top: number; width: number; height: number } {
  const { rect, scale, offsetX, offsetY } = getGameToScreenTransform(game);
  return {
    left: rect.left + offsetX + gx * scale,
    top: rect.top + offsetY + gy * scale,
    width: gw * scale,
    height: gh * scale,
  };
}
