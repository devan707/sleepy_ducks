import Phaser from 'phaser';
import { MOONFLOWER_ANIM_KEYS } from '../config/moonflowerAssets';
import { GAMEPLAY_TOAST, GAME_WIDTH, STAGE, getGameplayToastY } from '../config/gameConfig';
import { captionTextStyle } from './uiChrome';

export type GameplayBottomToastOptions = {
  text: string;
  /** Atlas or image texture key for a small left icon. */
  imageKey?: string;
  imageFrame?: string;
  imageHeight?: number;
  durationMs?: number;
  onComplete?: () => void;
};

/**
 * Semi-transparent bottom toast — short, non-blocking, above gameplay layers.
 */
export class GameplayBottomToast {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container | null = null;
  private dismissTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(opts: GameplayBottomToastOptions): void {
    this.dismiss();

    const {
      text,
      imageKey,
      imageFrame,
      imageHeight = GAMEPLAY_TOAST.imageSize,
      durationMs = GAMEPLAY_TOAST.durationMs,
      onComplete,
    } = opts;

    const cx = GAME_WIDTH / 2;
    const cy = getGameplayToastY();
    const root = this.scene.add.container(0, 0);
    root.setDepth(STAGE.depthGameplayToast).setScrollFactor(0).setAlpha(0);

    const label = this.scene.add
      .text(0, 0, text, captionTextStyle({
        fontSize: '14px',
        color: '#ecf8ff',
        align: 'center',
        strokeThickness: 0,
        wordWrap: { width: GAME_WIDTH - 48, useAdvancedWrap: true },
      }))
      .setOrigin(0, 0.5);

    let icon: Phaser.GameObjects.Sprite | null = null;
    if (imageKey && this.scene.textures.exists(imageKey)) {
      icon = this.scene.add.sprite(0, cy, imageKey, imageFrame);
      const frame = icon.frame;
      const fit = imageHeight / frame.height;
      icon.setDisplaySize(frame.width * fit, frame.height * fit);
      icon.setOrigin(0.5);
      if (
        imageKey.includes('moonflower') &&
        this.scene.anims.exists(MOONFLOWER_ANIM_KEYS.sway)
      ) {
        icon.play(MOONFLOWER_ANIM_KEYS.sway);
      }
    }

    const iconW = icon ? imageHeight + GAMEPLAY_TOAST.imageGap : 0;
    const contentW = iconW + label.width;
    const panelW = Math.max(GAMEPLAY_TOAST.panelMinWidth, contentW + GAMEPLAY_TOAST.panelPadX * 2);
    const panelH = GAMEPLAY_TOAST.panelHeight;
    const panelLeft = cx - panelW / 2;

    const panel = this.scene.add.graphics();
    panel.fillStyle(0x0a1824, GAMEPLAY_TOAST.panelAlpha);
    panel.fillRoundedRect(panelLeft, cy - panelH / 2, panelW, panelH, 14);
    panel.lineStyle(1.5, 0xffffff, 0.18);
    panel.strokeRoundedRect(panelLeft, cy - panelH / 2, panelW, panelH, 14);

    const contentLeft = panelLeft + (panelW - contentW) / 2;
    if (icon) {
      icon.setPosition(contentLeft + imageHeight / 2, cy);
      label.setPosition(contentLeft + iconW, cy);
    } else {
      label.setOrigin(0.5, 0.5);
      label.setPosition(cx, cy);
    }

    const children: Phaser.GameObjects.GameObject[] = [panel, label];
    if (icon) children.push(icon);
    root.add(children);
    this.root = root;
    this.scene.children.bringToTop(root);

    const fadeInMs = GAMEPLAY_TOAST.fadeInMs;
    const fadeOutMs = GAMEPLAY_TOAST.fadeOutMs;
    const holdMs = Math.max(0, durationMs - fadeInMs - fadeOutMs);

    this.scene.tweens.add({
      targets: root,
      alpha: 1,
      duration: fadeInMs,
      ease: 'Sine.easeOut',
    });

    this.dismissTimer = this.scene.time.delayedCall(fadeInMs + holdMs, () => {
      this.dismissTimer = null;
      if (!this.root) return;
      this.scene.tweens.add({
        targets: root,
        alpha: 0,
        duration: fadeOutMs,
        ease: 'Sine.easeIn',
        onComplete: () => {
          this.dismiss();
          onComplete?.();
        },
      });
    });
  }

  destroy(): void {
    this.dismiss();
  }

  private dismiss(): void {
    this.dismissTimer?.remove(false);
    this.dismissTimer = null;
    this.root?.destroy();
    this.root = null;
  }
}
