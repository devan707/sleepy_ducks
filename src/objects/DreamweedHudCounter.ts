import Phaser from 'phaser';
import { DREAMWEED_STATIC_KEY } from '../config/dreamweedAssets';
import { STAGE } from '../config/gameConfig';
import { lilitaDisplayStyle } from '../ui/uiChrome';

const ICON_H = 28;
const FLY_DURATION_MS = 460;

/** Run HUD counter — hidden until the first dreamweed is collected this run. */
export class DreamweedHudCounter {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container;
  private icon: Phaser.GameObjects.Image;
  private countLabel: Phaser.GameObjects.Text;
  private runCount = 0;
  private displayW: number;
  private displayH: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.root = scene.add.container(x, y);

    this.icon = scene.add.image(0, 0, DREAMWEED_STATIC_KEY);
    this.icon.setOrigin(0.5);
    const frame = this.icon.frame;
    this.displayH = ICON_H;
    this.displayW = ICON_H * (frame.width / frame.height);
    this.icon.setDisplaySize(this.displayW, this.displayH);

    this.countLabel = scene.add
      .text(this.displayW * 0.42, 0, '0', lilitaDisplayStyle({
        fontSize: '16px',
        color: '#ecf8ff',
        stroke: '#1a0e08',
        strokeThickness: 3,
      }))
      .setOrigin(0, 0.5);

    this.root.add([this.icon, this.countLabel]);
    this.root.setVisible(false);
    this.setRunCount(0);
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.root;
  }

  getWorldCenter(): { x: number; y: number } {
    const out = new Phaser.Math.Vector2();
    this.root.getWorldTransformMatrix().transformPoint(0, 0, out);
    return { x: out.x, y: out.y };
  }

  /** Show the HUD slot after the first collect this run. */
  reveal(): void {
    if (this.root.visible) return;
    this.root.setVisible(true);
    this.root.setAlpha(0);
    this.scene.tweens.add({
      targets: this.root,
      alpha: 1,
      duration: 420,
      ease: 'Sine.easeOut',
    });
  }

  increment(): void {
    this.setRunCount(this.runCount + 1);
  }

  setRunCount(count: number): void {
    this.runCount = count;
    this.countLabel.setText(String(count));
    this.countLabel.setVisible(count > 0);
  }

  flyIntoPlace(fromX: number, fromY: number): void {
    const { x: targetX, y: targetY } = this.getWorldCenter();

    const flyer = this.scene.add.image(fromX, fromY, DREAMWEED_STATIC_KEY);
    flyer.setDepth(STAGE.hudDepth + 8);
    flyer.setScrollFactor(0);
    flyer.setOrigin(0.5);
    const startH = this.displayH * 1.1;
    const fit = startH / flyer.frame.height;
    flyer.setDisplaySize(flyer.frame.width * fit, startH);

    this.countLabel.setVisible(false);

    this.scene.tweens.add({
      targets: flyer,
      x: targetX,
      y: targetY,
      displayWidth: this.displayW,
      displayHeight: this.displayH,
      duration: FLY_DURATION_MS,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        flyer.destroy();
        this.increment();
      },
    });
  }

  destroy(): void {
    this.root.destroy();
  }
}
