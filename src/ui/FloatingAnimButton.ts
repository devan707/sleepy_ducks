import Phaser from 'phaser';

export type FloatingAnimButtonOpts = {
  depth: number;
  /** Target width on screen (scales from texture; art is ~768px square with padding). */
  displayWidth?: number;
  interactive?: boolean;
  onClick?: () => void;
  /** If false, call playEntrance() to fade in and start the bob. */
  autoFloat?: boolean;
  /** Delay before the bob loop starts — staggers motion vs other buttons. */
  floatPhaseMs?: number;
};

const FLOAT_Y = 6;
const FLOAT_MS = 2400;

/** UI button image with a gentle vertical bob (static PNG or atlas loop). */
export class FloatingAnimButton {
  readonly root: Phaser.GameObjects.Container;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly baseY: number;
  private readonly floatPhaseMs: number;
  private floatTween: Phaser.Tweens.Tween | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    textureKey: string,
    animKey: string | null,
    opts: FloatingAnimButtonOpts,
  ) {
    this.baseY = y;
    this.floatPhaseMs = opts.floatPhaseMs ?? 0;

    this.sprite = scene.add.sprite(0, 0, textureKey);
    this.sprite.setOrigin(0.5);

    if (animKey && scene.anims.exists(animKey)) {
      this.sprite.anims.play({ key: animKey, repeat: -1 });
    }

    this.fitDisplaySize(opts.displayWidth);

    const children: Phaser.GameObjects.GameObject[] = [this.sprite];

    if (opts.interactive) {
      const hitW = this.sprite.displayWidth + 16;
      const hitH = this.sprite.displayHeight + 16;
      const hit = scene.add
        .rectangle(0, 0, hitW, hitH, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      children.push(hit);
      if (opts.onClick) {
        hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          pointer.event?.stopPropagation();
          opts.onClick!();
        });
      }
    }

    this.root = scene.add.container(x, y, children);
    this.root.setDepth(opts.depth).setScrollFactor(0);

    if (opts.autoFloat !== false) {
      this.startFloat(scene);
    }
  }

  private fitDisplaySize(targetWidth?: number): void {
    if (!targetWidth) return;
    const fw = this.sprite.width;
    const fh = this.sprite.height;
    if (fw <= 0) return;
    this.sprite.setDisplaySize(targetWidth, (fh / fw) * targetWidth);
  }

  getSprite(): Phaser.GameObjects.Sprite {
    return this.sprite;
  }

  setLoading(loading: boolean): void {
    this.sprite.setAlpha(loading ? 0.45 : 1);
    if (loading) {
      this.sprite.anims.pause();
    } else if (this.sprite.anims.isPlaying) {
      this.sprite.anims.resume();
    }
  }

  playEntrance(scene: Phaser.Scene, delay = 0): void {
    this.floatTween?.remove();
    this.root.setAlpha(0);
    this.root.y = this.baseY;

    scene.tweens.add({
      targets: this.root,
      alpha: 1,
      duration: 500,
      delay,
      ease: 'Sine.easeOut',
      onComplete: () => this.startFloat(scene),
    });
  }

  private startFloat(scene: Phaser.Scene): void {
    this.floatTween?.remove();
    this.root.y = this.baseY;
    this.floatTween = scene.tweens.add({
      targets: this.root,
      y: this.baseY - FLOAT_Y,
      duration: FLOAT_MS,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: this.floatPhaseMs,
    });
  }

  destroy(): void {
    this.floatTween?.remove();
    this.root.destroy();
  }
}
