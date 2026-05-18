import type Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';

/** Map game-space coordinates to CSS pixels over the scaled canvas. */
export function gamePointToScreen(
  game: Phaser.Game,
  gx: number,
  gy: number,
): { left: number; top: number; scale: number } {
  const canvas = game.canvas;
  const rect = canvas.getBoundingClientRect();
  const scale = rect.width / GAME_WIDTH;
  return {
    left: rect.left + gx * scale,
    top: rect.top + gy * scale,
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
  const canvas = game.canvas;
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width / GAME_WIDTH;
  const scaleY = rect.height / GAME_HEIGHT;
  return {
    left: rect.left + gx * scaleX,
    top: rect.top + gy * scaleY,
    width: gw * scaleX,
    height: gh * scaleY,
  };
}
