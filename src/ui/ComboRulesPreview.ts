import Phaser from 'phaser';
import { COLORS, COMBO_UI } from '../config/gameConfig';
import { comboMultiplier } from '../scoring/runScore';

const COMBO_GOLD = 0xf5b942;
const PANEL_FILL = 0x0a2230;
const TIMER_TRACK = 0x1e4a5c;
const TIMER_FILL = 0xffc857;

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

  const root = scene.add.container(centerX, topY);
  root.setScale(scale);

  const panel = scene.add.graphics();
  const timerBar = scene.add.graphics();
  const { width: w, height: h, radius: r } = COMBO_UI;

  panel.fillStyle(PANEL_FILL, 0.88);
  panel.fillRoundedRect(-w / 2, -h / 2, w, h, r);
  panel.lineStyle(2.5, COMBO_GOLD, 0.95);
  panel.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
  panel.lineStyle(1, 0xffffff, 0.12);
  panel.strokeRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, r - 4);

  const barW = COMBO_UI.width - 28;
  const barH = 5;
  const barX = -barW / 2;
  const barY = COMBO_UI.height / 2 - 14;
  const barRadius = barH / 2;

  timerBar.fillStyle(TIMER_TRACK, 0.65);
  timerBar.fillRoundedRect(barX, barY, barW, barH, barRadius);
  timerBar.fillStyle(TIMER_FILL, 0.95);
  timerBar.fillRoundedRect(barX, barY, barW * timerLeft, barH, barRadius);

  const labelText = scene.add
    .text(0, -26, 'COMBO', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#f8d78a',
      letterSpacing: 4,
    })
    .setOrigin(0.5);

  const valueText = scene.add
    .text(0, 2, String(sampleCombo), {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '44px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#5a3d08',
      strokeThickness: 5,
    })
    .setOrigin(0.5);

  const multText = scene.add
    .text(0, 30, `×${mult.toFixed(1)} combo`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: COLORS.combo,
    })
    .setOrigin(0.5);

  root.add([panel, timerBar, labelText, valueText, multText]);
  parent.add(root);

  return COMBO_UI.height * scale;
}
