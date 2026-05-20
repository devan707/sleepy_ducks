import Phaser from 'phaser';
import type { SoundManager } from '../audio/SoundManager';
import { GAME_HEIGHT, GAME_WIDTH, HUD_LAYOUT, STAGE } from '../config/gameConfig';

const DEFAULT_RADIUS = 18;

export type SoundToggleOptions = {
  radius?: number;
  x?: number;
  y?: number;
};

export class SoundToggle {
  private static suppressScenePointer = false;

  /** Returns true once if the sound button just handled this pointer. */
  static consumeSceneSuppress(): boolean {
    if (!SoundToggle.suppressScenePointer) return false;
    SoundToggle.suppressScenePointer = false;
    return true;
  }

  static resetSuppress(): void {
    SoundToggle.suppressScenePointer = false;
  }

  private scene: Phaser.Scene;
  private manager: SoundManager;
  private container: Phaser.GameObjects.Container;
  private icon: Phaser.GameObjects.Text;
  private readonly radius: number;

  constructor(
    scene: Phaser.Scene,
    manager: SoundManager,
    opts?: SoundToggleOptions,
  ) {
    this.scene = scene;
    this.manager = manager;
    this.radius = opts?.radius ?? DEFAULT_RADIUS;

    const x =
      opts?.x ??
      GAME_WIDTH - HUD_LAYOUT.marginRight - this.radius;
    const y =
      opts?.y ??
      GAME_HEIGHT - HUD_LAYOUT.marginBottom - this.radius;

    const bg = scene.add.graphics();
    bg.fillStyle(0x0a2230, 0.78);
    bg.fillCircle(0, 0, this.radius);
    bg.lineStyle(1.5, 0xffffff, 0.2);
    bg.strokeCircle(0, 0, this.radius);

    this.icon = scene.add
      .text(0, 0, '', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: `${Math.round(this.radius * 0.95)}px`,
        stroke: '#0a1620',
        strokeThickness: 3,
        shadow: {
          offsetX: 1,
          offsetY: 1,
          color: '#000000',
          blur: 1,
          stroke: true,
          fill: true,
        },
      })
      .setOrigin(0.5);

    const hit = scene.add
      .circle(0, 0, this.radius, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });

    this.container = scene.add.container(x, y, [bg, this.icon, hit]);
    this.container.setDepth(STAGE.hudDepth + 2).setScrollFactor(0);

    hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation();
      SoundToggle.suppressScenePointer = true;
      this.toggle();
    });

    this.refresh();
  }

  private toggle(): void {
    const next = !this.manager.isSfxEnabled();
    this.manager.setSfxEnabled(next);
    this.refresh();
    if (next) {
      this.manager.tryUnlock();
      this.manager.play('tap');
    }
  }

  private refresh(): void {
    this.icon.setText(this.manager.isSfxEnabled() ? '🔊' : '🔇');
    this.icon.setAlpha(this.manager.isSfxEnabled() ? 1 : 0.55);
  }

  destroy(): void {
    this.container.destroy();
    void this.scene;
  }
}
