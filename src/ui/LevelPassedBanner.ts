import Phaser from 'phaser';
import { GAME_WIDTH, HUD_TOP_PADDING, STAGE } from '../config/gameConfig';
import { ensureLilitaFont, lilitaDisplayStyle } from './uiChrome';

const BANNER_Y = HUD_TOP_PADDING + 40;
const TITLE_FONT_SIZE_PX = 36;
const FOLLOW_UP_FONT_SIZE_PX = 30;
/** Hold "LEVEL PASSED!" before swapping to the follow-up. */
const TITLE_VISIBLE_MS = 1600;
const TITLE_FADE_MS = 280;
const FOLLOW_UP_HOLD_MS = 2000;
const FADE_OUT_MS = 320;

const titleStyle = () =>
  lilitaDisplayStyle({
    fontSize: `${TITLE_FONT_SIZE_PX}px`,
    color: '#fff4b8',
    stroke: '#1a0e08',
    strokeThickness: 7,
  });

const followUpStyle = () =>
  lilitaDisplayStyle({
    fontSize: `${FOLLOW_UP_FONT_SIZE_PX}px`,
    color: '#ffffff',
    stroke: '#1a0e08',
    strokeThickness: 6,
  });

/**
 * In-run celebration banner — pops in elastically when nightfall begins,
 * swaps to "Keep Going!" in the same spot, then fades. Does not pause gameplay.
 */
export class LevelPassedBanner {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container | null = null;
  private holdTimer: Phaser.Time.TimerEvent | null = null;
  private swapTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(): void {
    this.destroyExisting();

    const title = this.scene.add
      .text(0, 0, 'LEVEL PASSED!', titleStyle())
      .setOrigin(0.5, 0);

    const followUp = this.scene.add
      .text(0, 0, 'Keep Going!', followUpStyle())
      .setOrigin(0.5, 0)
      .setAlpha(0)
      .setScale(0.3)
      .setVisible(false);

    this.root = this.scene.add.container(GAME_WIDTH / 2, BANNER_Y, [title, followUp]);
    this.root
      .setDepth(STAGE.hudDepth + 20)
      .setScrollFactor(0)
      .setAlpha(0)
      .setScale(0.3);

    void ensureLilitaFont(title, TITLE_FONT_SIZE_PX);
    void ensureLilitaFont(followUp, FOLLOW_UP_FONT_SIZE_PX);

    this.scene.tweens.add({
      targets: this.root,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 620,
      ease: 'Elastic.easeOut',
      easeParams: [1.2, 0.55],
    });

    this.swapTimer = this.scene.time.delayedCall(TITLE_VISIBLE_MS, () => {
      this.swapTimer = null;
      if (!title.active || !followUp.active) return;

      this.scene.tweens.add({
        targets: title,
        alpha: 0,
        scaleX: 0.85,
        scaleY: 0.85,
        duration: TITLE_FADE_MS,
        ease: 'Quad.easeIn',
        onComplete: () => {
          title.destroy();
          followUp.setVisible(true);
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
