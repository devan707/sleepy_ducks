import Phaser from 'phaser';
import {
  ASSET_KEYS,
  type AssetKey,
  type AssetManifestEntry,
} from '../config/assets';
import { ENV_KEYS, ENV_DESIGN } from '../config/environmentAssets';
import { getEnvironmentGeometry } from '../config/environmentGeometry';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, STAGE } from '../config/gameConfig';
import { getLipYDesign } from '../objects/EnvironmentLayout';

const fallbackKeys = new Set<string>();

export class FallbackTextures {
  private static tagAsFallback(key: string): void {
    fallbackKeys.add(key);
  }

  static clearFallbackTags(): void {
    fallbackKeys.clear();
  }

  static isFallback(key: string): boolean {
    return fallbackKeys.has(key);
  }

  static generateAll(scene: Phaser.Scene, missing: AssetKey[]): void {
    const set = new Set(missing);
    for (const key of set) {
      switch (key) {
        case ENV_KEYS.bgCliffs:
          this.createCliffsFallback(scene);
          break;
        case ENV_KEYS.foregroundRocks:
          this.createForegroundFallback(scene);
          break;
        case ENV_KEYS.leftCliff:
          this.createLeftCliffFallback(scene);
          break;
        case ENV_KEYS.sun:
          this.createSunFallback(scene);
          break;
        case ENV_KEYS.waterChannelMask:
          this.createWaterChannelMaskFallback(scene);
          break;
        case ENV_KEYS.waterfallFlowTile:
          this.createWaterfallFlowTileFallback(scene);
          break;
        case ENV_KEYS.waterfallFlow1:
          this.createFlowAtlasFallback(scene, ENV_KEYS.waterfallFlow1, 6);
          break;
        case ASSET_KEYS.atlasDuckSleep:
          this.createDuckAtlasFallback(scene, ASSET_KEYS.atlasDuckSleep, 4);
          break;
        case ASSET_KEYS.atlasDuckWake:
          this.createDuckAtlasFallback(scene, ASSET_KEYS.atlasDuckWake, 4);
          break;
        case ASSET_KEYS.atlasDuckFly:
          this.createDuckAtlasFallback(scene, ASSET_KEYS.atlasDuckFly, 4);
          break;
        case ASSET_KEYS.femaleAsleep:
        case ASSET_KEYS.maleDeepSleep:
        case ASSET_KEYS.femaleDeepSleep:
          this.createStaticDuckFallback(scene, key);
          break;
        case ASSET_KEYS.decoy:
          this.createDecoyFallback(scene);
          break;
        case ASSET_KEYS.atlasFemaleWake:
          this.createDuckAtlasFallback(scene, ASSET_KEYS.atlasFemaleWake, 4);
          break;
        case ASSET_KEYS.atlasFemaleFly:
          this.createDuckAtlasFallback(scene, ASSET_KEYS.atlasFemaleFly, 4);
          break;
        case ASSET_KEYS.goldenSleep:
          this.createStaticDuckFallback(scene, ASSET_KEYS.goldenSleep);
          break;
        case ASSET_KEYS.atlasGoldenWake:
          this.createDuckAtlasFallback(scene, ASSET_KEYS.atlasGoldenWake, 4);
          break;
        case ASSET_KEYS.atlasGoldenFly:
          this.createDuckAtlasFallback(scene, ASSET_KEYS.atlasGoldenFly, 4);
          break;
        case ASSET_KEYS.atlasBalloon:
        case ASSET_KEYS.atlasBalloonPop:
          this.createDuckAtlasFallback(scene, key, 4);
          break;
        case ASSET_KEYS.fxMist:
          this.createParticleTexture(scene, ASSET_KEYS.fxMist, COLORS.mist, 48, 48);
          break;
        case ASSET_KEYS.fxSplash:
          this.createParticleTexture(scene, ASSET_KEYS.fxSplash, COLORS.waterLight, 40, 40);
          break;
        case ASSET_KEYS.uiHeart:
          this.createHeart(scene);
          break;
        case ASSET_KEYS.homeWaterfall:
          this.createMenuWaterfallFallback(scene);
          break;
        case ASSET_KEYS.titleLogo:
          this.createTitleLogoFallback(scene);
          break;
        case ASSET_KEYS.gameOverBanner:
          this.createGameOverBannerFallback(scene);
          break;
        case ASSET_KEYS.uiGear:
          this.createGearIconFallback(scene);
          break;
        case ASSET_KEYS.uiPlay:
        case ASSET_KEYS.uiRetry:
          this.createStaticDuckFallback(scene, key);
          break;
        case ASSET_KEYS.atlasMoonflowerSprout:
        case ASSET_KEYS.atlasMoonflowerBloom:
        case ASSET_KEYS.atlasMoonflowerSway:
          this.createMoonflowerAtlasFallback(scene, key, 4);
          break;
        case ASSET_KEYS.charmBox:
          this.createCharmBoxFallback(scene);
          break;
        default:
          break;
      }
    }
  }

  static ensureEntry(scene: Phaser.Scene, entry: AssetManifestEntry): void {
    if (scene.textures.exists(entry.key)) return;
    this.generateAll(scene, [entry.key]);
  }

  private static createCliffsFallback(scene: Phaser.Scene): void {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillGradientStyle(
      COLORS.skyTop,
      COLORS.skyTop,
      COLORS.skyBottom,
      COLORS.skyBottom,
      1,
    );
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(COLORS.cliffDark, 1);
    const lipMid = getLipYDesign(ENV_DESIGN.width / 2) * (GAME_HEIGHT / ENV_DESIGN.height);
    g.fillRect(0, lipMid - 20, GAME_WIDTH, 40);
    g.generateTexture(ENV_KEYS.bgCliffs, GAME_WIDTH, GAME_HEIGHT);
    g.destroy();
    this.tagAsFallback(ENV_KEYS.bgCliffs);
  }

  private static createSunFallback(scene: Phaser.Scene): void {
    const size = 128;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffe066, 1);
    g.fillCircle(size / 2, size / 2, size * 0.38);
    g.fillStyle(0xfff4c8, 0.55);
    g.fillCircle(size / 2, size / 2, size * 0.28);
    g.generateTexture(ENV_KEYS.sun, size, size);
    g.destroy();
    this.tagAsFallback(ENV_KEYS.sun);
  }

  private static createLeftCliffFallback(scene: Phaser.Scene): void {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(COLORS.rockDark, 1);
    g.fillRoundedRect(0, 0, 120, 520, 12);
    g.generateTexture(ENV_KEYS.leftCliff, 120, 520);
    g.destroy();
    this.tagAsFallback(ENV_KEYS.leftCliff);
  }

  private static createForegroundFallback(scene: Phaser.Scene): void {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(COLORS.rockDark, 0.85);
    const { lipLeft, lipRight } = getEnvironmentGeometry();
    const lipL = getLipYDesign(lipLeft.x) * (GAME_HEIGHT / ENV_DESIGN.height);
    const lipR = getLipYDesign(lipRight.x) * (GAME_HEIGHT / ENV_DESIGN.height);
    const rockTop = Math.max(lipL, lipR) + 40;
    g.fillRoundedRect(0, rockTop, 90, 440, 10);
    g.fillRoundedRect(GAME_WIDTH - 90, rockTop, 90, 440, 10);
    g.fillStyle(COLORS.mist, 0.35);
    g.fillRect(0, STAGE.mistZoneTop, GAME_WIDTH, GAME_HEIGHT - STAGE.mistZoneTop);
    g.generateTexture(ENV_KEYS.foregroundRocks, GAME_WIDTH, GAME_HEIGHT);
    g.destroy();
    this.tagAsFallback(ENV_KEYS.foregroundRocks);
  }

  private static createFlowAtlasFallback(
    scene: Phaser.Scene,
    key: AssetKey,
    frameCount: number,
  ): void {
    const fw = 96;
    const fh = 172;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    for (let f = 0; f < frameCount; f++) {
      const ox = f * fw;
      g.fillStyle(COLORS.waterMid, 0.5 + (f % 3) * 0.1);
      g.fillRect(ox + 8, 0, fw - 16, fh);
      g.fillStyle(COLORS.waterLight, 0.35);
      g.fillRect(ox + fw / 2 - 6, 20, 12, fh - 40);
    }
    g.generateTexture(key, fw * frameCount, fh);
    g.destroy();
    const tex = scene.textures.get(key);
    for (let i = 0; i < frameCount; i++) {
      tex.add(`frame_${String(i).padStart(3, '0')}`, 0, i * fw, 0, fw, fh);
    }
    this.tagAsFallback(key);
  }

  private static createWaterfallFlowTileFallback(scene: Phaser.Scene): void {
    const w = 64;
    const h = 256;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillGradientStyle(
      COLORS.waterMid,
      COLORS.waterMid,
      COLORS.waterMid,
      COLORS.waterMid,
      0.45,
      0.45,
      0.05,
      0.05,
    );
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 12; i++) {
      const x = Phaser.Math.Between(4, w - 10);
      g.fillStyle(COLORS.waterLight, Phaser.Math.FloatBetween(0.2, 0.5));
      g.fillRect(x, 0, Phaser.Math.Between(2, 6), h);
    }
    g.generateTexture(ENV_KEYS.waterfallFlowTile, w, h);
    g.destroy();
    this.tagAsFallback(ENV_KEYS.waterfallFlowTile);
  }

  private static createWaterChannelMaskFallback(scene: Phaser.Scene): void {
    const w = ENV_DESIGN.width;
    const h = ENV_DESIGN.height;
    const { lipLeft, lipRight } = getEnvironmentGeometry();
    const centerX = 390;
    const bottomY = 1445;
    const bottomHalfWidth = 242;

    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x000000, 1);
    g.fillRect(0, 0, w, h);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(
      lipLeft.x,
      lipLeft.y,
      lipRight.x,
      lipRight.y,
      centerX + bottomHalfWidth,
      bottomY,
    );
    g.fillTriangle(
      lipLeft.x,
      lipLeft.y,
      centerX - bottomHalfWidth,
      bottomY,
      lipRight.x,
      lipRight.y,
    );
    g.generateTexture(ENV_KEYS.waterChannelMask, w, h);
    g.destroy();
    this.tagAsFallback(ENV_KEYS.waterChannelMask);
  }

  private static createStaticDuckFallback(scene: Phaser.Scene, key: AssetKey): void {
    const w = 128;
    const h = 128;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(COLORS.duckBody, 1);
    g.fillEllipse(w / 2, h / 2 + 6, w * 0.72, h * 0.55);
    g.generateTexture(key, w, h);
    g.destroy();
    this.tagAsFallback(key);
  }

  private static createDecoyFallback(scene: Phaser.Scene): void {
    const w = 128;
    const h = 128;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x884444, 1);
    g.fillEllipse(w / 2, h / 2 + 6, w * 0.72, h * 0.55);
    g.generateTexture(ASSET_KEYS.decoy, w, h);
    g.destroy();
    this.tagAsFallback(ASSET_KEYS.decoy);
  }

  private static createDuckAtlasFallback(
    scene: Phaser.Scene,
    key: AssetKey,
    frameCount: number,
  ): void {
    const fw = 64;
    const fh = 64;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    for (let f = 0; f < frameCount; f++) {
      const ox = f * fw;
      g.fillStyle(COLORS.duckBody, 1);
      g.fillEllipse(ox + fw / 2, fh / 2 + 4, fw * 0.8, fh * 0.72);
    }
    g.generateTexture(key, fw * frameCount, fh);
    g.destroy();
    const tex = scene.textures.get(key);
    for (let i = 0; i < frameCount; i++) {
      tex.add(`frame_${String(i).padStart(3, '0')}`, 0, i * fw, 0, fw, fh);
    }
    this.tagAsFallback(key);
  }

  private static createParticleTexture(
    scene: Phaser.Scene,
    key: AssetKey,
    color: number,
    w: number,
    h: number,
  ): void {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(color, 0.5);
    g.fillCircle(w / 2, h / 2, w * 0.42);
    g.generateTexture(key, w, h);
    g.destroy();
    this.tagAsFallback(key);
  }

  private static createMenuWaterfallFallback(scene: Phaser.Scene): void {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillGradientStyle(
      COLORS.skyTop,
      COLORS.skyTop,
      COLORS.skyBottom,
      COLORS.skyBottom,
      1,
    );
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(COLORS.waterMid, 0.6);
    g.fillRect(GAME_WIDTH * 0.2, 0, GAME_WIDTH * 0.6, GAME_HEIGHT);
    g.generateTexture(ASSET_KEYS.homeWaterfall, GAME_WIDTH, GAME_HEIGHT);
    g.destroy();
    this.tagAsFallback(ASSET_KEYS.homeWaterfall);
  }

  private static createGameOverBannerFallback(scene: Phaser.Scene): void {
    const w = 320;
    const h = 120;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x2c3e50, 0.9);
    g.fillRoundedRect(0, 0, w, h, 12);
    g.generateTexture(ASSET_KEYS.gameOverBanner, w, h);
    g.destroy();
    this.tagAsFallback(ASSET_KEYS.gameOverBanner);
  }

  private static createTitleLogoFallback(scene: Phaser.Scene): void {
    const w = 320;
    const h = 200;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x2c3e50, 0.85);
    g.fillRoundedRect(0, 0, w, h, 16);
    g.generateTexture(ASSET_KEYS.titleLogo, w, h);
    g.destroy();
    this.tagAsFallback(ASSET_KEYS.titleLogo);
  }

  private static createGearIconFallback(scene: Phaser.Scene): void {
    const s = 64;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = s / 2;
    const cy = s / 2;
    const r = 24;
    g.fillStyle(0xffe566, 1);
    g.fillCircle(cx, cy, r * 0.5);
    g.lineStyle(3, 0xc97a1a, 1);
    g.strokeCircle(cx, cy, r * 0.5);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const tx = cx + Math.cos(a) * (r + 2);
      const ty = cy + Math.sin(a) * (r + 2);
      g.fillStyle(0xffe566, 1);
      g.fillCircle(tx, ty, 5);
    }
    g.generateTexture(ASSET_KEYS.uiGear, s, s);
    g.destroy();
    this.tagAsFallback(ASSET_KEYS.uiGear);
  }

  private static createHeart(scene: Phaser.Scene): void {
    const s = 28;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xe74c3c, 1);
    g.fillCircle(s * 0.35, s * 0.38, s * 0.22);
    g.fillCircle(s * 0.65, s * 0.38, s * 0.22);
    g.fillTriangle(s * 0.15, s * 0.45, s * 0.85, s * 0.45, s * 0.5, s * 0.92);
    g.generateTexture(ASSET_KEYS.uiHeart, s, s);
    g.destroy();
    this.tagAsFallback(ASSET_KEYS.uiHeart);
  }

  private static createMoonflowerAtlasFallback(
    scene: Phaser.Scene,
    key: AssetKey,
    frameCount: number,
  ): void {
    const fw = 64;
    const fh = 64;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    for (let f = 0; f < frameCount; f++) {
      const ox = f * fw;
      const cx = ox + fw / 2;
      const cy = fh / 2 + 4;
      g.fillStyle(0xa8e8ff, 0.35);
      g.fillCircle(cx, cy, fw * 0.42);
      g.fillStyle(0x6ec5e8, 1);
      g.fillEllipse(cx, cy, fw * 0.35, fh * 0.5);
      g.fillStyle(0xc8eef8, 1);
      g.fillCircle(cx, cy - 8, fw * 0.18);
    }
    g.generateTexture(key, fw * frameCount, fh);
    g.destroy();
    const tex = scene.textures.get(key);
    for (let i = 0; i < frameCount; i++) {
      tex.add(`frame_${String(i).padStart(3, '0')}`, 0, i * fw, 0, fw, fh);
    }
    this.tagAsFallback(key);
  }

  private static createCharmBoxFallback(scene: Phaser.Scene): void {
    const w = 340;
    const h = 88;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x1a3a4a, 0.92);
    g.fillRoundedRect(0, 0, w, h, 18);
    g.lineStyle(3, 0xa8e8ff, 0.7);
    g.strokeRoundedRect(2, 2, w - 4, h - 4, 16);
    for (let i = 0; i < 6; i++) {
      const sx = 18 + i * 52;
      g.fillStyle(0x0a1620, 0.55);
      g.fillCircle(sx + 20, h / 2, 18);
      g.lineStyle(2, 0xffffff, 0.25);
      g.strokeCircle(sx + 20, h / 2, 18);
    }
    g.generateTexture(ASSET_KEYS.charmBox, w, h);
    g.destroy();
    this.tagAsFallback(ASSET_KEYS.charmBox);
  }
}
