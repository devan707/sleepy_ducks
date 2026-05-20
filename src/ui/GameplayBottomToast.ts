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
  fontSize?: string;
  panelHeight?: number;
  panelMinWidth?: number;
  panelMarginX?: number;
  /** Override visible hold time after fade-in (ms). */
  holdMs?: number;
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
      fontSize = GAMEPLAY_TOAST.fontSize,
      panelHeight = GAMEPLAY_TOAST.panelHeight,
      panelMinWidth = GAMEPLAY_TOAST.panelMinWidth,
      panelMarginX = GAMEPLAY_TOAST.panelMarginX,
      holdMs = GAMEPLAY_TOAST.holdMs,
      onComplete,
    } = opts;

    const fadeInMs = GAMEPLAY_TOAST.fadeInMs;
    const fadeOutMs = GAMEPLAY_TOAST.fadeOutMs;

    const cx = GAME_WIDTH / 2;
    const cy = getGameplayToastY();
    const root = this.scene.add.container(0, 0);
    root.setDepth(STAGE.depthGameplayToast).setScrollFactor(0).setAlpha(0);

    const maxPanelW = GAME_WIDTH - panelMarginX * 2;
    const iconSize = imageKey ? imageHeight : 0;
    const iconGap = iconSize > 0 ? GAMEPLAY_TOAST.imageGap : 0;
    const maxTextW = maxPanelW - GAMEPLAY_TOAST.panelPadX * 2 - iconSize - iconGap;

    const label = this.scene.add
      .text(0, 0, text, captionTextStyle({
        fontSize,
        color: '#ecf8ff',
        align: 'center',
        strokeThickness: 3,
        wordWrap: { width: maxTextW, useAdvancedWrap: true },
      }))
      .setOrigin(0.5, 0.5);

    let icon: Phaser.GameObjects.Sprite | null = null;
    if (imageKey && this.scene.textures.exists(imageKey)) {
      icon = this.scene.add.sprite(0, 0, imageKey, imageFrame);
      const frame = icon.frame;
      const fit = iconSize / frame.height;
      icon.setDisplaySize(frame.width * fit, frame.height * fit);
      icon.setOrigin(0.5);
      if (
        imageKey.includes('moonflower') &&
        this.scene.anims.exists(MOONFLOWER_ANIM_KEYS.sway)
      ) {
        icon.play(MOONFLOWER_ANIM_KEYS.sway);
      }
    }

    const textW = label.width;
    const contentW = iconSize + iconGap + textW;
    const panelW = Phaser.Math.Clamp(
      contentW + GAMEPLAY_TOAST.panelPadX * 2,
      panelMinWidth,
      maxPanelW,
    );
    const panelLeft = cx - panelW / 2;
    const panelRadius = GAMEPLAY_TOAST.panelRadius;

    const panel = this.scene.add.graphics();
    panel.fillStyle(0x0a1824, GAMEPLAY_TOAST.panelAlpha);
    panel.fillRoundedRect(panelLeft, cy - panelHeight / 2, panelW, panelHeight, panelRadius);
    panel.lineStyle(2, 0xffffff, 0.28);
    panel.strokeRoundedRect(panelLeft, cy - panelHeight / 2, panelW, panelHeight, panelRadius);

    const contentStartX = cx - contentW / 2;
    if (icon) {
      icon.setPosition(contentStartX + iconSize / 2, cy);
      label.setPosition(contentStartX + iconSize + iconGap + textW / 2, cy);
    } else {
      label.setPosition(cx, cy);
    }

    const children: Phaser.GameObjects.GameObject[] = [panel, label];
    if (icon) children.push(icon);
    root.add(children);
    this.root = root;
    this.scene.children.bringToTop(root);

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
