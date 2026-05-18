import Phaser from 'phaser';
import {
  exportEnvironmentGeometryJson,
  getEnvironmentGeometry,
  type EnvironmentGeometry,
  type LipPoint,
} from '../config/environmentGeometry';
import {
  designToGame,
  drawLipDebugLines,
  gameToDesign,
  invalidateMaskCache,
} from '../objects/EnvironmentLayout';
import { CALIBRATION_MODE_EVENT } from './calibrationMode';
import { isDevMode } from './isDevMode';

type CalibratorStep = 'lipLeft' | 'lipRight' | 'done';

const LEGEND_LINES = [
  'C — enter / exit calibration (pauses game)',
  'Click — lip left, then lip right on cascade crest',
  'E — export environmentGeometry.json',
  'R — reset lip clicks',
  'Magenta = lip · Green = duck clip (lipMaskInsetY)',
  '?calibrate=1 — start in calibration mode',
];

/**
 * Dev-only lip calibrator. Pauses gameplay via calibration-mode-changed events.
 */
export class EnvironmentCalibrator {
  private scene: Phaser.Scene;
  private active = false;
  private step: CalibratorStep = 'lipLeft';
  private lipLeft: LipPoint | null = null;
  private lipRight: LipPoint | null = null;
  private graphics!: Phaser.GameObjects.Graphics;
  private hintText!: Phaser.GameObjects.Text;
  private legendText!: Phaser.GameObjects.Text;
  private keyHandler!: (e: KeyboardEvent) => void;

  constructor(scene: Phaser.Scene) {
    if (!isDevMode()) {
      throw new Error('EnvironmentCalibrator is only available in development builds');
    }
    this.scene = scene;
    this.graphics = scene.add.graphics().setDepth(201).setScrollFactor(0);

    this.legendText = scene.add
      .text(8, 72, LEGEND_LINES.join('\n'), {
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
      .text(8, 200, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#ff66ff',
        backgroundColor: '#000000cc',
        padding: { x: 8, y: 6 },
      })
      .setDepth(201)
      .setScrollFactor(0)
      .setVisible(false);

    this.keyHandler = (e: KeyboardEvent) => this.onKey(e);
    window.addEventListener('keydown', this.keyHandler);

    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.active) return;
      this.onPointer(pointer);
    });
  }

  destroy(): void {
    if (this.active) {
      this.setActive(false);
    }
    window.removeEventListener('keydown', this.keyHandler);
    this.graphics.destroy();
    this.hintText.destroy();
    this.legendText.destroy();
  }

  isActive(): boolean {
    return this.active;
  }

  enter(): void {
    if (this.active) return;
    this.setActive(true);
  }

  exit(): void {
    if (!this.active) return;
    this.setActive(false);
  }

  redraw(): void {
    this.graphics.clear();
    if (!this.active) return;

    drawLipDebugLines(this.graphics);

    if (this.lipLeft) {
      const p = designToGame(this.lipLeft.x, this.lipLeft.y);
      this.graphics.fillStyle(0xff00ff, 1);
      this.graphics.fillCircle(p.x, p.y, 6);
    }
    if (this.lipRight) {
      const p = designToGame(this.lipRight.x, this.lipRight.y);
      this.graphics.fillStyle(0x00ffff, 1);
      this.graphics.fillCircle(p.x, p.y, 6);
    }
    if (this.lipLeft && this.lipRight) {
      const a = designToGame(this.lipLeft.x, this.lipLeft.y);
      const b = designToGame(this.lipRight.x, this.lipRight.y);
      this.graphics.lineStyle(3, 0xffff00, 1);
      this.graphics.lineBetween(a.x, a.y, b.x, b.y);
    }

    const steps: Record<CalibratorStep, string> = {
      lipLeft: '► Click LIP LEFT on cascade crest',
      lipRight: '► Click LIP RIGHT on cascade crest',
      done: '► Press E to export · R to redo',
    };
    this.hintText.setText(`[Calibration — game paused]\n${steps[this.step]}`);
  }

  private setActive(on: boolean): void {
    this.active = on;
    this.hintText.setVisible(on);
    this.legendText.setVisible(on);
    this.scene.events.emit(CALIBRATION_MODE_EVENT, on);
    if (on) {
      this.redraw();
    } else {
      this.graphics.clear();
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (e.repeat) return;

    if (e.key === 'c' || e.key === 'C') {
      if (this.active) {
        this.exit();
      } else {
        this.enter();
      }
      return;
    }

    if (!this.active) return;

    if (e.key === 'r' || e.key === 'R') {
      this.step = 'lipLeft';
      this.lipLeft = null;
      this.lipRight = null;
      this.redraw();
      return;
    }

    if (e.key === 'e' || e.key === 'E') {
      this.exportGeometry();
    }
  }

  private onPointer(pointer: Phaser.Input.Pointer): void {
    const design = gameToDesign(pointer.x, pointer.y);

    if (this.step === 'lipLeft') {
      this.lipLeft = { x: Math.round(design.x), y: Math.round(design.y) };
      this.step = 'lipRight';
    } else if (this.step === 'lipRight') {
      this.lipRight = { x: Math.round(design.x), y: Math.round(design.y) };
      this.step = 'done';
    }
    this.redraw();
  }

  private exportGeometry(): void {
    const current = getEnvironmentGeometry();
    const geometry: EnvironmentGeometry = {
      ...current,
      ...(this.lipLeft && this.lipRight
        ? { lipLeft: this.lipLeft, lipRight: this.lipRight }
        : {}),
    };

    invalidateMaskCache();

    const json = exportEnvironmentGeometryJson(geometry);
    console.info('[EnvironmentCalibrator] Lip geometry:\n', json);

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'environmentGeometry.json';
    a.click();
    URL.revokeObjectURL(url);

    this.scene.events.emit('env-geometry-updated');
    this.redraw();
  }
}
