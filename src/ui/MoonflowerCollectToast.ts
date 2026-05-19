import Phaser from 'phaser';
import { MOONFLOWER_ATLAS_KEYS, MOONFLOWER_ANIM_KEYS } from '../config/moonflowerAssets';
import { MOONFLOWER_COLLECT_TOAST, GAME_WIDTH, STAGE } from '../config/gameConfig';
import { collectCharm } from '../storage/charms';
import { captionTextStyle, titleTextStyle } from './uiChrome';

export type MoonflowerCollectToastOptions = {
  onComplete?: () => void;
};

/** Brief, non-blocking moonflower collect celebration — gameplay continues. */
export class MoonflowerCollectToast {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(opts: MoonflowerCollectToastOptions = {}): void {
    this.dismiss();
    collectCharm('moonflower', 0);

    const cx = GAME_WIDTH / 2;
    const cy = MOONFLOWER_COLLECT_TOAST.y;
    const root = this.scene.add.container(0, 0);
    root.setDepth(STAGE.depthCharmReveal).setScrollFactor(0).setAlpha(0);

    const panel = this.scene.add.graphics();
    const panelW = MOONFLOWER_COLLECT_TOAST.panelWidth;
    const panelH = MOONFLOWER_COLLECT_TOAST.panelHeight;
    const panelLeft = cx - panelW / 2;
    panel.fillStyle(0x0a1824, MOONFLOWER_COLLECT_TOAST.panelAlpha);
    panel.fillRoundedRect(panelLeft, cy - panelH / 2, panelW, panelH, 18);
    panel.lineStyle(2, 0xa8e8ff, 0.35);
    panel.strokeRoundedRect(panelLeft, cy - panelH / 2, panelW, panelH, 18);

    const flower = this.createFlowerSprite(
      panelLeft + MOONFLOWER_COLLECT_TOAST.flowerInsetLeft,
      cy,
    );
    const textX = panelLeft + MOONFLOWER_COLLECT_TOAST.textInsetLeft;
    const textW =
      panelW -
      MOONFLOWER_COLLECT_TOAST.textInsetLeft -
      MOONFLOWER_COLLECT_TOAST.textInsetRight;

    const label = this.scene.add
      .text(textX, cy - 14, 'Moonflower', titleTextStyle({
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ecf8ff',
        strokeThickness: 0,
        wordWrap: { width: textW, useAdvancedWrap: true },
      }))
      .setOrigin(0, 0.5);
    const caption = this.scene.add
      .text(textX, cy + 12, 'Night charm collected', captionTextStyle({
        fontSize: '10px',
        letterSpacing: 0.5,
        color: '#8ec8e0',
        strokeThickness: 0,
        wordWrap: { width: textW, useAdvancedWrap: true },
      }))
      .setOrigin(0, 0.5);

    root.add([panel, flower, label, caption]);
    this.root = root;

    root.setScale(MOONFLOWER_COLLECT_TOAST.startScale);
    this.scene.tweens.add({
      targets: root,
      alpha: 1,
      scale: 1,
      duration: MOONFLOWER_COLLECT_TOAST.fadeInMs,
      ease: 'Back.easeOut',
    });

    this.scene.time.delayedCall(MOONFLOWER_COLLECT_TOAST.holdMs, () => {
      if (!this.root) return;
      this.scene.tweens.add({
        targets: root,
        alpha: 0,
        y: -16,
        duration: MOONFLOWER_COLLECT_TOAST.fadeOutMs,
        ease: 'Sine.easeIn',
        onComplete: () => {
          this.dismiss();
          opts.onComplete?.();
        },
      });
    });
  }

  destroy(): void {
    this.dismiss();
  }

  private createFlowerSprite(x: number, y: number): Phaser.GameObjects.Sprite {
    const key = this.scene.textures.exists(MOONFLOWER_ATLAS_KEYS.sway)
      ? MOONFLOWER_ATLAS_KEYS.sway
      : MOONFLOWER_ATLAS_KEYS.bloom;
    const sprite = this.scene.add.sprite(x, y, key);
    const frame = sprite.frame;
    const fit = MOONFLOWER_COLLECT_TOAST.flowerHeight / frame.height;
    sprite.setDisplaySize(frame.width * fit, frame.height * fit);
    if (this.scene.anims.exists(MOONFLOWER_ANIM_KEYS.sway)) {
      sprite.play(MOONFLOWER_ANIM_KEYS.sway);
    }
    return sprite;
  }

  private dismiss(): void {
    this.root?.destroy();
    this.root = null;
  }
}
