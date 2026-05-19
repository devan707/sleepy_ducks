import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets';
import { MusicManager } from '../audio/MusicManager';
import { SoundManager } from '../audio/SoundManager';
import { SettingsButton } from '../ui/SettingsButton';
import { SettingsDrawer } from '../ui/SettingsDrawer';
import { FloatingAnimButton } from '../ui/FloatingAnimButton';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../config/gameConfig';
import type { GameOverData } from '../core/types';
import { formatSurvivalTime } from '../models/RunStats';
import { getHighScore, recordPersonalRun } from '../storage/personalBests';

const DEPTH = {
  bg: 0,
  overlay: 1,
  ui: 10,
} as const;

const RETRY_BTN_WIDTH = 200;

const BTN = {
  menu: { key: 'ui-gameover-menu', width: 200, height: 44, fill: 0x34495e, label: 'MENU' },
} as const;

export class GameOverScene extends Phaser.Scene {
  private soundManager!: SoundManager;
  private musicManager!: MusicManager;
  private settingsDrawer!: SettingsDrawer;
  private settingsButton!: SettingsButton;
  private banner!: Phaser.GameObjects.Image;
  private retryButton!: FloatingAnimButton;

  constructor() {
    super(SCENE_KEYS.gameOver);
  }

  create(data: GameOverData): void {
    this.cameras.main.setBackgroundColor('#1a3a4a');
    this.soundManager = SoundManager.forScene(this);
    this.musicManager = MusicManager.getInstance();
    this.musicManager.playGameOver();
    this.settingsDrawer = new SettingsDrawer(this, {
      depth: DEPTH.ui + 15,
      musicManager: this.musicManager,
      soundManager: this.soundManager,
      musicContext: 'gameOver',
      onOpen: () => this.musicManager.pauseForInterruption(),
      onClose: () => this.musicManager.resumeFromInterruption(),
    });
    this.settingsButton = new SettingsButton(this, {
      drawer: this.settingsDrawer,
      depth: DEPTH.ui + 5,
    });

    const { isNewBestScore, isNewLongestTime } = recordPersonalRun(
      data.score,
      data.stats,
    );
    data.isNewHighScore = isNewBestScore;
    data.isNewLongestTime = isNewLongestTime;
    const high = getHighScore();
    const cx = GAME_WIDTH / 2;

    this.createBackground();
    this.createDarkOverlay();
    this.createBanner(cx);
    this.createScorePanel(cx, data, high, isNewBestScore);
    this.createStats(cx, data, isNewLongestTime);
    this.createButtons(cx);
    this.playEntrance();
  }

  private createBackground(): void {
    if (this.textures.exists(ASSET_KEYS.homeWaterfall)) {
      const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, ASSET_KEYS.homeWaterfall);
      bg.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      bg.setDepth(DEPTH.bg);
      bg.setScrollFactor(0);
    } else {
      this.add
        .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a5f7a)
        .setDepth(DEPTH.bg);
    }
  }

  private createDarkOverlay(): void {
    const overlay = this.add.graphics().setDepth(DEPTH.overlay).setScrollFactor(0);
    overlay.fillGradientStyle(
      0x000000,
      0x000000,
      0x000000,
      0x000000,
      0.42,
      0.42,
      0.72,
      0.72,
    );
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  private createBanner(cx: number): void {
    const bannerY = 72;
    const targetW = GAME_WIDTH * 0.92;

    this.banner = this.add.image(cx, bannerY, ASSET_KEYS.gameOverBanner);
    this.banner.setScale(targetW / this.banner.width);
    this.banner.setOrigin(0.5, 0).setDepth(DEPTH.ui).setScrollFactor(0);
  }

  private createScorePanel(
    cx: number,
    data: GameOverData,
    high: number,
    isNewScore: boolean,
  ): void {
    const panelTop = this.banner.y + this.banner.displayHeight + 28;
    const panelH = isNewScore ? 118 : 88;

    const panel = this.add.graphics().setDepth(DEPTH.ui).setScrollFactor(0);
    panel.fillStyle(0x000000, 0.45);
    panel.fillRoundedRect(cx - 155, panelTop, 310, panelH, 20);

    const bannerStyle = {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '20px',
      fontStyle: 'bold' as const,
      color: COLORS.combo,
    };

    let y = panelTop + 36;
    if (isNewScore) {
      this.add
        .text(cx, y, 'NEW HIGH SCORE!', bannerStyle)
        .setOrigin(0.5)
        .setDepth(DEPTH.ui)
        .setScrollFactor(0);
      y += 30;
    }

    this.add
      .text(cx, y, `${data.score}`, {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '44px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.ui)
      .setScrollFactor(0);

    this.add
      .text(cx, y + 38, `Best: ${high}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '17px',
        color: '#ffe566',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.ui)
      .setScrollFactor(0);
  }

  private createStats(cx: number, data: GameOverData, isNewTime: boolean): void {
    const { stats } = data;
    const lines = [
      `Ducks saved: ${stats.ducksSaved}`,
      `Ducks missed: ${stats.ducksMissed}`,
      `Bad taps: ${stats.missedTaps}`,
      `Longest combo: ${stats.longestCombo}`,
      `Time survived: ${formatSurvivalTime(stats.timeSurvivedMs)}`,
    ];

    const statStyle = {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#d5e8ef',
    };

    const statsTop = this.banner.y + this.banner.displayHeight + 168;
    let y = statsTop;
    for (let i = 0; i < lines.length; i++) {
      this.add
        .text(cx, y, lines[i], statStyle)
        .setOrigin(0.5)
        .setDepth(DEPTH.ui)
        .setScrollFactor(0);
      y += 30;

      if (i === lines.length - 1 && isNewTime) {
        this.add
          .text(cx, y, 'NEW BEST TIME!', {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '18px',
            fontStyle: 'bold',
            color: COLORS.combo,
          })
          .setOrigin(0.5)
          .setDepth(DEPTH.ui)
          .setScrollFactor(0);
        y += 28;
      }
    }
  }

  private bakeButtonTexture(
    textureKey: string,
    label: string,
    width: number,
    height: number,
    fill: number,
  ): void {
    if (this.textures.exists(textureKey)) {
      this.textures.remove(textureKey);
    }

    const rt = this.make.renderTexture({ width, height }, false);
    const radius = height / 2;

    const bg = this.make.graphics({ x: 0, y: 0 }, false);
    bg.fillStyle(fill, 0.92);
    bg.fillRoundedRect(0, 0, width, height, radius);
    bg.lineStyle(3, 0xffffff, 0.3);
    bg.strokeRoundedRect(0, 0, width, height, radius);

    const labelText = this.make.text({
      x: width / 2,
      y: height / 2,
      text: label,
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: label.length > 8 ? '20px' : '18px',
        fontStyle: 'bold',
        color: '#ffffff',
      },
    });
    labelText.setOrigin(0.5);

    rt.draw(bg, 0, 0);
    rt.draw(labelText, width / 2, height / 2);
    rt.saveTexture(textureKey);

    bg.destroy();
    labelText.destroy();
    rt.destroy();
  }

  private createButtons(cx: number): void {
    this.bakeButtonTexture(
      BTN.menu.key,
      BTN.menu.label,
      BTN.menu.width,
      BTN.menu.height,
      BTN.menu.fill,
    );

    const retryY = GAME_HEIGHT - 168;
    const menuY = GAME_HEIGHT - 62;

    this.retryButton = new FloatingAnimButton(
      this,
      cx,
      retryY,
      ASSET_KEYS.uiRetry,
      null,
      {
        depth: DEPTH.ui,
        displayWidth: RETRY_BTN_WIDTH,
        autoFloat: false,
        interactive: true,
        onClick: () => {
          this.soundManager.tryUnlock();
          this.scene.start(SCENE_KEYS.game);
        },
      },
    );

    const menuButton = this.add
      .image(cx, menuY, BTN.menu.key)
      .setOrigin(0.5)
      .setDepth(DEPTH.ui)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    menuButton.on('pointerdown', () => {
      this.soundManager.tryUnlock();
      this.scene.start(SCENE_KEYS.menu);
    });
  }

  private playEntrance(): void {
    const bannerStartY = this.banner.y;
    this.banner.setAlpha(0);
    this.banner.y = bannerStartY - 20;
    this.tweens.add({
      targets: this.banner,
      alpha: 1,
      y: bannerStartY,
      duration: 650,
      ease: 'Back.easeOut',
    });

    this.retryButton.playEntrance(this, 250);
  }

  shutdown(): void {
    this.settingsDrawer?.destroy();
    this.settingsButton?.destroy();
    this.retryButton?.destroy();
    this.soundManager?.detach();
  }
}
