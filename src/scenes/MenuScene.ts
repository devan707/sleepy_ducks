import Phaser from 'phaser';
import { AssetManager } from '../assets/AssetManager';
import { loadGameAssets } from '../assets/GameAssetLoader';
import { ASSET_KEYS } from '../config/assets';
import { MusicManager } from '../audio/MusicManager';
import { SoundManager } from '../audio/SoundManager';
import { SettingsButton, getMenuSettingsButtonPosition } from '../ui/SettingsButton';
import { SettingsDrawer } from '../ui/SettingsDrawer';
import { FloatingAnimButton } from '../ui/FloatingAnimButton';
import {
  addVerticalVignettes,
  createTextLink,
  labelTextStyle,
  scoreTextStyle,
  titleTextStyle,
} from '../ui/uiChrome';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../config/gameConfig';
import { formatSurvivalTime } from '../models/RunStats';
import { getHighScore, getLongestTimeMs } from '../storage/highScore';
import { onInstallPromptReady } from '../pwa/installPrompt';
import {
  hideInstallPromptBanner,
  showInstallPromptBanner,
} from '../ui/installPromptBanner';
import {
  applySceneScale,
  getSceneCropInsets,
  insetFromRight,
  insetFromTop,
  isCoverLayoutActive,
  MENU_BOTTOM_EXTRA_LIFT,
  MENU_GEAR_DOWN_NUDGE,
  yFromBottom,
} from '../scale/displayScale';

const DEPTH = {
  bg: 0,
  vignette: 1,
  ui: 10,
  loadOverlay: 20,
} as const;

/** Art is 768² with padding; visible pill is ~55% of canvas width. */
const PLAY_BTN_WIDTH = 200;

export class MenuScene extends Phaser.Scene {
  private soundManager!: SoundManager;
  private musicManager!: MusicManager;
  private settingsDrawer!: SettingsDrawer;
  private settingsButton!: SettingsButton;
  private titleLogo!: Phaser.GameObjects.Image;
  private playButton!: FloatingAnimButton;
  private gameReady = false;
  private starting = false;
  private installPromptUnsub: (() => void) | null = null;
  private installPromptTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super(SCENE_KEYS.menu);
  }

  create(): void {
    applySceneScale(this.game, 'cover');
    const crop = getSceneCropInsets(this);

    this.starting = false;
    this.cameras.main.setBackgroundColor('#1a3a4a');
    this.soundManager = SoundManager.forScene(this);
    this.musicManager = MusicManager.getInstance();
    this.musicManager.playMenuUi();
    this.settingsDrawer = new SettingsDrawer(this, {
      depth: DEPTH.ui + 15,
      musicManager: this.musicManager,
      soundManager: this.soundManager,
      musicContext: 'menuUi',
      onOpen: () => this.musicManager.pauseForInterruption(),
      onClose: () => this.musicManager.resumeFromInterruption(),
    });
    this.settingsButton = new SettingsButton(this, {
      drawer: this.settingsDrawer,
      depth: DEPTH.ui + 5,
      alpha: 0.78,
      ...this.getMenuSettingsPosition(crop),
    });
    if (this.textures.exists(ASSET_KEYS.uiGear)) {
      this.settingsButton.refreshGearGraphic();
    }

    this.createBackground();
    addVerticalVignettes(this, DEPTH.vignette);
    this.createTitleBlock(crop);
    this.createPlayButton(crop);
    this.createRulesLink(crop);
    this.createLoadOverlay(crop);
    this.setupInput();
    this.playEntrance();
    this.gameReady = AssetManager.hasRealGameplayArt();
    this.scheduleInstallPrompt();
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

  private getMenuSettingsPosition(crop: ReturnType<typeof getSceneCropInsets>): {
    x: number;
    y: number;
  } {
    const base = getMenuSettingsButtonPosition();
    return {
      x: insetFromRight(base.x, crop.right),
      y: insetFromTop(base.y, crop.top) + MENU_GEAR_DOWN_NUDGE,
    };
  }

  private menuBottomLift(): number {
    return isCoverLayoutActive(this.game) ? MENU_BOTTOM_EXTRA_LIFT : 0;
  }

  private createTitleBlock(crop: ReturnType<typeof getSceneCropInsets>): void {
    const cx = GAME_WIDTH / 2;
    const logoY = insetFromTop(92, crop.top);

    this.titleLogo = this.add.image(cx, logoY, ASSET_KEYS.titleLogo);
    const targetW = GAME_WIDTH * 0.88;
    this.titleLogo.setScale(targetW / this.titleLogo.width);
    this.titleLogo.setOrigin(0.5, 0).setDepth(DEPTH.ui).setScrollFactor(0);

    const taglineY = logoY + this.titleLogo.displayHeight + 20;
    this.add
      .text(cx, taglineY, 'Save them from the fall', titleTextStyle({ fontSize: '17px' }))
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.ui)
      .setScrollFactor(0);

    const high = getHighScore();
    const longestMs = getLongestTimeMs();
    const scoreY = taglineY + 44;
    const timeY = scoreY + 68;
    const statsPanelWidth = 272;
    const statsPanelTop = scoreY - 12;
    const statsPanelHeight = timeY + 20 + 34 - statsPanelTop;

    const statsPanel = this.add.graphics().setDepth(DEPTH.ui - 1).setScrollFactor(0);
    statsPanel.fillStyle(0x1a2830, 0.42);
    statsPanel.fillRoundedRect(
      cx - statsPanelWidth / 2,
      statsPanelTop,
      statsPanelWidth,
      statsPanelHeight,
      16,
    );

    this.add
      .text(cx, scoreY, 'BEST SCORE', labelTextStyle({ strokeThickness: 0 }))
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.ui)
      .setScrollFactor(0);

    this.add
      .text(cx, scoreY + 20, String(high), scoreTextStyle({ fontSize: '36px', strokeThickness: 0 }))
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.ui)
      .setScrollFactor(0);

    this.add
      .text(cx, timeY, 'BEST TIME', labelTextStyle({ strokeThickness: 0 }))
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.ui)
      .setScrollFactor(0);

    this.add
      .text(
        cx,
        timeY + 20,
        longestMs > 0 ? formatSurvivalTime(longestMs) : '—',
        scoreTextStyle({ fontSize: '28px', strokeThickness: 0 }),
      )
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.ui)
      .setScrollFactor(0);
  }

  private createPlayButton(crop: ReturnType<typeof getSceneCropInsets>): void {
    this.playButton = new FloatingAnimButton(
      this,
      GAME_WIDTH / 2,
      yFromBottom(112 + this.menuBottomLift(), crop.bottom),
      ASSET_KEYS.uiPlay,
      null,
      { depth: DEPTH.ui, displayWidth: PLAY_BTN_WIDTH, autoFloat: false },
    );
  }

  private createRulesLink(crop: ReturnType<typeof getSceneCropInsets>): void {
    createTextLink(
      this,
      GAME_WIDTH / 2,
      yFromBottom(192 + this.menuBottomLift(), crop.bottom),
      'How to play →',
      () => this.scene.start(SCENE_KEYS.rules),
      DEPTH.ui,
    );
  }

  private createLoadOverlay(crop: ReturnType<typeof getSceneCropInsets>): void {
    const cx = GAME_WIDTH / 2;
    const cy = yFromBottom(112 + this.menuBottomLift(), crop.bottom);

    this.add
      .rectangle(cx, cy, 280, 88, 0x000000, 0)
      .setDepth(DEPTH.loadOverlay)
      .setScrollFactor(0);
  }

  private setupInput(): void {
    this.input.on('pointerdown', () => {
      if (SettingsButton.consumeSceneSuppress()) return;
      this.musicManager.tryUnlock();
      this.soundManager.tryUnlock();
      this.tryStartGame();
    });
  }

  private tryStartGame(): void {
    if (this.starting || this.settingsDrawer?.isOpen()) return;
    this.soundManager.tryUnlock();

    if (!this.gameReady) {
      this.playButton.setLoading(true);
      loadGameAssets(this).then(() => {
        this.playButton.setLoading(false);
        this.gameReady = AssetManager.hasRealGameplayArt();
        if (this.gameReady) this.startGame();
      });
      return;
    }

    this.startGame();
  }

  private startGame(): void {
    this.starting = true;
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.time.delayedCall(280, () => {
      this.scene.start(SCENE_KEYS.game);
    });
  }

  private playEntrance(): void {
    this.cameras.main.setAlpha(1);

    const startY = this.titleLogo.y;
    this.titleLogo.setAlpha(0);
    this.titleLogo.y = startY - 24;
    this.tweens.add({
      targets: this.titleLogo,
      alpha: 1,
      y: startY,
      duration: 700,
      ease: 'Back.easeOut',
    });

    this.playButton.playEntrance(this, 200);
  }

  private scheduleInstallPrompt(): void {
    this.clearInstallPromptSchedule();
    this.installPromptTimer = this.time.delayedCall(900, () => {
      showInstallPromptBanner();
    });
    this.installPromptUnsub = onInstallPromptReady(() => {
      showInstallPromptBanner();
    });
  }

  private clearInstallPromptSchedule(): void {
    this.installPromptTimer?.remove(false);
    this.installPromptTimer = null;
    this.installPromptUnsub?.();
    this.installPromptUnsub = null;
  }

  shutdown(): void {
    applySceneScale(this.game, 'fit');
    this.clearInstallPromptSchedule();
    hideInstallPromptBanner();
    this.settingsDrawer?.destroy();
    this.settingsButton?.destroy();
    this.playButton?.destroy();
    this.soundManager?.detach();
    this.input.off('pointerdown');
  }
}
