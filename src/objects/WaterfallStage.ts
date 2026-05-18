import Phaser from 'phaser';
import { ENV_KEYS } from '../config/environmentAssets';
import {
  applyLayerPlacement,
  getFlowLayerConfig,
  getLeftCliffConfig,
  type LayerPlacementConfig,
} from '../config/environmentGeometry';
import { STAGE } from '../config/gameConfig';
import { EnvironmentCalibrator } from '../dev/EnvironmentCalibrator';
import { FlowAtlasCalibrator } from '../dev/FlowAtlasCalibrator';
import { LeftCliffCalibrator } from '../dev/LeftCliffCalibrator';
import { isDevMode } from '../dev/isDevMode';
import { DayNightCycle } from '../effects/DayNightCycle';
import { WaterfallFlowEffect } from '../effects/WaterfallFlowEffect';
import { createMistEmitter } from '../effects/ParticleEffects';
import {
  createLipEmergenceMask,
  destroyFlowMask,
  drawDebugLipLine,
  fitStaticEnvImage,
  getLipEmergenceMask,
  getLipYGame,
  getSpawnLaneBounds,
  invalidateLipEmergenceMask,
  invalidateMaskCache,
  type DebugOverlay,
} from './EnvironmentLayout';
import type { DuckMotionPhase } from './Duck';

export interface StageLayout {
  getLipY(x: number): number;
  crestTravelY: number;
  mistZoneTop: number;
  lipFallThreshold: number;
  laneMinX: number;
  laneMaxX: number;
}

/**
 * Layered waterfall: cliffs → masked atlas flow → opaque foreground rocks.
 */
export class WaterfallStage {
  private scene: Phaser.Scene;
  private layout: StageLayout;
  private flowEffect!: WaterfallFlowEffect;
  private mistEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private lipCalibrator: EnvironmentCalibrator | null = null;
  private flowCalibrator: FlowAtlasCalibrator | null = null;
  private debugOverlay: DebugOverlay | null = null;
  private calibrationDim: Phaser.GameObjects.Rectangle | null = null;
  private foregroundImage!: Phaser.GameObjects.Image;
  private leftCliffImage!: Phaser.GameObjects.Image;
  private dayNight!: DayNightCycle;
  private cliffCalibrator: LeftCliffCalibrator | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const lanes = getSpawnLaneBounds();
    this.layout = {
      getLipY: (x: number) => getLipYGame(x),
      crestTravelY: STAGE.crestTravelY,
      mistZoneTop: STAGE.mistZoneTop,
      lipFallThreshold: STAGE.lipFallThreshold,
      laneMinX: lanes.laneMinX,
      laneMaxX: lanes.laneMaxX,
    };

    this.createBackground();
    createLipEmergenceMask(scene);
    this.dayNight = new DayNightCycle(scene);
    this.createCalibrationDim();
    this.flowEffect = new WaterfallFlowEffect(scene);
    this.createForeground();
    this.createLeftCliff();
    this.mistEmitter = createMistEmitter(scene);
    this.mistEmitter.setDepth(STAGE.mistDepth);

    if (isDevMode()) {
      this.lipCalibrator = new EnvironmentCalibrator(scene);
      this.flowCalibrator = new FlowAtlasCalibrator(scene, this.flowEffect);
      this.cliffCalibrator = new LeftCliffCalibrator(scene, this);
      scene.events.on('env-geometry-updated', this.onGeometryUpdated, this);
    }
  }

  getLayout(): StageLayout {
    return this.layout;
  }

  getLipCalibrator(): EnvironmentCalibrator | null {
    return this.lipCalibrator;
  }

  getFlowCalibrator(): FlowAtlasCalibrator | null {
    return this.flowCalibrator;
  }

  getCliffCalibrator(): LeftCliffCalibrator | null {
    return this.cliffCalibrator;
  }

  applyLeftCliffConfig(cfg = getLeftCliffConfig()): void {
    if (!this.leftCliffImage) return;
    applyLayerPlacement(this.leftCliffImage, { ...cfg, alpha: 1 });
  }

  /** Current on-screen left cliff (for calibrator — avoids snapping back to file). */
  getLeftCliffPlacement(): LayerPlacementConfig {
    const img = this.leftCliffImage;
    return {
      x: img.x,
      y: img.y,
      scaleX: img.scaleX,
      scaleY: img.scaleY,
      originX: img.originX,
      originY: img.originY,
      alpha: 1,
    };
  }

  enterCalibrationMode(): void {
    this.lipCalibrator?.enter();
  }

  enterFlowAlignMode(): void {
    this.flowCalibrator?.enter();
  }

  exitCalibrationMode(): void {
    this.lipCalibrator?.exit();
  }

  exitFlowAlignMode(): void {
    this.flowCalibrator?.exit();
  }

  enterLeftCliffAlignMode(): void {
    this.cliffCalibrator?.enter();
  }

  exitLeftCliffAlignMode(): void {
    this.cliffCalibrator?.exit();
  }

  isCalibrationMode(): boolean {
    return this.lipCalibrator?.isActive() ?? false;
  }

  isFlowAlignMode(): boolean {
    return this.flowCalibrator?.isActive() ?? false;
  }

  isLeftCliffAlignMode(): boolean {
    return this.cliffCalibrator?.isActive() ?? false;
  }

  setCalibrationVisuals(visible: boolean): void {
    if (!isDevMode()) return;

    this.calibrationDim?.setVisible(visible);
    this.foregroundImage.setAlpha(1);
    this.foregroundImage.setBlendMode(Phaser.BlendModes.NORMAL);

    if (!visible) {
      this.debugOverlay?.destroy();
      this.debugOverlay = null;
      return;
    }

    if (!this.debugOverlay) {
      this.debugOverlay = drawDebugLipLine(this.scene);
    }
    this.lipCalibrator?.redraw();
  }

  update(time: number, delta: number, elapsedSec: number): void {
    this.dayNight.update(elapsedSec, delta);
    this.flowEffect.update(time, delta);
  }

  getLipEmergenceMask(): Phaser.Display.Masks.GeometryMask {
    return getLipEmergenceMask(this.scene);
  }

  getDuckDepth(crestProgress: number, motionPhase: DuckMotionPhase): number {
    if (motionPhase === 'falling') return STAGE.duckDepthBehind;
    if (crestProgress >= STAGE.lipCrestDepthThreshold) return STAGE.duckDepthFront;
    return STAGE.duckDepthBehind;
  }

  destroy(): void {
    if (isDevMode()) {
      this.scene.events.off('env-geometry-updated', this.onGeometryUpdated, this);
    }
    this.lipCalibrator?.destroy();
    this.flowCalibrator?.destroy();
    this.cliffCalibrator?.destroy();
    this.debugOverlay?.destroy();
    this.calibrationDim?.destroy();
    this.dayNight?.destroy();
    this.flowEffect?.destroy();
    this.mistEmitter?.destroy();
    destroyFlowMask();
  }

  private onGeometryUpdated(): void {
    invalidateMaskCache();
    invalidateLipEmergenceMask();
    const lanes = getSpawnLaneBounds();
    this.layout.laneMinX = lanes.laneMinX;
    this.layout.laneMaxX = lanes.laneMaxX;
    if (!this.flowCalibrator?.isActive()) {
      const cfg = getFlowLayerConfig(1, this.scene);
      this.flowEffect.applyLayerConfig(cfg);
    }

    if (
      this.lipCalibrator?.isActive() ||
      this.flowCalibrator?.isActive() ||
      this.cliffCalibrator?.isActive()
    ) {
      this.debugOverlay?.destroy();
      this.debugOverlay = drawDebugLipLine(this.scene);
      this.lipCalibrator?.redraw();
    }
  }

  private createBackground(): void {
    const bg = this.scene.add.image(0, 0, ENV_KEYS.bgCliffs);
    fitStaticEnvImage(bg);
    bg.setDepth(STAGE.depthBgCliffs);
    bg.setScrollFactor(0);
  }

  private createCalibrationDim(): void {
    if (!isDevMode()) return;

    const { width, height } = this.scene.scale;
    this.calibrationDim = this.scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.4)
      .setDepth(STAGE.depthCalibrationDim)
      .setScrollFactor(0)
      .setVisible(false);
  }

  private createForeground(): void {
    this.foregroundImage = this.scene.add.image(0, 0, ENV_KEYS.foregroundRocks);
    fitStaticEnvImage(this.foregroundImage);
    this.foregroundImage.setDepth(STAGE.depthForegroundRocks);
    this.foregroundImage.setScrollFactor(0);
    this.foregroundImage.setAlpha(1);
    this.foregroundImage.setBlendMode(Phaser.BlendModes.NORMAL);
  }

  private createLeftCliff(): void {
    const key = this.scene.textures.exists(ENV_KEYS.leftCliff)
      ? ENV_KEYS.leftCliff
      : ENV_KEYS.foregroundRocks;
    this.leftCliffImage = this.scene.add.image(0, 0, key);
    this.leftCliffImage.setDepth(STAGE.depthLeftCliff);
    this.leftCliffImage.setScrollFactor(0);
    this.applyLeftCliffConfig();
  }
}
