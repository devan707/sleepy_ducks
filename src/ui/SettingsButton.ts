import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets';
import { GAME_HEIGHT, GAME_WIDTH, HUD_LAYOUT, HUD_TOP_PADDING } from '../config/gameConfig';
import { createCartoonGearIcon } from './CartoonGearIcon';
import { MasterMuteButton } from './MasterMuteButton';
import { SettingsDrawer } from './SettingsDrawer';

const RADIUS = 22;
const INSET_RIGHT = 12;
/** Display size for wood gear.png art. */
const GEAR_DISPLAY = 42;

export function getDefaultSettingsButtonPosition(): { x: number; y: number } {
  return {
    x: GAME_WIDTH - INSET_RIGHT - RADIUS,
    y: GAME_HEIGHT - HUD_LAYOUT.marginBottom - RADIUS,
  };
}

/** Title menu — top-right, inset from safe area. */
export function getMenuSettingsButtonPosition(): { x: number; y: number } {
  const inset = 20;
  return {
    x: GAME_WIDTH - inset - RADIUS,
    y: HUD_TOP_PADDING + RADIUS + 6,
  };
}

export type SettingsButtonOptions = {
  drawer: SettingsDrawer;
  depth: number;
  x?: number;
  y?: number;
  /** 0–1 gear opacity (e.g. menu overlay). */
  alpha?: number;
};

export class SettingsButton {
  private static suppressScenePointer = false;

  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private drawer: SettingsDrawer;
  private gearGraphic: Phaser.GameObjects.GameObject | null = null;

  static consumeSceneSuppress(): boolean {
    if (SettingsDrawer.consumeSceneSuppress()) return true;
    if (MasterMuteButton.consumeSceneSuppress()) return true;
    if (!SettingsButton.suppressScenePointer) return false;
    SettingsButton.suppressScenePointer = false;
    return true;
  }

  /** Swallow the scene-level pointerdown that follows a UI control tap. */
  static suppressNextScenePointer(): void {
    SettingsButton.suppressScenePointer = true;
  }

  static resetSuppress(): void {
    SettingsButton.suppressScenePointer = false;
  }

  /** True when a gameplay tap lands on the settings gear (exclude from empty-tap penalty). */
  static hitsWorldPoint(worldX: number, worldY: number): boolean {
    const pos = getDefaultSettingsButtonPosition();
    const r = RADIUS + 6;
    const dx = worldX - pos.x;
    const dy = worldY - pos.y;
    return dx * dx + dy * dy <= r * r;
  }

  constructor(scene: Phaser.Scene, opts: SettingsButtonOptions) {
    this.scene = scene;
    this.drawer = opts.drawer;

    const defaultPos = getDefaultSettingsButtonPosition();
    const x = opts.x ?? defaultPos.x;
    const y = opts.y ?? defaultPos.y;

    const hit = scene.add
      .circle(0, 0, RADIUS + 6, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });

    this.gearGraphic = this.createGearGraphic(scene);
    this.container = scene.add.container(x, y, [this.gearGraphic, hit]);
    this.container.setDepth(opts.depth).setScrollFactor(0);
    if (opts.alpha !== undefined) {
      this.container.setAlpha(opts.alpha);
    }

    hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation();
      SettingsButton.suppressScenePointer = true;
      this.drawer.toggle();
    });

    hit.on('pointerover', () => {
      scene.tweens.add({
        targets: this.container,
        scaleX: 1.06,
        scaleY: 1.06,
        duration: 90,
      });
    });
    hit.on('pointerout', () => {
      scene.tweens.add({
        targets: this.container,
        scaleX: 1,
        scaleY: 1,
        duration: 90,
      });
    });
  }

  /** Call after assets finish loading if the gear texture was missing at create. */
  refreshGearGraphic(): void {
    if (this.scene.textures.exists(ASSET_KEYS.uiGear)) {
      this.gearGraphic?.destroy();
      this.gearGraphic = this.createGearGraphic(this.scene);
      const hit = this.container.list[this.container.length - 1];
      this.container.removeAll(false);
      this.container.add([this.gearGraphic, hit]);
    }
  }

  private createGearGraphic(scene: Phaser.Scene): Phaser.GameObjects.GameObject {
    if (scene.textures.exists(ASSET_KEYS.uiGear)) {
      return scene.add
        .image(0, 0, ASSET_KEYS.uiGear)
        .setDisplaySize(GEAR_DISPLAY, GEAR_DISPLAY)
        .setOrigin(0.5);
    }

    const fallback = createCartoonGearIcon(scene, RADIUS - 2);
    const bg = scene.add.graphics();
    bg.fillStyle(0x0a2230, 0.82);
    bg.fillCircle(0, 0, RADIUS + 2);
    return scene.add.container(0, 0, [bg, fallback.setScale(0.92)]);
  }

  destroy(): void {
    this.container.destroy();
  }

  setHidden(hidden: boolean): void {
    this.container.setVisible(!hidden);
  }
}
