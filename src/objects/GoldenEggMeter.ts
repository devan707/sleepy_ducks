import Phaser from 'phaser';

const EGG_W = 22;
const EGG_H = 28;
const INSET = 3;
const INNER_W = EGG_W - INSET * 2;
const INNER_H = EGG_H - INSET * 2;
const OUTLINE = 0xc9a020;
const OUTLINE_BRIGHT = 0xffd54a;
const FILL = 0xffd54a;
const FILL_HI = 0xffec8a;
const GLINT = 0xfff4a8;
const EMPTY_FILL = 0xffffff;

/** Visual state: empty outline → half gold → full gold → reward → empty. */
export type GoldenEggMeterState = 'empty' | 'half' | 'full';

/** Golden egg progress meter — sits below the life hearts. */
export class GoldenEggMeter {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container;
  private fill: Phaser.GameObjects.Graphics;
  private shell: Phaser.GameObjects.Graphics;
  private glint: Phaser.GameObjects.Ellipse;
  private state: GoldenEggMeterState = 'empty';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.root = scene.add.container(x, y);

    this.fill = scene.add.graphics();
    this.shell = scene.add.graphics();
    this.glint = scene.add.ellipse(-4, -EGG_H * 0.22, 5, 7, GLINT, 0.55);

    // Fill under outline so the stroke stays crisp on top.
    this.root.add([this.fill, this.shell, this.glint]);
    this.setState('empty');
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.root;
  }

  getState(): GoldenEggMeterState {
    return this.state;
  }

  setState(state: GoldenEggMeterState): void {
    this.state = state;
    this.redrawFill(state);
    this.drawShell(state);
    this.glint.setVisible(state !== 'empty');
    this.glint.setAlpha(state === 'full' ? 0.9 : 0.5);
  }

  /** Map golden save count (0, 1, 2) to meter state. */
  setProgress(saves: number): void {
    if (saves >= 2) this.setState('full');
    else if (saves >= 1) this.setState('half');
    else this.setState('empty');
  }

  /** Brief pop when the egg becomes full (reward sequence). */
  pulseFull(): void {
    this.scene.tweens.add({
      targets: this.root,
      scaleX: 1.18,
      scaleY: 1.18,
      duration: 120,
      yoyo: true,
      ease: 'Back.easeOut',
    });
  }

  private redrawFill(state: GoldenEggMeterState): void {
    const g = this.fill;
    g.clear();

    if (state === 'empty') {
      g.fillStyle(EMPTY_FILL, 1);
      g.fillEllipse(0, 0, INNER_W, INNER_H);
      return;
    }

    if (state === 'full') {
      g.fillStyle(FILL, 1);
      g.fillEllipse(0, 0, INNER_W, INNER_H);
      g.fillStyle(FILL_HI, 0.55);
      g.fillEllipse(-2, -INNER_H * 0.18, INNER_W * 0.42, INNER_H * 0.38);
      return;
    }

    // Half — gold fills the bottom half of the egg interior.
    const halfH = INNER_H / 2;
    const centerY = INNER_H / 4;
    g.fillStyle(FILL, 1);
    g.fillEllipse(0, centerY, INNER_W, halfH + 1);
    g.fillStyle(FILL_HI, 0.55);
    g.fillEllipse(-2, centerY - halfH * 0.15, INNER_W * 0.42, halfH * 0.45);
  }

  /** Golden egg outline on top of any fill. */
  private drawShell(state: GoldenEggMeterState): void {
    const g = this.shell;
    g.clear();

    const full = state === 'full';
    g.lineStyle(2.5, full ? OUTLINE_BRIGHT : OUTLINE, 1);
    g.strokeEllipse(0, 0, EGG_W, EGG_H);
    g.lineStyle(1, OUTLINE_BRIGHT, full ? 0.55 : state === 'half' ? 0.4 : 0.3);
    g.strokeEllipse(0, -1, EGG_W - 3, EGG_H - 4);
  }

  destroy(): void {
    this.root.destroy();
  }
}
