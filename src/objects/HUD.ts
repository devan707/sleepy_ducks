import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets';
import {
  GAME_WIDTH,
  HUD_LAYOUT,
  MAX_LIVES,
  MAX_LIVES_CAP,
  STAGE,
} from '../config/gameConfig';
import { formatSurvivalTime } from '../models/RunStats';
import {
  addTopHudFade,
  arcadeHudTimerStyle,
  captionTextStyle,
  scoreTextStyle,
} from '../ui/uiChrome';
import { ComboCounter } from './ComboCounter';

const HEART_SIZE = 24;
const HEART_GAP = 5;
const PANEL_FILL = 0x0a2230;
const PANEL_ALPHA = 0.72;

export class HUD {
  private scene: Phaser.Scene;
  private scorePanel: Phaser.GameObjects.Graphics;
  private scoreLabel: Phaser.GameObjects.Text;
  private scoreValueText: Phaser.GameObjects.Text;
  private timerText: Phaser.GameObjects.Text;
  private comboCounter: ComboCounter;
  private hearts: Phaser.GameObjects.Image[] = [];
  private livesContainer: Phaser.GameObjects.Container;
  private hudRoot: Phaser.GameObjects.Container;
  private readonly scoreLeft: number;
  private readonly scoreTop: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    addTopHudFade(scene, STAGE.hudDepth - 1);

    this.hudRoot = scene.add.container(0, 0);
    this.hudRoot.setScrollFactor(0).setDepth(STAGE.hudDepth);

    this.scoreLeft = HUD_LAYOUT.marginLeft;
    this.scoreTop = HUD_LAYOUT.scoreTop;

    this.scorePanel = scene.add.graphics();

    this.scoreLabel = scene.add
      .text(this.scoreLeft, this.scoreTop + 8, 'SCORE', captionTextStyle({ fontSize: '10px', letterSpacing: 3 }))
      .setOrigin(0, 0);

    this.scoreValueText = scene.add
      .text(this.scoreLeft, this.scoreTop + 22, '0', scoreTextStyle({ fontSize: '28px' }))
      .setOrigin(0, 0);

    this.timerText = scene.add
      .text(this.scoreLeft, this.scoreTop + 54, '0:00', arcadeHudTimerStyle())
      .setOrigin(0, 0);

    this.comboCounter = new ComboCounter(scene);

    const heartsRight = GAME_WIDTH - HUD_LAYOUT.marginRight;
    this.livesContainer = scene.add.container(heartsRight, this.scoreTop + 8);
    for (let i = 0; i < MAX_LIVES_CAP; i++) {
      const heart = scene.add.image(-i * (HEART_SIZE + HEART_GAP), 0, ASSET_KEYS.uiHeart);
      heart.setDisplaySize(HEART_SIZE, HEART_SIZE);
      heart.setOrigin(1, 0);
      this.hearts.push(heart);
      this.livesContainer.add(heart);
    }

    this.hudRoot.add([
      this.scorePanel,
      this.scoreLabel,
      this.scoreValueText,
      this.timerText,
      this.livesContainer,
    ]);

    this.setLives(MAX_LIVES);
    this.setElapsedTime(0);
    this.layoutScorePanel();
  }

  private layoutScorePanel(): void {
    const { scorePanelRadius, scorePanelPadX, scorePanelPadY } = HUD_LAYOUT;

    const contentW = Math.max(
      this.scoreLabel.width,
      this.scoreValueText.width,
      this.timerText.width,
    );
    const contentBottom =
      this.timerText.y + this.timerText.height - this.scoreTop + scorePanelPadY;

    const panelX = this.scoreLeft - scorePanelPadX;
    const panelY = this.scoreTop - scorePanelPadY / 2;
    const panelW = contentW + scorePanelPadX * 2;
    const panelH = contentBottom + scorePanelPadY / 2;

    const g = this.scorePanel;
    g.clear();
    g.fillStyle(PANEL_FILL, PANEL_ALPHA);
    g.fillRoundedRect(panelX, panelY, panelW, panelH, scorePanelRadius);
    g.lineStyle(1.5, 0xffffff, 0.14);
    g.strokeRoundedRect(panelX, panelY, panelW, panelH, scorePanelRadius);
  }

  setScore(score: number): void {
    this.scoreValueText.setText(String(score));
    this.layoutScorePanel();
  }

  /** Same clock as end-game `timeSurvivedMs` (MM:SS). */
  setElapsedTime(ms: number): void {
    this.timerText.setText(formatSurvivalTime(ms));
    this.layoutScorePanel();
  }

  setLives(lives: number): void {
    this.hearts.forEach((heart, i) => {
      const filled = i < lives;
      heart.setAlpha(filled ? 1 : 0.3);
      heart.setTint(filled ? 0xffffff : 0x888888);
    });
  }

  setCombo(combo: number): void {
    this.comboCounter.setCombo(combo);
  }

  updateComboTimer(timeLeft01: number): void {
    this.comboCounter.updateTimer(timeLeft01);
  }

  flashMiss(): void {
    this.scene.tweens.add({
      targets: this.livesContainer,
      alpha: 0.25,
      duration: 80,
      yoyo: true,
      repeat: 2,
    });
  }

  destroy(): void {
    this.hudRoot.destroy();
    this.comboCounter.destroy();
  }
}
