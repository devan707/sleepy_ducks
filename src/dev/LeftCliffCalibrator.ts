import Phaser from 'phaser';
import {
  computeDefaultLeftCliff,
  exportEnvironmentGeometryJson,
  getEnvironmentGeometry,
  type LayerPlacementConfig,
} from '../config/environmentGeometry';
import { CALIBRATION_MODE_EVENT } from './calibrationMode';
import { isDevMode } from './isDevMode';
import type { WaterfallStage } from '../objects/WaterfallStage';

const MOVE_STEP = 2;
const SCALE_STEP = 0.02;

const LEGEND_LINES = [
  'L — left cliff align (pause)',
  'Arrows — move layer',
  '+ / - — height (scaleY)',
  '[ / ] — width (scaleX)',
  'E — export geometry JSON',
  'R — reset defaults',
];

/**
 * Dev-only: position/scale left_cliff.png. Pauses game via CALIBRATION_MODE_EVENT.
 */
export class LeftCliffCalibrator {
  private scene: Phaser.Scene;
  private stage: WaterfallStage;
  private active = false;
  private cliffConfig!: LayerPlacementConfig;
  private hintText!: Phaser.GameObjects.Text;
  private legendText!: Phaser.GameObjects.Text;
  private keyHandler!: (e: KeyboardEvent) => void;

  constructor(scene: Phaser.Scene, stage: WaterfallStage) {
    if (!isDevMode()) {
      throw new Error('LeftCliffCalibrator is only available in development builds');
    }
    this.scene = scene;
    this.stage = stage;
    this.cliffConfig = stage.getLeftCliffPlacement();

    this.legendText = scene.add
      .text(8, 268, LEGEND_LINES.join('\n'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#bdc3c7',
        backgroundColor: '#000000bb',
        padding: { x: 8, y: 6 },
        lineSpacing: 4,
      })
      .setDepth(201)
      .setScrollFactor(0)
      .setVisible(false);

    this.hintText = scene.add
      .text(8, 378, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#66ccff',
        backgroundColor: '#000000cc',
        padding: { x: 8, y: 6 },
      })
      .setDepth(201)
      .setScrollFactor(0)
      .setVisible(false);

    this.keyHandler = (e: KeyboardEvent) => this.onKey(e);
    window.addEventListener('keydown', this.keyHandler);
  }

  destroy(): void {
    if (this.active) this.setActive(false);
    window.removeEventListener('keydown', this.keyHandler);
    this.hintText.destroy();
    this.legendText.destroy();
  }

  isActive(): boolean {
    return this.active;
  }

  enter(): void {
    if (this.active) return;
    this.cliffConfig = this.stage.getLeftCliffPlacement();
    this.setActive(true);
  }

  exit(): void {
    if (!this.active) return;
    this.setActive(false);
  }

  private setActive(on: boolean): void {
    this.active = on;
    this.hintText.setVisible(on);
    this.legendText.setVisible(on);
    this.scene.events.emit(CALIBRATION_MODE_EVENT, on);
    if (on) this.refreshHint();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.repeat) return;

    if (e.key === 'l' || e.key === 'L') {
      if (this.active) this.exit();
      else this.enter();
      return;
    }

    if (!this.active) return;

    let moved = false;

    if (e.key === 'ArrowLeft') {
      this.cliffConfig.x -= MOVE_STEP;
      moved = true;
    } else if (e.key === 'ArrowRight') {
      this.cliffConfig.x += MOVE_STEP;
      moved = true;
    } else if (e.key === 'ArrowUp') {
      this.cliffConfig.y -= MOVE_STEP;
      moved = true;
    } else if (e.key === 'ArrowDown') {
      this.cliffConfig.y += MOVE_STEP;
      moved = true;
    } else if (e.key === '+' || e.key === '=') {
      this.cliffConfig.scaleY += SCALE_STEP;
      moved = true;
    } else if (e.key === '-' || e.key === '_') {
      this.cliffConfig.scaleY = Math.max(0.1, this.cliffConfig.scaleY - SCALE_STEP);
      moved = true;
    } else if (e.key === ']') {
      this.cliffConfig.scaleX += SCALE_STEP;
      moved = true;
    } else if (e.key === '[') {
      this.cliffConfig.scaleX = Math.max(0.1, this.cliffConfig.scaleX - SCALE_STEP);
      moved = true;
    } else if (e.key === 'r' || e.key === 'R') {
      this.cliffConfig = computeDefaultLeftCliff();
      this.stage.applyLeftCliffConfig(this.cliffConfig);
      this.refreshHint();
      return;
    } else if (e.key === 'e' || e.key === 'E') {
      this.exportGeometry();
      return;
    }

    if (moved) {
      this.stage.applyLeftCliffConfig(this.cliffConfig);
      this.refreshHint();
    }
  }

  private refreshHint(): void {
    const c = this.cliffConfig;
    this.hintText.setText(
      `[Left cliff]\nx:${c.x.toFixed(0)} y:${c.y.toFixed(0)} ` +
        `scaleX:${c.scaleX.toFixed(2)} scaleY:${c.scaleY.toFixed(2)}`,
    );
  }

  private exportGeometry(): void {
    const current = getEnvironmentGeometry(this.scene);
    const geometry = {
      ...current,
      leftCliff: { ...this.cliffConfig },
    };

    const json = exportEnvironmentGeometryJson(geometry);
    console.info(
      '[LeftCliffCalibrator] Paste into src/config/environmentGeometry.json, save, then refresh:\n',
      json,
    );

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'environmentGeometry.json';
    a.click();
    URL.revokeObjectURL(url);

    this.stage.applyLeftCliffConfig(this.cliffConfig);
    this.refreshHint();
  }
}
