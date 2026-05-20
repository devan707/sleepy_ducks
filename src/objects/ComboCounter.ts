import Phaser from 'phaser';
import { formatComboMultiplierLabel } from '../scoring/runScore';
import { COMBO_UI, GAME_WIDTH, STAGE } from '../config/gameConfig';
import { arcadeHudTextStyle, captionTextStyle } from '../ui/uiChrome';

const TIMER_TRACK = 0x143040;
const TIMER_FILL = 0xffd966;
const TIMER_WARN = 0xff7a55;
const TRACK_ALPHA = 0.35;
const FILL_ALPHA = 0.95;
const WARN_ALPHA = 0.95;

/** Local Y positions for the compact combo stack (no panel background). */
const LABEL_Y = -30;
const VALUE_Y = -6;
const METER_Y = 17;
const MULT_Y = 32;
const VALUE_FONT_PX = 40;
const LABEL_FONT_PX = 11;
const MULT_FONT_PX = 14;

export class ComboCounter {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container;
  private meterGfx: Phaser.GameObjects.Graphics;
  private labelText: Phaser.GameObjects.Text;
  private valueText: Phaser.GameObjects.Text;
  private multText: Phaser.GameObjects.Text;
  private combo = 0;
  private visible = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.root = scene.add.container(GAME_WIDTH / 2, COMBO_UI.y);
    this.root.setScrollFactor(0).setDepth(STAGE.depthComboHud).setAlpha(0).setScale(0.9);

    this.meterGfx = scene.add.graphics();
    this.labelText = scene.add
      .text(0, LABEL_Y, 'COMBO', captionTextStyle({
        fontSize: `${LABEL_FONT_PX}px`,
        letterSpacing: 4,
        color: '#fff8d0',
      }))
      .setOrigin(0.5);
    this.valueText = scene.add
      .text(
        0,
        VALUE_Y,
        '0',
        arcadeHudTextStyle({
          fontSize: `${VALUE_FONT_PX}px`,
          color: '#fffef0',
          stroke: '#6a4808',
          strokeThickness: 6,
        }),
      )
      .setOrigin(0.5);
    this.multText = scene.add
      .text(
        0,
        MULT_Y,
        '',
        arcadeHudTextStyle({
          fontSize: `${MULT_FONT_PX}px`,
          color: '#ffdd55',
          stroke: '#5a3d08',
          strokeThickness: 4,
        }),
      )
      .setOrigin(0.5);

    this.root.add([this.meterGfx, this.labelText, this.valueText, this.multText]);
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
    this.multText.setText(formatComboMultiplierLabel(combo));

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

    if (kind === 'milestone') {
      this.highlightMultiplier(tier);
    }

    this.spawnRingBurst(kind === 'start' ? 0 : tier + 1);
    if (kind === 'milestone' && tier >= 2) {
      this.spawnRingBurst(tier + 2, 90);
    }
    if (kind === 'milestone' && tier >= 4) {
      this.jiggleRoot();
    }
  }

  destroy(): void {
    this.root.destroy();
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

  private highlightMultiplier(tier: number): void {
    const bigPx = Math.round(MULT_FONT_PX * (1.38 + tier * 0.05));
    this.scene.tweens.killTweensOf(this.multText);
    this.multText.setStyle({ fontSize: `${bigPx}px` });
    this.multText.setScale(1);
    this.scene.tweens.add({
      targets: this.multText,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 200,
      yoyo: true,
      repeat: 1,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.multText.setStyle({ fontSize: `${MULT_FONT_PX}px` });
        this.multText.setScale(1);
      },
    });
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

  private redrawMeter(timeLeft01: number): void {
    drawComboTimerBar(this.meterGfx, timeLeft01);
  }

  private spawnRingBurst(strength: number, delayMs = 0): void {
    const colors = [0xffeeaa, 0xffdd66, 0xffcc44, 0xffaa33, 0xff8833, 0xff6622];
    const color = colors[Math.min(strength, colors.length - 1)];
    const baseRadius = 28 + strength * 4;

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

/** Thin timer bar under the combo number (in-game + rules preview). */
export function drawComboTimerBar(
  g: Phaser.GameObjects.Graphics,
  timeLeft01: number,
): void {
  const { timerBarWidth: w, timerBarHeight: h } = COMBO_UI;
  const x = -w / 2;
  const y = METER_Y - h / 2;
  const r = h / 2;
  g.clear();

  g.fillStyle(TIMER_TRACK, TRACK_ALPHA);
  g.fillRoundedRect(x, y, w, h, r);

  const fillW = w * Phaser.Math.Clamp(timeLeft01, 0, 1);
  if (fillW > 0.5) {
    const warn = timeLeft01 < 0.35;
    g.fillStyle(warn ? TIMER_WARN : TIMER_FILL, warn ? WARN_ALPHA : FILL_ALPHA);
    if (fillW >= w - 0.5) {
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

/** @deprecated Use drawComboTimerBar */
export const drawComboPanelMeter = drawComboTimerBar;

export function getComboPanelTextLayout(): {
  labelY: number;
  valueY: number;
  multY: number;
  meterY: number;
  labelSize: number;
  valueSize: number;
  multSize: number;
} {
  return {
    labelY: LABEL_Y,
    valueY: VALUE_Y,
    multY: MULT_Y,
    meterY: METER_Y,
    labelSize: LABEL_FONT_PX,
    valueSize: VALUE_FONT_PX,
    multSize: MULT_FONT_PX,
  };
}
