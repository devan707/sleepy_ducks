import Phaser from 'phaser';
import {
  isCalibrateCliffUrlParam,
  isCalibrateFlowUrlParam,
  isCalibrateUrlParam,
} from './calibrationMode';
import { isDevMode } from './isDevMode';

const LEGEND = [
  'Dev controls',
  'C — lip calibration (pause)',
  '  Click lip left → right · E export',
  'F — flow atlas align (pause)',
  '  Arrows move · +/- height · [/] width · E export',
  'L — left cliff align (pause)',
  '  Arrows move · +/- height · [/] width · E export',
  'W — watch mode (no life loss)',
  '  P pause time · , +5s · . +15s · H hide help',
  '?watch=1 — start in watch mode',
  '?calibrate=1 — lip · flow · cliff',
  'Magenta = lip · Green = duck clip',
];

/**
 * Bottom-left dev legend. No-op outside development builds.
 */
export class DevControlsLegend {
  private text: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene) {
    if (!isDevMode()) return;

    let extra = '';
    if (isCalibrateUrlParam()) extra += '\n(lip calibrate URL)';
    if (isCalibrateFlowUrlParam()) extra += '\n(flow calibrate URL)';
    if (isCalibrateCliffUrlParam()) extra += '\n(cliff calibrate URL)';

    this.text = scene.add
      .text(8, scene.scale.height - 8, LEGEND.join('\n') + extra, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#95a5a6',
        backgroundColor: '#00000099',
        padding: { x: 6, y: 5 },
        lineSpacing: 2,
      })
      .setOrigin(0, 1)
      .setDepth(202)
      .setScrollFactor(0)
      .setAlpha(0.85)
      .setVisible(false);
  }

  setVisible(visible: boolean): void {
    if (!isDevMode()) return;
    this.text?.setVisible(visible);
  }

  destroy(): void {
    this.text?.destroy();
    this.text = null;
  }
}
