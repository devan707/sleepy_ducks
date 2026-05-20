import Phaser from 'phaser';
import { ASSET_KEYS, type AssetKey } from '../config/assets';
import { registerMoonflowerAnimations } from '../assets/MoonflowerAnimations';
import { registerZzzAnimations } from '../assets/ZzzAnimations';
import { MusicManager } from '../audio/MusicManager';
import { SoundManager } from '../audio/SoundManager';
import { AudioSession } from '../audio/AudioSession';
import { ensureAppActive } from '../audio/appAudioLifecycle';
import { resetGameplayPointerSuppress } from '../input/pointerSuppress';
import { SettingsButton, getMenuSettingsButtonPosition } from '../ui/SettingsButton';
import { SettingsDrawer } from '../ui/SettingsDrawer';
import { FloatingAnimButton } from '../ui/FloatingAnimButton';
import { MasterMuteButton, getMenuMasterMutePosition } from '../ui/MasterMuteButton';
import { EndScreenScoreCard } from '../ui/EndScreenScoreCard';
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  HUD_TOP_PADDING,
  SCENE_KEYS,
} from '../config/gameConfig';
import {
  MOONFLOWER_ATLAS_KEYS,
  MOONFLOWER_ANIM_KEYS,
} from '../config/moonflowerAssets';
import { ZZZ_ANIM_KEYS, ZZZ_ATLAS_KEYS } from '../config/zzzAssets';
import type { GameOverData, GameOverOutcome } from '../core/types';
import { getHighScore, recordPersonalRun } from '../storage/personalBests';
import {
  createTextLink,
  ensureLilitaFont,
  lilitaDisplayStyle,
} from '../ui/uiChrome';
import { GameplayBottomToast } from '../ui/GameplayBottomToast';
import { hidePlayerNameOverlay } from '../ui/playerNameOverlay';

const DEPTH = {
  bg: 0,
  overlay: 1,
  ui: 10,
} as const;

const GEAR_RADIUS = 22;
const GEAR_CLEARANCE = 14;
const SECTION_GAP = 16;
/** Compact hero bloom on moonflower-collected level passed (keeps room for score card). */
const MOONFLOWER_HERO_HEIGHT = 96;
const MOONFLOWER_CELEBRATION_LIFT_Y = 22;
/** Pulls title + link up toward the hero so the score card has more room below. */
const MOONFLOWER_TEXT_LIFT_Y = 28;
const MOONFLOWER_CHARMS_LINK_GAP = 14;
const MOONFLOWER_SCORE_CARD_GAP = 28;
/** Pull score card up on the moonflower-collected level-pass screen. */
const MOONFLOWER_PASSED_SCORE_CARD_LIFT_Y = 22;
const PASSED_SCORE_CARD_OFFSET_Y = 15;
/** Flying female duck below level-passed banner (no moonflower). */
const PASSED_DUCK_HERO_HEIGHT = 128;
const PASSED_DUCK_LIFT_Y = 52;
const PASSED_SCORE_GAP = 8;
const MOONFLOWER_HINT_ICON_H = 44;
const MOONFLOWER_HINT_ROW_H = 54;
const PASSED_MOONFLOWER_HINT_LIFT_Y = 40;
/** Opaque art in next_level.png sits higher than retry.png at the same display width. */
const PASSED_NEXT_LEVEL_BTN_Y_OFFSET = 5;

const RETRY_BTN_WIDTH = 200;
const PASSED_BTN_WIDTH = 160;
const PASSED_BTN_GAP = 14;
const PASSED_BTN_Y = GAME_HEIGHT - 88;
const BACK_HOME_LABEL = '← Back to Home';

/** Keeps the header art clear of the top-right gear + mute column. */
function getBannerMaxWidth(): number {
  const gear = getMenuSettingsButtonPosition();
  const rightLimit = gear.x - GEAR_RADIUS - GEAR_CLEARANCE;
  const cx = GAME_WIDTH / 2;
  return Math.floor(Math.min(GAME_WIDTH * 0.68, (rightLimit - cx) * 2));
}

export class GameOverScene extends Phaser.Scene {
  private soundManager!: SoundManager;
  private musicManager!: MusicManager;
  private settingsDrawer!: SettingsDrawer;
  private settingsButton!: SettingsButton;
  private masterMuteButton!: MasterMuteButton;
  private bottomToast!: GameplayBottomToast;
  private banner!: Phaser.GameObjects.Image;
  private scoreCard: EndScreenScoreCard | null = null;
  private primaryButton!: FloatingAnimButton;
  private secondaryButton: FloatingAnimButton | null = null;

  constructor() {
    super(SCENE_KEYS.gameOver);
  }

  create(data: GameOverData): void {
    ensureAppActive(this.game);
    this.cameras.main.setBackgroundColor('#1a3a4a');
    this.soundManager = SoundManager.forScene(this);
    this.musicManager = MusicManager.getInstance();
    AudioSession.getInstance().resetForSceneTransition();
    this.musicManager.playGameOver(data.outcome === 'failed' ? 'failed' : 'passed');
    this.settingsDrawer = new SettingsDrawer(this, {
      depth: DEPTH.ui + 15,
      musicManager: this.musicManager,
      soundManager: this.soundManager,
      musicContext: 'gameOver',
      onOpen: () => AudioSession.getInstance().onSettingsOpen(true),
      onClose: () => AudioSession.getInstance().onSettingsOpen(false),
    });
    const gearPos = getMenuSettingsButtonPosition();
    this.settingsButton = new SettingsButton(this, {
      drawer: this.settingsDrawer,
      depth: DEPTH.ui + 5,
      alpha: 0.78,
      ...gearPos,
    });
    this.masterMuteButton = new MasterMuteButton(this, {
      depth: DEPTH.ui + 5,
      alpha: 0.78,
      ...getMenuMasterMutePosition(gearPos),
    });
    if (
      this.textures.exists(ASSET_KEYS.uiSoundOn) ||
      this.textures.exists(ASSET_KEYS.uiSoundOff)
    ) {
      this.masterMuteButton.refreshIcon();
    }
    this.bottomToast = new GameplayBottomToast(this);

    if (data.outcome === 'failed') {
      this.cameras.main.fadeIn(220, 0, 0, 0);
    }

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
    this.createBanner(cx, data.outcome);

    let contentY = this.bannerBottom() + SECTION_GAP;

    if (data.outcome === 'failed') {
      contentY = this.addFailedSubtitle(cx, contentY) + SECTION_GAP;
    } else if (data.outcome === 'passedWithMoonflower') {
      contentY = this.addMoonflowerCelebration(cx, contentY) + MOONFLOWER_SCORE_CARD_GAP;
    } else if (data.outcome === 'passed') {
      contentY = this.addPassedCelebration(cx, contentY) + PASSED_SCORE_GAP;
    }

    const buttonReserveTop = this.getButtonAreaTop(data.outcome);
    if (data.outcome === 'passed' || data.outcome === 'passedWithMoonflower') {
      contentY += PASSED_SCORE_CARD_OFFSET_Y;
    }
    if (data.outcome === 'passedWithMoonflower') {
      contentY -= MOONFLOWER_PASSED_SCORE_CARD_LIFT_Y;
    }
    contentY = this.fitScoreCard(
      cx,
      contentY,
      buttonReserveTop,
      data,
      high,
      isNewBestScore,
      isNewLongestTime,
    );

    if (data.outcome === 'passed' && this.scoreCard) {
      this.addMoonflowerNotCollectedHint(
        cx,
        this.scoreCard.bottom + 6 - PASSED_MOONFLOWER_HINT_LIFT_Y,
      );
    }

    if (data.outcome === 'failed') {
      this.createFailedButtons(cx);
    } else {
      this.createPassedButtons(cx);
    }

    if (data.skipEntrance) {
      this.banner.setAlpha(1);
      if (this.scoreCard) {
        this.scoreCard.root.setAlpha(1);
      }
      this.primaryButton.root.setAlpha(1);
      this.secondaryButton?.root.setAlpha(1);
    } else {
      this.playEntrance();
    }
  }

  private bannerKeyFor(outcome: GameOverOutcome): AssetKey {
    if (outcome === 'passed') return ASSET_KEYS.uiLevelPassed;
    if (outcome === 'passedWithMoonflower') return ASSET_KEYS.uiLevelPassedMoonflower;
    return ASSET_KEYS.uiTooSleepy;
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

  private createBanner(cx: number, outcome: GameOverOutcome): void {
    const bannerTop = HUD_TOP_PADDING + 4;
    const targetW = getBannerMaxWidth();

    this.banner = this.add.image(cx, bannerTop, this.bannerKeyFor(outcome));
    this.banner.setScale(targetW / this.banner.width);
    this.banner.setOrigin(0.5, 0).setDepth(DEPTH.ui).setScrollFactor(0);
  }

  private bannerBottom(): number {
    return this.banner.y + this.banner.displayHeight;
  }

  private addFailedSubtitle(cx: number, topY: number): number {
    const subtitle = this.add
      .text(cx, topY, 'can you make it to nightfall?', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ecf8ff',
        stroke: '#0a1620',
        strokeThickness: 3,
        wordWrap: { width: getBannerMaxWidth(), useAdvancedWrap: true },
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.ui)
      .setScrollFactor(0);
    return topY + subtitle.height;
  }

  private addMoonflowerCelebration(cx: number, topY: number): number {
    const heroDepth = DEPTH.ui + 1;
    const labelDepth = DEPTH.ui + 3;
    const baseY = topY - MOONFLOWER_CELEBRATION_LIFT_Y;

    if (this.textures.exists(MOONFLOWER_ATLAS_KEYS.sway)) {
      registerMoonflowerAnimations(this);
      const heroY = baseY + MOONFLOWER_HERO_HEIGHT * 0.42;
      const hero = this.add.sprite(
        cx,
        heroY,
        MOONFLOWER_ATLAS_KEYS.sway,
        'frame_000',
      );
      hero.setOrigin(0.5, 0.78);
      const fit = MOONFLOWER_HERO_HEIGHT / hero.height;
      hero.setDisplaySize(hero.width * fit, MOONFLOWER_HERO_HEIGHT);
      hero.setAlpha(0.5);
      hero.setDepth(heroDepth);
      hero.setScrollFactor(0);
      if (this.anims.exists(MOONFLOWER_ANIM_KEYS.sway)) {
        hero.anims.play(MOONFLOWER_ANIM_KEYS.sway);
      }
    }

    const titleY = baseY + MOONFLOWER_HERO_HEIGHT + 2 - MOONFLOWER_TEXT_LIFT_Y;
    const title = this.add
      .text(
        cx,
        titleY,
        'moonflower collected!',
        lilitaDisplayStyle({
          fontSize: '22px',
          color: '#d8f0ff',
          stroke: '#1a0e08',
          strokeThickness: 5,
        }),
      )
      .setOrigin(0.5, 0)
      .setDepth(labelDepth)
      .setScrollFactor(0);
    void ensureLilitaFont(title, 22);

    const linkY = titleY + title.height + MOONFLOWER_CHARMS_LINK_GAP;
    const charmsLink = createTextLink(
      this,
      cx,
      linkY,
      'view charms',
      () => {
        this.soundManager.tryUnlock();
        this.settingsDrawer.open();
      },
      labelDepth,
      { fontSize: '14px', strokeThickness: 2 },
    );

    return linkY + charmsLink.getBounds().height + 8;
  }

  private addPassedCelebration(cx: number, topY: number): number {
    const heroDepth = DEPTH.ui + 1;
    const labelDepth = DEPTH.ui + 2;
    const duckTop = topY - PASSED_DUCK_LIFT_Y;

    if (this.textures.exists(ZZZ_ATLAS_KEYS.loop)) {
      registerZzzAnimations(this);
      const heroY = duckTop + PASSED_DUCK_HERO_HEIGHT * 0.5;
      const hero = this.add.sprite(
        cx,
        heroY,
        ZZZ_ATLAS_KEYS.loop,
        'frame_000',
      );
      hero.setOrigin(0.5, 0.5);
      const fit = PASSED_DUCK_HERO_HEIGHT / hero.height;
      hero.setDisplaySize(hero.width * fit, PASSED_DUCK_HERO_HEIGHT);
      hero.setAlpha(0.5);
      hero.setDepth(heroDepth);
      hero.setScrollFactor(0);
      if (this.anims.exists(ZZZ_ANIM_KEYS.loop)) {
        hero.anims.play(ZZZ_ANIM_KEYS.loop);
      }
    }

    const subtitle = this.add
      .text(cx, duckTop + PASSED_DUCK_HERO_HEIGHT + 8, 'You made it safely to nightfall!', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#ecf8ff',
        stroke: '#0a1620',
        strokeThickness: 3,
        wordWrap: { width: getBannerMaxWidth(), useAdvancedWrap: true },
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setDepth(labelDepth)
      .setScrollFactor(0);

    return duckTop + PASSED_DUCK_HERO_HEIGHT + 8 + subtitle.height;
  }

  private addMoonflowerNotCollectedHint(cx: number, topY: number): void {
    const depth = DEPTH.ui + 1;
    const gap = 7;
    const lineY = topY + MOONFLOWER_HINT_ICON_H * 0.5;

    const bloomKey = MOONFLOWER_ATLAS_KEYS.bloom;
    const swayKey = MOONFLOWER_ATLAS_KEYS.sway;
    const textureKey = this.textures.exists(bloomKey)
      ? bloomKey
      : this.textures.exists(swayKey)
        ? swayKey
        : null;

    const label = this.add
      .text(0, 0, 'Moonflower not Collected', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#b8d4e8',
      })
      .setOrigin(0, 0.5);

    let rowWidth = label.width;
    let icon: Phaser.GameObjects.Sprite | null = null;

    if (textureKey) {
      icon = this.add.sprite(0, lineY, textureKey, 'frame_000');
      icon.setOrigin(0.5, 0.5);
      const fit = MOONFLOWER_HINT_ICON_H / icon.height;
      icon.setDisplaySize(icon.width * fit, MOONFLOWER_HINT_ICON_H);
      icon.setAlpha(0.85);
      icon.setDepth(depth);
      icon.setScrollFactor(0);
      rowWidth = icon.displayWidth + gap + label.width;
    }

    const leftX = cx - rowWidth / 2;
    if (icon) {
      icon.setPosition(leftX + icon.displayWidth / 2, lineY);
      label.setPosition(leftX + icon.displayWidth + gap, lineY);
    } else {
      label.setPosition(cx, lineY);
      label.setOrigin(0.5, 0.5);
    }

    label.setDepth(depth).setScrollFactor(0);
  }

  /** Top Y reserved for action buttons — score card stays above this. */
  private getButtonAreaTop(outcome: GameOverOutcome): number {
    if (outcome === 'failed') {
      return GAME_HEIGHT - 228;
    }
    if (outcome === 'passed') {
      return PASSED_BTN_Y - 96 - MOONFLOWER_HINT_ROW_H;
    }
    return PASSED_BTN_Y - 96;
  }

  private fitScoreCard(
    cx: number,
    topY: number,
    buttonAreaTop: number,
    data: GameOverData,
    high: number,
    isNewScore: boolean,
    isNewTime: boolean,
  ): number {
    this.scoreCard = new EndScreenScoreCard(this, cx, topY, {
      score: data.score,
      highScore: high,
      stats: data.stats,
      isNewHighScore: isNewScore,
      isNewLongestTime: isNewTime,
      depth: DEPTH.ui,
    });

    const available = buttonAreaTop - SECTION_GAP - topY;
    if (this.scoreCard.height > available && available > 120) {
      const scale = Phaser.Math.Clamp(available / this.scoreCard.height, 0.82, 1);
      this.scoreCard.setScale(scale);
    }

    return this.scoreCard.bottom + SECTION_GAP;
  }

  private startRetryGame(): void {
    resetGameplayPointerSuppress();
    this.soundManager.resumeGameplaySfx();
    this.soundManager.tryUnlock();
    this.scene.start(SCENE_KEYS.game);
  }

  private createFailedButtons(cx: number): void {
    const retryY = GAME_HEIGHT - 168;
    const menuY = GAME_HEIGHT - 58;

    this.primaryButton = new FloatingAnimButton(
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
        onClick: () => this.startRetryGame(),
      },
    );

    this.createBackHomeLink(cx, menuY);
  }

  private createPassedButtons(cx: number): void {
    const halfSpread = (PASSED_BTN_WIDTH + PASSED_BTN_GAP) / 2;
    const retryX = cx - halfSpread;
    const nextX = cx + halfSpread;

    this.primaryButton = new FloatingAnimButton(
      this,
      retryX,
      PASSED_BTN_Y,
      ASSET_KEYS.uiRetry,
      null,
      {
        depth: DEPTH.ui,
        displayWidth: PASSED_BTN_WIDTH,
        autoFloat: false,
        floatPhaseMs: 0,
        interactive: true,
        onClick: () => this.startRetryGame(),
      },
    );

    this.secondaryButton = new FloatingAnimButton(
      this,
      nextX,
      PASSED_BTN_Y + PASSED_NEXT_LEVEL_BTN_Y_OFFSET,
      ASSET_KEYS.uiNextLevel,
      null,
      {
        depth: DEPTH.ui,
        displayWidth: PASSED_BTN_WIDTH,
        autoFloat: false,
        floatPhaseMs: 0,
        interactive: true,
        onClick: () => {
          this.soundManager.tryUnlock();
          this.bottomToast.show({ text: 'Next level coming soon' });
        },
      },
    );
  }

  private createBackHomeLink(cx: number, menuY: number): void {
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

    if (this.scoreCard) {
      this.scoreCard.root.setAlpha(0);
      this.tweens.add({
        targets: this.scoreCard.root,
        alpha: 1,
        duration: 420,
        delay: 120,
        ease: 'Sine.easeOut',
      });
    }

    this.primaryButton.playEntrance(this, 250);
    this.secondaryButton?.playEntrance(this, 380);
  }

  shutdown(): void {
    hidePlayerNameOverlay();
    AudioSession.getInstance().resetForSceneTransition();
    this.settingsDrawer?.destroy();
    this.settingsButton?.destroy();
    this.masterMuteButton?.destroy();
    this.scoreCard?.destroy();
    this.primaryButton?.destroy();
    this.secondaryButton?.destroy();
    this.bottomToast?.destroy();
    this.soundManager?.detach();
  }
}
