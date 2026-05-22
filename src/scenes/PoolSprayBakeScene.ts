import Phaser from 'phaser';
import { GAME_WIDTH, POOL_SPRAY } from '../config/gameConfig';
import { POOL_SPRAY_BAKED } from '../config/poolSprayBake';
import { createFallsBaseMistEmitter } from '../effects/ParticleEffects';
import { PoolSprayWaves } from '../effects/PoolSprayWaves';
import {
  createFallsColumnMask,
  createLipPoolMask,
  resolveFallsPoolSprayLine,
} from '../objects/EnvironmentLayout';

export const POOL_SPRAY_BAKE_SCENE_KEY = 'PoolSprayBakeScene';

/**
 * Dev-only: capture desktop-quality pool spray into a spritesheet.
 * Open: `npm run dev` then `http://127.0.0.1:5173/?bakePoolSpray=1`
 */
export class PoolSprayBakeScene extends Phaser.Scene {
  private captureIndex = 0;
  private readonly frames: string[] = [];
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super(POOL_SPRAY_BAKE_SCENE_KEY);
  }

  create(): void {
    createFallsColumnMask(this);
    createLipPoolMask(this);

    const line = resolveFallsPoolSprayLine(this);
    const sprayY = line.y + POOL_SPRAY.yOffsetPx;
    const cfg = POOL_SPRAY_BAKED;
    const frameW = cfg.frameWidth;
    const frameH = cfg.frameHeight;

    const spray = new PoolSprayWaves(this, { forceLiveParticles: true });
    const mist = createFallsBaseMistEmitter(this);
    // No geometry mask during bake — mask would clip particles without full env art.

    this.cameras.main.setBackgroundColor('#0e1e28');

    this.statusText = this.add
      .text(
        GAME_WIDTH / 2,
        24,
        'Pool spray bake — warming up particles…',
        { fontFamily: 'system-ui', fontSize: '14px', color: '#aaf' },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);

    const rtX = line.centerX - frameW * 0.5;
    const rtY = sprayY - frameH * 0.5;
    const rt = this.add.renderTexture(rtX, rtY, frameW, frameH);
    rt.setOrigin(0, 0);
    rt.setDepth(500);

    this.add
      .rectangle(line.centerX, sprayY, frameW + 4, frameH + 4)
      .setStrokeStyle(1, 0x66ff88, 0.6)
      .setFillStyle(0x000000, 0)
      .setDepth(499);

    const emitters = [...spray.getLiveCaptureEmitters(), mist];

    this.time.delayedCall(1500, () => {
      this.statusText.setText('Capturing…');
      this.scheduleCapture(rt, emitters, cfg, () => {
        this.downloadResults(cfg, spray, mist);
      });
    });
  }

  private scheduleCapture(
    rt: Phaser.GameObjects.RenderTexture,
    emitters: Phaser.GameObjects.Particles.ParticleEmitter[],
    cfg: typeof POOL_SPRAY_BAKED,
    onDone: () => void,
  ): void {
    const stepMs = Math.round(1000 / cfg.frameRate);

    const tick = (): void => {
      if (this.captureIndex >= cfg.frameCount) {
        onDone();
        return;
      }
      this.captureFrame(rt, emitters);
      this.captureIndex += 1;
      this.statusText.setText(`Capturing… ${this.captureIndex}/${cfg.frameCount}`);
      this.time.delayedCall(stepMs, tick);
    };

    tick();
  }

  private captureFrame(
    rt: Phaser.GameObjects.RenderTexture,
    emitters: Phaser.GameObjects.Particles.ParticleEmitter[],
  ): void {
    rt.clear();

    for (const emitter of emitters) {
      if (!emitter.active) continue;
      rt.draw(emitter, emitter.x - rt.x, emitter.y - rt.y);
    }

    rt.snapshot((snapshot) => {
      if (snapshot instanceof HTMLImageElement && snapshot.src) {
        this.frames.push(snapshot.src);
      }
    });
  }

  private downloadResults(
    cfg: typeof POOL_SPRAY_BAKED,
    spray: PoolSprayWaves,
    mist: Phaser.GameObjects.Particles.ParticleEmitter,
  ): void {
    spray.destroy();
    mist.destroy();

    const fw = cfg.frameWidth;
    const fh = cfg.frameHeight;
    const strip = document.createElement('canvas');
    strip.width = fw * cfg.frameCount;
    strip.height = fh;
    const ctx = strip.getContext('2d');
    if (!ctx) return;

    let loaded = 0;
    const onAllLoaded = (): void => {
      this.triggerDownload(strip.toDataURL('image/png'), 'pool_spray_baked.png');

      const jsonBlob = new Blob([JSON.stringify(this.buildAtlasJson(cfg), null, 2)], {
        type: 'application/json',
      });
      this.triggerDownload(URL.createObjectURL(jsonBlob), 'pool_spray_baked.json');

      this.statusText.setText(
        'Done — check Downloads.\nCopy both files to public/assets/effects/\nThen open the game WITHOUT ?bakePoolSpray=1',
      );
    };

    if (this.frames.length === 0) {
      this.statusText.setText('Capture failed (0 frames). Reload and try again.');
      return;
    }

    for (let i = 0; i < this.frames.length; i++) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, i * fw, 0, fw, fh);
        loaded += 1;
        if (loaded === this.frames.length) onAllLoaded();
      };
      img.onerror = () => {
        loaded += 1;
        if (loaded === this.frames.length) onAllLoaded();
      };
      img.src = this.frames[i];
    }
  }

  private buildAtlasJson(cfg: typeof POOL_SPRAY_BAKED): object {
    const frames: Record<string, object> = {};
    for (let i = 0; i < cfg.frameCount; i++) {
      const name = `frame_${String(i).padStart(2, '0')}`;
      frames[name] = {
        frame: { x: i * cfg.frameWidth, y: 0, w: cfg.frameWidth, h: cfg.frameHeight },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: cfg.frameWidth, h: cfg.frameHeight },
        sourceSize: { w: cfg.frameWidth, h: cfg.frameHeight },
      };
    }
    return {
      frames,
      meta: {
        app: 'Sleepy Ducks pool spray bake',
        version: '1.0',
        image: 'pool_spray_baked.png',
        format: 'RGBA8888',
        size: { w: cfg.frameWidth * cfg.frameCount, h: cfg.frameHeight },
        scale: '1',
      },
    };
  }

  private triggerDownload(href: string, filename: string): void {
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    a.click();
  }
}
