import Phaser from 'phaser';

const FILL = 0xffe566;
const FILL_HIGHLIGHT = 0xfff4a8;
const STROKE = 0xc97a1a;
const HUB = 0x8b5a14;

/** Chunky cartoon gear drawn with Phaser graphics (theme-matched). */
export function createCartoonGearIcon(
  scene: Phaser.Scene,
  radius: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const teeth = 8;
  const innerR = radius * 0.38;
  const toothLen = radius * 0.32;
  const toothW = (Math.PI * 2) / teeth / 2.4;

  g.lineStyle(3, STROKE, 1);

  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2 - Math.PI / 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const ax = cos * (radius - toothLen * 0.15);
    const ay = sin * (radius - toothLen * 0.15);
    const bx = cos * (radius + toothLen);
    const by = sin * (radius + toothLen);
    const perp = a + Math.PI / 2;
    const hw = toothW * radius * 0.55;
    const px = Math.cos(perp) * hw;
    const py = Math.sin(perp) * hw;

    g.fillStyle(i % 2 === 0 ? FILL : FILL_HIGHLIGHT, 1);
    g.beginPath();
    g.moveTo(ax - px, ay - py);
    g.lineTo(bx - px * 0.7, by - py * 0.7);
    g.lineTo(bx + px * 0.7, by + py * 0.7);
    g.lineTo(ax + px, ay + py);
    g.closePath();
    g.fillPath();
    g.strokePath();
  }

  g.fillStyle(FILL, 1);
  g.fillCircle(0, 0, radius * 0.72);
  g.lineStyle(3, STROKE, 1);
  g.strokeCircle(0, 0, radius * 0.72);

  g.fillStyle(FILL_HIGHLIGHT, 0.55);
  g.fillEllipse(-radius * 0.12, -radius * 0.18, radius * 0.5, radius * 0.35);

  g.fillStyle(HUB, 1);
  g.fillCircle(0, 0, innerR);
  g.lineStyle(2.5, STROKE, 1);
  g.strokeCircle(0, 0, innerR);

  return g;
}
