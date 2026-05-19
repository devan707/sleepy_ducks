import Phaser from 'phaser';
import { comboMultiplier } from '../scoring/runScore';
import {
  COMBO_UI,
  GAME_WIDTH,
  STAGE,
} from '../config/gameConfig';
import { arcadeHudTextStyle, captionTextStyle } from '../ui/uiChrome';

const TIMER_TRACK = 0x143040;
const TIMER_FILL = 0xffd966;
const TIMER_WARN = 0xff7a55;
const TRACK_ALPHA = 0.52;
const FILL_ALPHA = 0.42;
const WARN_ALPHA = 0.48;

export class ComboCounter {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container;
  private panel: Phaser.GameObjects.Graphics;
  private labelText: Phaser.GameObjects.Text;
  private valueText: Phaser.GameObjects.Text;
  private multText: Phaser.GameObjects.Text;
  private combo = 0;
  private visible = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const { height: h } = COMBO_UI;

    this.root = scene.add.container(GAME_WIDTH / 2, COMBO_UI.y);
    this.root.setScrollFactor(0).setDepth(STAGE.depthComboHud).setAlpha(0).setScale(0.9);

    this.panel = scene.add.graphics();
    this.labelText = scene.add
      .text(0, -h * 0.32, 'COMBO', captionTextStyle({
        fontSize: `${Math.round(h * 0.145)}px`,
        letterSpacing: 4,
        color: '#fff8d0',
      }))
      .setOrigin(0.5);
    this.valueText = scene.add
      .text(
        0,
        h * 0.02,
        '0',
        arcadeHudTextStyle({
          fontSize: `${Math.round(h * 0.52)}px`,
          color: '#fffef0',
          stroke: '#6a4808',
          strokeThickness: 6,
        }),
      )
      .setOrigin(0.5);
    this.multText = scene.add
      .text(
        0,
        h * 0.34,
        '',
        arcadeHudTextStyle({
          fontSize: `${Math.round(h * 0.17)}px`,
          color: '#ffdd55',
          stroke: '#5a3d08',
          strokeThickness: 4,
        }),
      )
      .setOrigin(0.5);

    this.root.add([this.panel, this.labelText, this.valueText, this.multText]);
    this.redrawMeter(1);
  }

  setCombo(combo: number): void {
    if (combo <= 1) {
      this.hide();
      return;
    }

    const grew = combo > this.combo;
    this.combo = combo;
    this.valueText.setText(String(combo));
    this.multText.setText(this.formatMultiplier(combo));

    if (!this.visible) {
      this.show();
    } else if (grew) {
      this.pulseOnIncrease();
    }
  }

  /** @param timeLeft01 1 = full window left, 0 = about to break */
  updateTimer(timeLeft01: number): void {
    if (!this.visible || this.combo <= 1) return;
    this.redrawMeter(Phaser.Math.Clamp(timeLeft01, 0, 1));
  }

  getWorldCenter(): { x: number; y: number } {
    const out = new Phaser.Math.Vector2();
    this.root.getWorldTransformMatrix().transformPoint(0, 0, out);
    return { x: out.x, y: out.y };
  }

  /** Rewarding pop when the meter starts or a milestone is hit. */
  celebrate(kind: 'start' | 'milestone', tier = 0): void {
    const intensity = kind === 'start' ? 1 : 1.08 + tier * 0.12;
    const popScale = kind === 'start' ? 1.1 : 1.12 + tier * 0.06;

    this.scene.tweens.killTweensOf(this.root);
    this.scene.tweens.killTweensOf(this.valueText);
    if (this.visible) {
      // show() may still be fading in — don't leave alpha at 0 after killing that tween.
      this.root.setAlpha(1);
    }
    this.root.setScale(1);
    this.valueText.setScale(1);

    this.scene.tweens.add({
      targets: this.root,
      scaleX: popScale,
      scaleY: popScale,
      duration: kind === 'start' ? 160 : 130 + tier * 25,
      yoyo: true,
      ease: 'Back.easeOut',
    });

    this.scene.tweens.add({
      targets: this.valueText,
      scaleX: intensity * 1.2,
      scaleY: intensity * 1.2,
      duration: 140 + tier * 20,
      yoyo: true,
      ease: 'Back.easeOut',
    });

    this.spawnRingBurst(kind === 'start' ? 0 : tier + 1);
    if (kind === 'milestone' && tier >= 2) {
      this.spawnRingBurst(tier + 2, 90);
    }
    if (tier >= 4) {
      this.jiggleRoot();
    }
  }

  destroy(): void {
    this.root.destroy();
  }

  private formatMultiplier(combo: number): string {
    const mult = comboMultiplier(combo);
    return mult > 1 ? `×${mult.toFixed(1)} combo` : '';
  }

  private show(): void {
    this.visible = true;
    this.scene.tweens.killTweensOf(this.root);
    this.root.setScale(0.85);
    this.scene.tweens.add({
      targets: this.root,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });
    this.redrawMeter(1);
  }

  private hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.combo = 0;
    this.scene.tweens.killTweensOf(this.root);
    this.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      scaleX: 0.88,
      scaleY: 0.88,
      duration: 280,
      ease: 'Quad.easeIn',
    });
  }

  private pulseOnIncrease(): void {
    this.scene.tweens.killTweensOf(this.valueText);
    this.valueText.setScale(1);
    this.scene.tweens.add({
      targets: this.valueText,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 100,
      yoyo: true,
      ease: 'Back.easeOut',
    });

    this.scene.tweens.killTweensOf(this.root);
    this.root.setScale(1);
    this.scene.tweens.add({
      targets: this.root,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 90,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  /** Full-panel background acts as the combo timer meter. */
  private redrawMeter(timeLeft01: number): void {
    drawComboPanelMeter(this.panel, timeLeft01);
  }

  private spawnRingBurst(strength: number, delayMs = 0): void {
    const colors = [0xffeeaa, 0xffdd66, 0xffcc44, 0xffaa33, 0xff8833, 0xff6622];
    const color = colors[Math.min(strength, colors.length - 1)];
    const baseRadius = COMBO_UI.width * (0.22 + strength * 0.04);

    this.scene.time.delayedCall(delayMs, () => {
      const ring = this.scene.add.graphics();
      ring.lineStyle(2 + strength * 0.6, color, 0.85);
      ring.strokeCircle(0, 0, baseRadius);
      this.root.add(ring);

      this.scene.tweens.add({
        targets: ring,
        alpha: 0,
        scaleX: 1.55 + strength * 0.12,
        scaleY: 1.55 + strength * 0.12,
        duration: 320 + strength * 40,
        ease: 'Cubic.easeOut',
        onComplete: () => ring.destroy(),
      });
    });
  }

  private jiggleRoot(): void {
    const baseX = this.root.x;
    this.scene.tweens.add({
      targets: this.root,
      x: baseX + 5,
      duration: 45,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.root.x = baseX;
      },
    });
  }
}
/** Shared draw for in-game combo panel and rules preview. */
export function drawComboPanelMeter(
  g: Phaser.GameObjects.Graphics,
  timeLeft01: number,
): void {
  const { width: w, height: h, radius: r } = COMBO_UI;
  const x = -w / 2;
  const y = -h / 2;
  g.clear();

  g.fillStyle(TIMER_TRACK, TRACK_ALPHA);
  g.fillRoundedRect(x, y, w, h, r);

  const fillW = w * Phaser.Math.Clamp(timeLeft01, 0, 1);
  if (fillW > 1) {
    const warn = timeLeft01 < 0.35;
    g.fillStyle(warn ? TIMER_WARN : TIMER_FILL, warn ? WARN_ALPHA : FILL_ALPHA);
    if (fillW >= w - 1) {
      g.fillRoundedRect(x, y, fillW, h, r);
    } else {
      const corner = Math.min(r, fillW / 2);
      g.fillRoundedRect(x, y, fillW, h, {
        tl: corner,
        bl: corner,
        tr: 0,
        br: 0,
      });
    }
  }
}

export function getComboPanelTextLayout(): {
  labelY: number;
  valueY: number;
  multY: number;
  labelSize: number;
  valueSize: number;
  multSize: number;
} {
  const h = COMBO_UI.height;
  return {
    labelY: -h * 0.32,
    valueY: h * 0.02,
    multY: h * 0.34,
    labelSize: Math.round(h * 0.145),
    valueSize: Math.round(h * 0.52),
    multSize: Math.round(h * 0.17),
  };
}
