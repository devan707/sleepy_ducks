import Phaser from 'phaser';
import { comboMultiplier } from '../scoring/runScore';
import {
  COLORS,
  COMBO_TIMEOUT_MS,
  COMBO_UI,
  GAME_WIDTH,
  STAGE,
} from '../config/gameConfig';
import { arcadeHudTextStyle, captionTextStyle } from '../ui/uiChrome';

const COMBO_GOLD = 0xf5b942;
const PANEL_FILL = 0x0a2230;
const TIMER_TRACK = 0x1e4a5c;
const TIMER_FILL = 0xffc857;

export class ComboCounter {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container;
  private panel: Phaser.GameObjects.Graphics;
  private timerBar: Phaser.GameObjects.Graphics;
  private labelText: Phaser.GameObjects.Text;
  private valueText: Phaser.GameObjects.Text;
  private multText: Phaser.GameObjects.Text;
  private combo = 0;
  private visible = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.root = scene.add.container(GAME_WIDTH / 2, COMBO_UI.y);
    this.root.setScrollFactor(0).setDepth(STAGE.hudDepth + 1).setAlpha(0).setScale(0.9);

    this.panel = scene.add.graphics();
    this.timerBar = scene.add.graphics();
    this.labelText = scene.add
      .text(0, -24, 'COMBO', captionTextStyle({ fontSize: '11px', letterSpacing: 3, color: '#f8d78a' }))
      .setOrigin(0.5);
    this.valueText = scene.add
      .text(0, 2, '0', arcadeHudTextStyle({ fontSize: '40px', color: '#ffffff' }))
      .setOrigin(0.5);
    this.multText = scene.add
      .text(0, 28, '', arcadeHudTextStyle({ fontSize: '13px', color: COLORS.combo, strokeThickness: 3 }))
      .setOrigin(0.5);

    this.root.add([
      this.panel,
      this.timerBar,
      this.labelText,
      this.valueText,
      this.multText,
    ]);
    this.redrawPanel();
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
    this.redrawTimerBar(Phaser.Math.Clamp(timeLeft01, 0, 1));
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
    this.redrawTimerBar(1);
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

  private redrawPanel(): void {
    const { width: w, height: h, radius: r } = COMBO_UI;
    const g = this.panel;
    g.clear();
    g.fillStyle(PANEL_FILL, 0.78);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    g.lineStyle(2, COMBO_GOLD, 0.9);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
  }

  private redrawTimerBar(timeLeft01: number): void {
    const g = this.timerBar;
    g.clear();

    const barW = COMBO_UI.width - 24;
    const barH = 5;
    const barX = -barW / 2;
    const barY = COMBO_UI.height / 2 - 12;
    const radius = barH / 2;

    g.fillStyle(TIMER_TRACK, 0.65);
    g.fillRoundedRect(barX, barY, barW, barH, radius);

    if (timeLeft01 <= 0) return;

    const warn = timeLeft01 < 0.35;
    g.fillStyle(warn ? 0xff6b4a : TIMER_FILL, 0.95);
    g.fillRoundedRect(barX, barY, barW * timeLeft01, barH, radius);
  }
}

export function comboTimeLeft01(timerMs: number): number {
  return 1 - timerMs / COMBO_TIMEOUT_MS;
}
