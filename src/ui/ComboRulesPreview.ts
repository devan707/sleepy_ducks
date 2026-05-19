import Phaser from 'phaser';
import { COMBO_UI } from '../config/gameConfig';
import { comboMultiplier } from '../scoring/runScore';
import {
  drawComboPanelMeter,
  getComboPanelTextLayout,
} from '../objects/ComboCounter';

/** In-game combo panel preview for the how-to-play screen. */
export function addComboRulesPreview(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  centerX: number,
  topY: number,
  scale = 0.5,
): number {
  const sampleCombo = 5;
  const timerLeft = 0.62;
  const mult = comboMultiplier(sampleCombo);
  const layout = getComboPanelTextLayout();

  const root = scene.add.container(centerX, topY);
  root.setScale(scale);

  const panel = scene.add.graphics();
  drawComboPanelMeter(panel, timerLeft);

  const labelText = scene.add
    .text(0, layout.labelY, 'COMBO', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: `${layout.labelSize}px`,
      fontStyle: 'bold',
      color: '#fff8d0',
      letterSpacing: 4,
    })
    .setOrigin(0.5);

  const valueText = scene.add
    .text(0, layout.valueY, String(sampleCombo), {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: `${layout.valueSize}px`,
      fontStyle: 'bold',
      color: '#fffef0',
      stroke: '#5a3d08',
      strokeThickness: 5,
    })
    .setOrigin(0.5);

  const multText = scene.add
    .text(0, layout.multY, `×${mult.toFixed(1)} combo`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: `${layout.multSize}px`,
      fontStyle: 'bold',
      color: '#ffdd55',
      stroke: '#5a3d08',
      strokeThickness: 3,
    })
    .setOrigin(0.5);

  root.add([panel, labelText, valueText, multText]);
  parent.add(root);

  return COMBO_UI.height * scale;
}
