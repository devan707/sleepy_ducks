import Phaser from 'phaser';
import {
  computeDefaultFlowLayer1,
  exportEnvironmentGeometryJson,
  getEnvironmentGeometry,
  type FlowLayerConfig,
} from '../config/environmentGeometry';
import { CALIBRATION_MODE_EVENT } from './calibrationMode';
import { isDevMode } from './isDevMode';
import type { WaterfallFlowEffect } from '../effects/WaterfallFlowEffect';

const MOVE_STEP = 2;
const SCALE_STEP = 0.02;

const LEGEND_LINES = [
  'F — flow align (pause)',
  'Arrows — move layer',
  '+ / - — height (scaleY)',
  '[ / ] — width (scaleX)',
  'E — export geometry JSON',
  'R — reset layer defaults',
];

/**
 * Dev-only: position/scale waterfall_flow_1 atlas. Pauses game via CALIBRATION_MODE_EVENT.
 */
export class FlowAtlasCalibrator {
  private scene: Phaser.Scene;
  private flowEffect: WaterfallFlowEffect;
  private active = false;
  private layerConfig!: FlowLayerConfig;
  private hintText!: Phaser.GameObjects.Text;
  private legendText!: Phaser.GameObjects.Text;
  private keyHandler!: (e: KeyboardEvent) => void;

  constructor(scene: Phaser.Scene, flowEffect: WaterfallFlowEffect) {
    if (!isDevMode()) {
      throw new Error('FlowAtlasCalibrator is only available in development builds');
    }
    this.scene = scene;
    this.flowEffect = flowEffect;
    this.layerConfig = flowEffect.getLayerConfig();

    this.legendText = scene.add
      .text(8, 200, LEGEND_LINES.join('\n'), {
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
      .text(8, 310, '', {
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
    this.layerConfig = this.flowEffect.getLayerConfig();
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

    if (e.key === 'f' || e.key === 'F') {
      if (this.active) this.exit();
      else this.enter();
      return;
    }

    if (!this.active) return;

    let moved = false;

    if (e.key === 'ArrowLeft') {
      this.layerConfig.x -= MOVE_STEP;
      moved = true;
    } else if (e.key === 'ArrowRight') {
      this.layerConfig.x += MOVE_STEP;
      moved = true;
    } else if (e.key === 'ArrowUp') {
      this.layerConfig.y -= MOVE_STEP;
      moved = true;
    } else if (e.key === 'ArrowDown') {
      this.layerConfig.y += MOVE_STEP;
      moved = true;
    } else if (e.key === '+' || e.key === '=') {
      this.layerConfig.scaleY += SCALE_STEP;
      moved = true;
    } else if (e.key === '-' || e.key === '_') {
      this.layerConfig.scaleY = Math.max(0.1, this.layerConfig.scaleY - SCALE_STEP);
      moved = true;
    } else if (e.key === ']') {
      this.layerConfig.scaleX += SCALE_STEP;
      moved = true;
    } else if (e.key === '[') {
      this.layerConfig.scaleX = Math.max(0.1, this.layerConfig.scaleX - SCALE_STEP);
      moved = true;
    } else if (e.key === 'r' || e.key === 'R') {
      this.layerConfig = computeDefaultFlowLayer1(this.scene);
      this.flowEffect.applyLayerConfig(this.layerConfig);
      this.refreshHint();
      return;
    } else if (e.key === 'e' || e.key === 'E') {
      this.exportGeometry();
      return;
    }

    if (moved) {
      this.flowEffect.applyLayerConfig(this.layerConfig);
      this.refreshHint();
    }
  }

  private refreshHint(): void {
    const c = this.layerConfig;
    this.hintText.setText(
      `[Flow layer 1]\nx:${c.x.toFixed(0)} y:${c.y.toFixed(0)} ` +
        `scaleX:${c.scaleX.toFixed(2)} scaleY:${c.scaleY.toFixed(2)}`,
    );
  }

  private exportGeometry(): void {
    const current = getEnvironmentGeometry(this.scene);
    const geometry = {
      ...current,
      flowLayers: [{ ...this.layerConfig }],
    };

    const json = exportEnvironmentGeometryJson(geometry);
    console.info('[FlowAtlasCalibrator] Geometry:\n', json);

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'environmentGeometry.json';
    a.click();
    URL.revokeObjectURL(url);

    this.flowEffect.applyLayerConfig(this.layerConfig);
    this.refreshHint();
  }
}
