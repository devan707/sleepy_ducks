import Phaser from 'phaser';
import { GAME_WIDTH, HUD_TOP_PADDING, STAGE } from '../config/gameConfig';
import { ensureLilitaFont, lilitaDisplayStyle } from './uiChrome';

const BANNER_Y = HUD_TOP_PADDING + 40;
const TITLE_FONT_SIZE_PX = 36;
const FOLLOW_UP_FONT_SIZE_PX = 30;
const RUN_TITLE_FONT_SIZE_PX = 44;
const RUN_SUBTITLE_FONT_SIZE_PX = 26;
/** Hold the title before swapping or fading out. */
const TITLE_VISIBLE_MS = 1600;
const TITLE_FADE_MS = 280;
const FOLLOW_UP_HOLD_MS = 2000;
const SINGLE_MESSAGE_HOLD_MS = 2000;
const FADE_OUT_MS = 320;
/** Opening title card — slower, no bounce. */
const RUN_TITLE_IN_MS = 700;
const RUN_SUBTITLE_DELAY_MS = 820;
const RUN_SUBTITLE_IN_MS = 520;
const RUN_BOTH_HOLD_MS = 1000;
const RUN_FADE_OUT_MS = 380;
const RUN_SUBTITLE_GAP = 1;

export type BannerAnimation = 'celebration' | 'titleIntro';

export type LevelPassedBannerOptions = {
  title: string;
  followUp?: string;
  animation?: BannerAnimation;
  titleFontSizePx?: number;
  titleColor?: string;
  titleStroke?: string;
  titleStrokeThickness?: number;
  /** Override delay before fade-out (single-message celebration only). */
  holdBeforeFadeMs?: number;
};

const celebrationTitleStyle = (options: LevelPassedBannerOptions) =>
  lilitaDisplayStyle({
    fontSize: `${options.titleFontSizePx ?? TITLE_FONT_SIZE_PX}px`,
    color: options.titleColor ?? '#fff4b8',
    stroke: options.titleStroke ?? '#1a0e08',
    strokeThickness: options.titleStrokeThickness ?? 7,
  });

const followUpStyle = () =>
  lilitaDisplayStyle({
    fontSize: `${FOLLOW_UP_FONT_SIZE_PX}px`,
    color: '#ffffff',
    stroke: '#1a0e08',
    strokeThickness: 6,
  });

const runTitleStyle = () =>
  lilitaDisplayStyle({
    fontSize: `${RUN_TITLE_FONT_SIZE_PX}px`,
    color: '#fff8dc',
    stroke: '#1a0e08',
    strokeThickness: 8,
  });

const runSubtitleStyle = () =>
  lilitaDisplayStyle({
    fontSize: `${RUN_SUBTITLE_FONT_SIZE_PX}px`,
    color: '#ecf8ff',
    stroke: '#1a0e08',
    strokeThickness: 5,
  });

/**
 * In-run Lilita banner — celebration pop or title-card intro, then fade.
 * Does not pause gameplay.
 */
export class LevelPassedBanner {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container | null = null;
  private holdTimer: Phaser.Time.TimerEvent | null = null;
  private swapTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(options: LevelPassedBannerOptions = {
    title: 'LEVEL PASSED!',
    followUp: 'Keep Going!',
    animation: 'celebration',
  }): void {
    if (options.animation === 'titleIntro') {
      this.showTitleIntro(options);
      return;
    }
    this.showCelebration(options);
  }

  /** Elastic pop — level pass, almost there, etc. */
  private showCelebration(options: LevelPassedBannerOptions): void {
    this.destroyExisting();

    const titleFontPx = options.titleFontSizePx ?? TITLE_FONT_SIZE_PX;
    const title = this.scene.add
      .text(0, 0, options.title, celebrationTitleStyle(options))
      .setOrigin(0.5, 0);

    const children: Phaser.GameObjects.GameObject[] = [title];
    let followUp: Phaser.GameObjects.Text | null = null;

    if (options.followUp) {
      followUp = this.scene.add
        .text(0, 0, options.followUp, followUpStyle())
        .setOrigin(0.5, 0)
        .setAlpha(0)
        .setScale(0.3)
        .setVisible(false);
      children.push(followUp);
      void ensureLilitaFont(followUp, FOLLOW_UP_FONT_SIZE_PX);
    }

    this.root = this.scene.add.container(GAME_WIDTH / 2, BANNER_Y, children);
    this.root
      .setDepth(STAGE.hudDepth + 20)
      .setScrollFactor(0)
      .setAlpha(0)
      .setScale(0.3);

    void ensureLilitaFont(title, titleFontPx);

    this.scene.tweens.add({
      targets: this.root,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 620,
      ease: 'Elastic.easeOut',
      easeParams: [1.2, 0.55],
    });

    if (!followUp) {
      const holdMs =
        options.holdBeforeFadeMs ?? TITLE_VISIBLE_MS + SINGLE_MESSAGE_HOLD_MS;
      this.holdTimer = this.scene.time.delayedCall(holdMs, () => this.fadeAndDestroy());
      return;
    }

    this.swapTimer = this.scene.time.delayedCall(TITLE_VISIBLE_MS, () => {
      this.swapTimer = null;
      if (!title.active || !followUp?.active) return;

      this.scene.tweens.add({
        targets: title,
        alpha: 0,
        scaleX: 0.85,
        scaleY: 0.85,
        duration: TITLE_FADE_MS,
        ease: 'Quad.easeIn',
        onComplete: () => {
          title.destroy();
          followUp!.setVisible(true);
          this.scene.tweens.add({
            targets: followUp,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 520,
            ease: 'Elastic.easeOut',
            easeParams: [1.15, 0.5],
            onComplete: () => {
              this.holdTimer = this.scene.time.delayedCall(
                FOLLOW_UP_HOLD_MS,
                () => this.fadeAndDestroy(),
              );
            },
          });
        },
      });
    });
  }

  /** Title on top, subtitle fades in below while title is still settling — then both exit together. */
  private showTitleIntro(options: LevelPassedBannerOptions): void {
    this.destroyExisting();

    const title = this.scene.add
      .text(0, 0, options.title, runTitleStyle())
      .setOrigin(0.5, 0)
      .setAlpha(0)
      .setY(-14);

    const children: Phaser.GameObjects.GameObject[] = [title];
    let followUp: Phaser.GameObjects.Text | null = null;
    let subtitleY = 0;

    if (options.followUp) {
      followUp = this.scene.add
        .text(0, 0, options.followUp, runSubtitleStyle())
        .setOrigin(0.5, 0)
        .setAlpha(0);
      children.push(followUp);
      void ensureLilitaFont(followUp, RUN_SUBTITLE_FONT_SIZE_PX);
      subtitleY = title.height + RUN_SUBTITLE_GAP;
      followUp.setY(subtitleY + 6);
    }

    this.root = this.scene.add.container(GAME_WIDTH / 2, BANNER_Y, children);
    this.root.setDepth(STAGE.hudDepth + 20).setScrollFactor(0);

    void ensureLilitaFont(title, RUN_TITLE_FONT_SIZE_PX);

    this.scene.tweens.add({
      targets: title,
      alpha: 1,
      y: 0,
      duration: RUN_TITLE_IN_MS,
      ease: 'Cubic.easeOut',
    });

    if (!followUp) {
      this.holdTimer = this.scene.time.delayedCall(
        RUN_TITLE_IN_MS + RUN_BOTH_HOLD_MS,
        () => this.fadeTitleIntro(),
      );
      return;
    }

    this.swapTimer = this.scene.time.delayedCall(RUN_SUBTITLE_DELAY_MS, () => {
      this.swapTimer = null;
      if (!followUp?.active) return;

      this.scene.tweens.add({
        targets: followUp,
        alpha: 1,
        y: subtitleY,
        duration: RUN_SUBTITLE_IN_MS,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.holdTimer = this.scene.time.delayedCall(
            RUN_BOTH_HOLD_MS,
            () => this.fadeTitleIntro(),
          );
        },
      });
    });
  }

  private fadeAndDestroy(): void {
    if (!this.root) return;
    this.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: FADE_OUT_MS,
      ease: 'Quad.easeIn',
      onComplete: () => this.destroyExisting(),
    });
  }

  private fadeTitleIntro(): void {
    if (!this.root) return;
    this.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      y: BANNER_Y - 10,
      duration: RUN_FADE_OUT_MS,
      ease: 'Sine.easeIn',
      onComplete: () => this.destroyExisting(),
    });
  }

  private destroyExisting(): void {
    this.holdTimer?.remove(false);
    this.holdTimer = null;
    this.swapTimer?.remove(false);
    this.swapTimer = null;
    this.root?.destroy();
    this.root = null;
  }

  destroy(): void {
    this.destroyExisting();
  }
}
