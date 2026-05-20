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
  private icon: Phaser.GameObjects.Image | null = null;
  private unsubscribe: () => void;

  constructor(scene: Phaser.Scene, opts: MasterMuteButtonOptions) {
    this.scene = scene;

    const hit = scene.add
      .circle(0, 0, RADIUS + 6, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });

    this.icon = this.createIcon();
    this.container = scene.add.container(opts.x, opts.y, [this.icon, hit]);
    this.container.setDepth(opts.depth).setScrollFactor(0);
    if (opts.alpha !== undefined) {
      this.container.setAlpha(opts.alpha);
    }

    hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation();
      MasterMuteButton.suppressScenePointer = true;
      const muted = toggleMasterMuted();
      this.refreshIcon();
      this.playFeedback(muted);
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

    this.unsubscribe = subscribeMasterMute(() => this.refreshIcon());
  }

  private createIcon(): Phaser.GameObjects.Image {
    const key = isMasterMuted() ? ASSET_KEYS.uiSoundOff : ASSET_KEYS.uiSoundOn;
    const fallback = this.scene.textures.exists(key) ? key : ASSET_KEYS.uiGear;
    return this.scene.add
      .image(0, 0, fallback)
      .setDisplaySize(ICON_DISPLAY, ICON_DISPLAY)
      .setOrigin(0.5);
  }

  /** Re-create the icon image for the current mute state. */
  refreshIcon(): void {
    if (!this.icon) return;
    const key = isMasterMuted() ? ASSET_KEYS.uiSoundOff : ASSET_KEYS.uiSoundOn;
    if (!this.scene.textures.exists(key)) return;
    this.icon.setTexture(key);
    this.icon.setDisplaySize(ICON_DISPLAY, ICON_DISPLAY);
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
}

/** Below the menu/game-over gear. */
export function getMenuMasterMutePosition(gear: { x: number; y: number }): {
  x: number;
  y: number;
} {
  return { x: gear.x, y: gear.y + RADIUS * 2 + 8 };
}

/** Above the in-game gear (gear sits at bottom-right). */
export function getGameMasterMutePosition(gear: { x: number; y: number }): {
  x: number;
  y: number;
} {
  return { x: gear.x, y: gear.y - (RADIUS * 2 + 8) };
}
