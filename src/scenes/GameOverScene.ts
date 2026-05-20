import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets';
import { MusicManager } from '../audio/MusicManager';
import { SoundManager } from '../audio/SoundManager';
import { SettingsButton, getMenuSettingsButtonPosition } from '../ui/SettingsButton';
import { SettingsDrawer } from '../ui/SettingsDrawer';
import { FloatingAnimButton } from '../ui/FloatingAnimButton';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../config/gameConfig';
import type { GameOverData } from '../core/types';
import { formatSurvivalTime } from '../models/RunStats';
import { getHighScore, recordPersonalRun } from '../storage/personalBests';
import { formatScore } from '../util/formatScore';
import {
  applySceneScale,
  GAME_OVER_BOTTOM_LIFT,
  GAME_OVER_MENU_EXTRA_LIFT,
  GAME_OVER_STATS_LIFT,
  getSceneCropInsets,
  insetFromRight,
  insetFromTop,
  isCoverLayoutActive,
  MENU_GEAR_DOWN_NUDGE,
  yFromBottom,
} from '../scale/displayScale';

const DEPTH = {
  bg: 0,
  overlay: 1,
  ui: 10,
} as const;

const RETRY_BTN_WIDTH = 200;
const BACK_HOME_LABEL = '← Back to Home';

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
    applySceneScale(this.game, 'cover');
    const crop = getSceneCropInsets(this);

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
      alpha: 0.78,
      ...this.getGameOverSettingsPosition(crop),
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
    this.createBanner(cx, crop);
    this.createScorePanel(cx, data, high, isNewBestScore);
    this.createStats(cx, data, isNewLongestTime);
    this.createButtons(cx, crop);
    this.playEntrance();
  }

  private gameOverBottomLift(): number {
    return isCoverLayoutActive(this.game) ? GAME_OVER_BOTTOM_LIFT : 0;
  }

  private getGameOverSettingsPosition(crop: ReturnType<typeof getSceneCropInsets>): {
    x: number;
    y: number;
  } {
    const base = getMenuSettingsButtonPosition();
    return {
      x: insetFromRight(base.x, crop.right),
      y: insetFromTop(base.y, crop.top) + MENU_GEAR_DOWN_NUDGE,
    };
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

  private createBanner(cx: number, crop: ReturnType<typeof getSceneCropInsets>): void {
    const bannerY = insetFromTop(72, crop.top);
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
    const lift = this.gameOverBottomLift();
    const panelTop = this.banner.y + this.banner.displayHeight + 28 - (lift > 0 ? lift * 0.5 : 0);
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
      .text(cx, y, formatScore(data.score), {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '44px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.ui)
      .setScrollFactor(0);

    this.add
      .text(cx, y + 38, `Best: ${formatScore(high)}`, {
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

    const lift = this.gameOverBottomLift();
    const statsTop =
      this.banner.y + this.banner.displayHeight + 168 - lift - (lift > 0 ? GAME_OVER_STATS_LIFT : 0);
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

  private createButtons(cx: number, crop: ReturnType<typeof getSceneCropInsets>): void {
    const bottomLift = this.gameOverBottomLift();
    const retryY = yFromBottom(168 + bottomLift, crop.bottom);
    const menuY = yFromBottom(62 + bottomLift + GAME_OVER_MENU_EXTRA_LIFT, crop.bottom);

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

    const backHome = this.add
      .text(cx, menuY, BACK_HOME_LABEL, {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '17px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.ui)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    backHome.on('pointerdown', () => {
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
    applySceneScale(this.game, 'fit');
    this.settingsDrawer?.destroy();
    this.settingsButton?.destroy();
    this.retryButton?.destroy();
    this.soundManager?.detach();
  }
}
