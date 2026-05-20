import Phaser from 'phaser';
import { ASSET_KEYS } from '../config/assets';
import {
  isMasterMuted,
  subscribeMasterMute,
  toggleMasterMuted,
} from '../storage/masterMute';

const RADIUS = 22;
/** Match the gear's display size so they read as a stacked pair. */
const ICON_DISPLAY = 42;

export type MasterMuteButtonOptions = {
  x: number;
  y: number;
  depth: number;
  alpha?: number;
};

export class MasterMuteButton {
  private static suppressScenePointer = false;
  private static activeGameplayPos: { x: number; y: number } | null = null;

  /** Mirror of `SettingsButton.consumeSceneSuppress` so scenes can swallow taps. */
  static consumeSceneSuppress(): boolean {
    if (!MasterMuteButton.suppressScenePointer) return false;
    MasterMuteButton.suppressScenePointer = false;
    return true;
  }

  static resetSuppress(): void {
    MasterMuteButton.suppressScenePointer = false;
  }

  /** True when a gameplay tap lands on the mute button (exclude from miss penalty). */
  static hitsWorldPoint(worldX: number, worldY: number): boolean {
    const pos = MasterMuteButton.activeGameplayPos;
    if (!pos) return false;
    const r = RADIUS + 6;
    const dx = worldX - pos.x;
    const dy = worldY - pos.y;
    return dx * dx + dy * dy <= r * r;
  }

  static setActiveGameplayPosition(pos: { x: number; y: number } | null): void {
    MasterMuteButton.activeGameplayPos = pos;
  }

  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private readonly hit: Phaser.GameObjects.Arc;
  private iconOn: Phaser.GameObjects.Image;
  private iconOff: Phaser.GameObjects.Image;
  private fallbackIcon: Phaser.GameObjects.Image | null = null;
  private readonly depth: number;
  private unsubscribe: () => void;

  constructor(scene: Phaser.Scene, opts: MasterMuteButtonOptions) {
    this.scene = scene;
    this.depth = opts.depth;

    this.hit = scene.add
      .circle(0, 0, RADIUS + 6, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });

    const hasOn = scene.textures.exists(ASSET_KEYS.uiSoundOn);
    const hasOff = scene.textures.exists(ASSET_KEYS.uiSoundOff);

    if (hasOn && hasOff) {
      this.iconOn = scene.add
        .image(0, 0, ASSET_KEYS.uiSoundOn)
        .setDisplaySize(ICON_DISPLAY, ICON_DISPLAY)
        .setOrigin(0.5);
      this.iconOff = scene.add
        .image(0, 0, ASSET_KEYS.uiSoundOff)
        .setDisplaySize(ICON_DISPLAY, ICON_DISPLAY)
        .setOrigin(0.5);
      this.container = scene.add.container(opts.x, opts.y, [
        this.iconOn,
        this.iconOff,
        this.hit,
      ]);
    } else {
      const key = scene.textures.exists(ASSET_KEYS.uiGear)
        ? ASSET_KEYS.uiGear
        : hasOn
          ? ASSET_KEYS.uiSoundOn
          : ASSET_KEYS.uiSoundOff;
      this.fallbackIcon = scene.add
        .image(0, 0, key)
        .setDisplaySize(ICON_DISPLAY, ICON_DISPLAY)
        .setOrigin(0.5);
      this.iconOn = this.fallbackIcon;
      this.iconOff = this.fallbackIcon;
      this.container = scene.add.container(opts.x, opts.y, [this.fallbackIcon, this.hit]);
    }

    this.container.setDepth(opts.depth).setScrollFactor(0);
    if (opts.alpha !== undefined) {
      this.container.setAlpha(opts.alpha);
    }

    this.hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation();
      MasterMuteButton.suppressScenePointer = true;
      const muted = toggleMasterMuted();
      this.syncIcons();
      this.playFeedback(muted);
    });

    this.hit.on('pointerover', () => {
      scene.tweens.add({
        targets: this.container,
        scaleX: 1.06,
        scaleY: 1.06,
        duration: 90,
      });
    });
    this.hit.on('pointerout', () => {
      scene.tweens.add({
        targets: this.container,
        scaleX: 1,
        scaleY: 1,
        duration: 90,
      });
    });

    this.unsubscribe = subscribeMasterMute(() => this.syncIcons());
    this.syncIcons();
  }

  /** Keep the correct on/off art visible for the current mute state. */
  refreshIcon(): void {
    this.syncIcons();
  }

  private syncIcons(): void {
    if (this.fallbackIcon) {
      this.fallbackIcon.setAlpha(isMasterMuted() ? 0.55 : 1);
      return;
    }

    const muted = isMasterMuted();
    this.iconOn.setVisible(!muted);
    this.iconOff.setVisible(muted);
    this.container.setDepth(this.depth);
    if (this.scene.sys.isActive()) {
      this.scene.children.bringToTop(this.container);
    }
  }

  private playFeedback(muted: boolean): void {
    this.scene.tweens.add({
      targets: this.container,
      scaleX: muted ? 0.88 : 1.12,
      scaleY: muted ? 0.88 : 1.12,
      duration: 110,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  destroy(): void {
    this.unsubscribe();
    this.container.destroy();
  }

  setHidden(hidden: boolean): void {
    this.container.setVisible(!hidden);
  }
}

/** Below the menu/game-over gear. */
export function getMenuMasterMutePosition(gear: { x: number; y: number }): {
  x: number;
  y: number;
} {
  return { x: gear.x, y: gear.y + RADIUS * 2 + 8 };
}

/** Left of the in-game gear (same row, bottom-right). */
export function getGameMasterMutePosition(gear: { x: number; y: number }): {
  x: number;
  y: number;
} {
  return { x: gear.x - (RADIUS * 2 + 8), y: gear.y };
}
