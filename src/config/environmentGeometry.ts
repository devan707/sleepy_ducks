import Phaser from 'phaser';
import baseGeometry from './environmentGeometry.json';
import {
  getLipSegmentGame,
  sampleMaskSpanAtGameY,
} from '../objects/EnvironmentLayout';

export interface LipPoint {
  x: number;
  y: number;
}

export interface FlowLayerConfig {
  id: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  originX: number;
  originY: number;
  alpha: number;
}

export interface LayerPlacementConfig {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  originX: number;
  originY: number;
  alpha: number;
}

export interface EnvironmentGeometry {
  lipLeft: LipPoint;
  lipRight: LipPoint;
  /** Extra flow width without changing height (1.22 ≈ 22% wider than scaleY). */
  flowWidthScale?: number;
  flowLayers?: FlowLayerConfig[];
  leftCliff?: LayerPlacementConfig;
}

export const FLOW_FRAME_W = 480;
export const FLOW_FRAME_H = 864;
/** Default: widen flow to fill mask channel without scaling height. */
export const DEFAULT_FLOW_WIDTH_SCALE = 1.22;

/** Uniform scale so 480×864 frames keep their aspect ratio (fit channel width at lip). */
export function computeFlowUniformScale(channelWidth: number): number {
  return channelWidth / FLOW_FRAME_W;
}

/** Default left cliff overlay (game coordinates; tune in dev with L). */
export function computeDefaultLeftCliff(): LayerPlacementConfig {
  const lip = getLipSegmentGame();
  return {
    x: 0,
    y: lip.left.y - 24,
    scaleX: 0.66,
    scaleY: 0.5,
    originX: 0,
    originY: 0,
    alpha: 1,
  };
}

/** Default flow_1: fit mask height (scaleY), widen (scaleX), align left edge to channel. */
export function computeDefaultFlowLayer1(
  scene?: Phaser.Scene,
  widthScale = DEFAULT_FLOW_WIDTH_SCALE,
): FlowLayerConfig {
  const lip = getLipSegmentGame();
  const lipMidY = (lip.left.y + lip.right.y) / 2;

  let channelWidth = lip.right.x - lip.left.x;
  let channelLeft = lip.left.x;
  if (scene) {
    const span = sampleMaskSpanAtGameY(scene, lipMidY);
    if (span) {
      channelWidth = span.right - span.left;
      channelLeft = span.left;
    }
  }
  channelWidth = Math.max(80, channelWidth);

  const scaleY = computeFlowUniformScale(channelWidth);
  const scaleX = scaleY * widthScale;
  const halfW = (FLOW_FRAME_W * scaleX) / 2;

  return {
    id: 1,
    x: channelLeft + halfW,
    y: lipMidY,
    scaleX,
    scaleY,
    originX: 0.5,
    originY: 0,
    alpha: 1,
  };
}

function geometryFromFile(): EnvironmentGeometry {
  const base = baseGeometry as EnvironmentGeometry;
  return {
    lipLeft: base.lipLeft,
    lipRight: base.lipRight,
    flowLayers: base.flowLayers?.length
      ? base.flowLayers
      : [computeDefaultFlowLayer1()],
    leftCliff: base.leftCliff ?? computeDefaultLeftCliff(),
  };
}

export function getEnvironmentGeometry(scene?: Phaser.Scene): EnvironmentGeometry {
  const merged = geometryFromFile();
  if (!merged.flowLayers?.length) {
    merged.flowLayers = [computeDefaultFlowLayer1(scene)];
  }
  return merged;
}

export function getFlowLayerConfig(
  layerId: number,
  scene?: Phaser.Scene,
): FlowLayerConfig {
  const geo = getEnvironmentGeometry(scene);
  const found = geo.flowLayers?.find((l) => l.id === layerId);
  return found ?? computeDefaultFlowLayer1(scene, geo.flowWidthScale);
}

export function getLeftCliffConfig(): LayerPlacementConfig {
  const geo = getEnvironmentGeometry();
  return { ...(geo.leftCliff ?? computeDefaultLeftCliff()) };
}

export function applyLayerPlacement(
  obj: Phaser.GameObjects.Image,
  cfg: LayerPlacementConfig,
): void {
  obj.setPosition(cfg.x, cfg.y);
  obj.setScale(cfg.scaleX, cfg.scaleY);
  obj.setOrigin(cfg.originX, cfg.originY);
  obj.setAlpha(cfg.alpha);
  obj.setBlendMode(Phaser.BlendModes.NORMAL);
}

/** @deprecated Geometry is read only from environmentGeometry.json — use export + save file. */
export function setEnvironmentGeometryOverride(_geometry: EnvironmentGeometry): void {
  /* no-op: localStorage overrides caused cliff/flow to snap back after export */
}

/** Clears legacy browser override from older builds. */
export function clearEnvironmentGeometryOverride(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem('sleeping-ducks-env-geometry');
}

export function exportEnvironmentGeometryJson(geometry: EnvironmentGeometry): string {
  return JSON.stringify(geometry, null, 2);
}
