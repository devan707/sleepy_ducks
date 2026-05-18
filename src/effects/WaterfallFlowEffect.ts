import Phaser from 'phaser';
import { ENV_ATLASES, ENV_KEYS } from '../config/environmentAssets';
import {
  computeDefaultFlowLayer1,
  getFlowLayerConfig,
  type FlowLayerConfig,
} from '../config/environmentGeometry';
import {
  FLOW_LOOP_OVERLAY_ALPHA,
  FLOW_LOOP_LAYERS,
  FLOW_LOOP_START_DELAY_SEC,
  GAME_HEIGHT,
  GAME_WIDTH,
  STAGE,
} from '../config/gameConfig';
import { getFlow1AnimKey } from '../assets/EnvironmentAnimations';
import { createFlowBitmapMask } from '../objects/EnvironmentLayout';

const FALLBACK_TILE_KEY = 'water-flow-tile-fallback';
const FALLBACK_SCROLL_SPEED = 120;

export type FlowLayerUpdateHandler = (layerId: number, config: FlowLayerConfig) => void;

/**
 * Masked waterfall_flow_1 atlas (per-sprite mask, not container mask).
 * Extra copies sit on top of the first at the same transform; playback starts later.
 */
export class WaterfallFlowEffect {
  private scene: Phaser.Scene;
  private flowContainer!: Phaser.GameObjects.Container;
  private mask!: Phaser.Display.Masks.BitmapMask;
  private flowSprites: Phaser.GameObjects.Sprite[] = [];
  private tileFallback: Phaser.GameObjects.TileSprite | null = null;
  private scrollY = 0;
  private layerConfig!: FlowLayerConfig;
  private onLayerUpdate: FlowLayerUpdateHandler | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.mask = createFlowBitmapMask(scene);
    this.layerConfig = getFlowLayerConfig(1, scene);

    this.flowContainer = this.scene.add.container(0, 0);
    this.flowContainer.setDepth(STAGE.depthWaterfallFlow);

    if (this.scene.textures.exists(ENV_KEYS.waterfallFlow1)) {
      this.createAtlasFlow();
    } else {
      this.createTileFallback();
    }
  }

  setOnLayerUpdate(handler: FlowLayerUpdateHandler | null): void {
    this.onLayerUpdate = handler;
  }

  getLayerConfig(): FlowLayerConfig {
    return { ...this.layerConfig };
  }

  applyLayerConfig(config: FlowLayerConfig): void {
    this.layerConfig = { ...config };
    for (let i = 0; i < this.flowSprites.length; i++) {
      this.applyTransform(
        this.flowSprites[i],
        this.layerConfig,
        this.getCopyAlpha(this.layerConfig, i),
      );
    }
    if (this.tileFallback) {
      this.tileFallback.setPosition(this.layerConfig.x, this.layerConfig.y);
      this.tileFallback.setScale(this.layerConfig.scaleX, this.layerConfig.scaleY);
      this.tileFallback.setAlpha(this.layerConfig.alpha);
    }
    this.onLayerUpdate?.(config.id, this.layerConfig);
  }

  update(_time: number, delta: number): void {
    if (!this.tileFallback) return;
    this.scrollY += FALLBACK_SCROLL_SPEED * (delta / 1000);
    this.tileFallback.tilePositionY = this.scrollY;
  }

  destroy(): void {
    this.flowContainer?.destroy();
  }

  private createAtlasFlow(): void {
    const animKey = getFlow1AnimKey();
    const entry = ENV_ATLASES[0];
    const frameRate = entry?.frameRate ?? 10;
    const frameCount = this.getFlowFrameCount();
    const delayFrames =
      frameCount > 0
        ? Math.round(FLOW_LOOP_START_DELAY_SEC * frameRate) % frameCount
        : 0;

    this.flowSprites = [];
    for (let i = 0; i < FLOW_LOOP_LAYERS; i++) {
      const sprite = this.scene.add.sprite(
        this.layerConfig.x,
        this.layerConfig.y,
        ENV_KEYS.waterfallFlow1,
      );
      this.applyTransform(sprite, this.layerConfig, this.getCopyAlpha(this.layerConfig, i));
      sprite.setMask(this.mask);

      if (this.scene.anims.exists(animKey)) {
        const startFrame = i === 0 ? 0 : delayFrames;
        sprite.play({ key: animKey, startFrame, repeat: -1 });
      }

      this.flowContainer.add(sprite);
      this.flowSprites.push(sprite);
    }
  }

  private createTileFallback(): void {
    this.ensureFallbackTile();
    this.layerConfig = computeDefaultFlowLayer1(this.scene);
    this.tileFallback = this.scene.add.tileSprite(
      this.layerConfig.x,
      this.layerConfig.y,
      GAME_WIDTH * 0.6,
      GAME_HEIGHT * 0.65,
      FALLBACK_TILE_KEY,
    );
    this.tileFallback.setOrigin(this.layerConfig.originX, this.layerConfig.originY);
    this.tileFallback.setAlpha(this.layerConfig.alpha);
    this.tileFallback.setMask(this.mask);
    this.flowContainer.add(this.tileFallback);
  }

  private getFlowFrameCount(): number {
    if (!this.scene.textures.exists(ENV_KEYS.waterfallFlow1)) return 16;
    return this.scene.textures
      .get(ENV_KEYS.waterfallFlow1)
      .getFrameNames()
      .filter((n) => n.startsWith('frame_'))
      .length;
  }

  /** Bottom copy: full opacity; overlays: semi-transparent to soften the loop seam. */
  private getCopyAlpha(cfg: FlowLayerConfig, copyIndex: number): number {
    if (copyIndex === 0) return cfg.alpha;
    return cfg.alpha * FLOW_LOOP_OVERLAY_ALPHA;
  }

  private applyTransform(
    sprite: Phaser.GameObjects.Sprite,
    cfg: FlowLayerConfig,
    alpha: number,
  ): void {
    sprite.setPosition(cfg.x, cfg.y);
    sprite.setScale(cfg.scaleX, cfg.scaleY);
    sprite.setOrigin(cfg.originX, cfg.originY);
    sprite.setAlpha(alpha);
    sprite.setBlendMode(Phaser.BlendModes.NORMAL);
  }

  private ensureFallbackTile(): void {
    if (this.scene.textures.exists(FALLBACK_TILE_KEY)) return;
    const w = 64;
    const h = 256;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillGradientStyle(0x4eb8e8, 0x4eb8e8, 0x4eb8e8, 0x4eb8e8, 0.5, 0.5, 0.05, 0.05);
    g.fillRect(0, 0, w, h);
    g.generateTexture(FALLBACK_TILE_KEY, w, h);
    g.destroy();
  }
}
