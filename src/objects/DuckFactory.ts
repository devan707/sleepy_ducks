import Phaser from 'phaser';
import type { DuckKind, DuckSex } from '../config/gameConfig';
import { Duck } from './Duck';
import type { StageLayout, WaterfallStage } from './WaterfallStage';

export type { DuckKind, DuckSex };
export { Duck };

export function createDuck(
  scene: Phaser.Scene,
  sex: DuckSex,
  kind: DuckKind,
  layout: StageLayout,
  waterfallStage: WaterfallStage,
  spawnX: number,
): Duck {
  return new Duck(scene, sex, kind, layout, waterfallStage, spawnX);
}
