import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets';
import { getCharmDefinition, type CharmId } from '../config/charmConfig';
import { CHARM_REVEAL, GAME_HEIGHT, GAME_WIDTH, STAGE } from '../config/gameConfig';
import { MOONFLOWER_ATLAS_KEYS } from '../config/moonflowerAssets';
import { collectCharm, getCollectedCharmCount } from '../storage/charms';
import { CharmsGrid } from './CharmsGrid';
import { outlinedTextStyle } from './uiChrome';

export type CharmBoxRevealOptions = {
  charmId: CharmId;
  fromWorldX: number;
  fromWorldY: number;
  onComplete: () => void;
};

export class CharmBoxReveal {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container;
  private backdrop: Phaser.GameObjects.Rectangle;
  private flyingIcon: Phaser.GameObjects.Image | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.root = scene.add.container(0, 0);
    this.root.setDepth(STAGE.depthCharmReveal).setScrollFactor(0).setVisible(false);

    this.backdrop = scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x02040c,
      0,
    );
    this.root.add(this.backdrop);
  }

  show(opts: CharmBoxRevealOptions): void {
    const def = getCharmDefinition(opts.charmId);
    const slotIndex = def.slotIndex;
    collectCharm(opts.charmId, slotIndex);

    this.root.setVisible(true);
    this.root.setAlpha(1);
    this.backdrop.setAlpha(0);

    const boxY = GAME_HEIGHT - CHARM_REVEAL.boxBottomY;
    const box = this.scene.add.image(GAME_WIDTH / 2, boxY, ASSET_KEYS.charmBox);
    box.setAlpha(0);
    const boxScale = Math.min(1, (GAME_WIDTH - 32) / box.width);
    box.setScale(boxScale);

    const grid = new CharmsGrid(this.scene, {
      centerX: GAME_WIDTH / 2,
      centerY: boxY,
      scale: boxScale,
      highlightSlot: slotIndex,
      showLocked: true,
    });

    const count = getCollectedCharmCount();
    const title = this.scene.add
      .text(GAME_WIDTH / 2, boxY - box.displayHeight * 0.5 - 36, `Collected ${count}/6 charms`, outlinedTextStyle({
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ecf0f1',
      }))
      .setOrigin(0.5)
      .setAlpha(0);

    const subtitle = this.scene.add
      .text(GAME_WIDTH / 2, boxY - box.displayHeight * 0.5 - 12, def.name, outlinedTextStyle({
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#a8e8ff',
      }))
      .setOrigin(0.5)
      .setAlpha(0);

    this.root.add([box, grid, title, subtitle]);

    const iconKey = def.iconAtlasKey;
    const iconFrame = def.iconFrame;
    if (this.scene.textures.exists(iconKey)) {
      this.flyingIcon = this.scene.add.image(opts.fromWorldX, opts.fromWorldY, iconKey, iconFrame);
      this.flyingIcon.setDepth(STAGE.depthCharmReveal + 1);
      this.flyingIcon.setScrollFactor(0);
      const frame = this.flyingIcon.frame;
      const fit = 48 / Math.max(frame.height, frame.width);
      this.flyingIcon.setDisplaySize(frame.width * fit, frame.height * fit);
    }

    this.scene.tweens.add({
      targets: this.backdrop,
      alpha: 0.45,
      duration: CHARM_REVEAL.fadeInMs,
    });
    this.scene.tweens.add({
      targets: [box, title, subtitle],
      alpha: 1,
      duration: CHARM_REVEAL.fadeInMs,
    });

    const slotWorld = grid.getSlotWorldPosition(slotIndex);

    const finishFly = () => {
      grid.setSlotIcon(slotIndex, opts.charmId);
      this.flyingIcon?.destroy();
      this.flyingIcon = null;

      this.scene.time.delayedCall(CHARM_REVEAL.holdMs, () => {
        this.scene.tweens.add({
          targets: this.root,
          alpha: 0,
          duration: CHARM_REVEAL.fadeOutMs,
          onComplete: () => {
            this.clearRootChildren();
            this.root.setVisible(false);
            opts.onComplete();
          },
        });
      });
    };

    if (this.flyingIcon) {
      this.scene.tweens.add({
        targets: this.flyingIcon,
        x: slotWorld.x,
        y: slotWorld.y,
        duration: CHARM_REVEAL.flyToSlotMs,
        ease: 'Cubic.easeInOut',
        onComplete: finishFly,
      });
    } else {
      finishFly();
    }
  }

  private clearRootChildren(): void {
    const children = [...this.root.list];
    for (const child of children) {
      if (child === this.backdrop) continue;
      child.destroy();
    }
  }

  destroy(): void {
    this.flyingIcon?.destroy();
    this.root.destroy();
  }
}

/** Icon for settings when sway atlas is missing. */
export function createCharmIconPreview(
  scene: Phaser.Scene,
  x: number,
  y: number,
  charmId: CharmId,
): Phaser.GameObjects.Image | null {
  const def = getCharmDefinition(charmId);
  const key = scene.textures.exists(def.iconAtlasKey)
    ? def.iconAtlasKey
    : MOONFLOWER_ATLAS_KEYS.sprout;
  if (!scene.textures.exists(key)) return null;
  const img = scene.add.image(x, y, key, def.iconFrame);
  const frame = img.frame;
  const fit = 32 / Math.max(frame.height, frame.width);
  img.setDisplaySize(frame.width * fit, frame.height * fit);
  return img;
}
