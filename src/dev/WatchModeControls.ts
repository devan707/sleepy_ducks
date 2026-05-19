import Phaser from 'phaser';
import { STAGE } from '../config/gameConfig';
import { captionTextStyle } from '../ui/uiChrome';
import {
  isWatchModeActive,
  isWatchModeUrlParam,
  setWatchMode,
  toggleWatchMode,
} from './watchMode';
import {
  isWatchTimePaused,
  toggleWatchTimePaused,
} from './watchTime';
import {
  isWatchInstructionsVisible,
  resetWatchInstructions,
  toggleWatchInstructionsVisible,
} from './watchInstructions';
import { isDevMode } from './isDevMode';

export type WatchModeControlsOptions = {
  onChange: (active: boolean) => void;
  onSkipTime: (deltaSec: number) => void;
  onInstructionsVisibleChange?: (visible: boolean) => void;
};

const BADGE_IDLE = 'WATCH — P pause · , +5s · . +15s · H hide help';
const BADGE_PAUSED = 'WATCH PAUSED — P resume · , +5s · . +15s · H hide help';

/**
 * Dev-only: W = watch mode; P / , / . control run time while watching.
 */
export class WatchModeControls {
  private readonly scene: Phaser.Scene;
  private readonly opts: WatchModeControlsOptions;
  private badge: Phaser.GameObjects.Text | null = null;
  private watchKey: Phaser.Input.Keyboard.Key | null = null;
  private pauseKey: Phaser.Input.Keyboard.Key | null = null;
  private skipSmallKey: Phaser.Input.Keyboard.Key | null = null;
  private skipLargeKey: Phaser.Input.Keyboard.Key | null = null;
  private helpKey: Phaser.Input.Keyboard.Key | null = null;
  private lastToggleMs = 0;
  private lastActionMs = 0;

  constructor(scene: Phaser.Scene, opts: WatchModeControlsOptions) {
    this.scene = scene;
    this.opts = opts;
    if (!isDevMode()) return;

    if (isWatchModeUrlParam()) {
      setWatchMode(true);
      this.opts.onChange(true);
    }

    this.badge = scene.add
      .text(scene.scale.width / 2, 12, BADGE_IDLE, captionTextStyle({
        fontSize: '10px',
        letterSpacing: 1,
        color: '#a8e8ff',
        backgroundColor: '#0a2230cc',
        padding: { x: 8, y: 4 },
      }))
      .setOrigin(0.5, 0)
      .setDepth(STAGE.hudDepth + 2)
      .setScrollFactor(0)
      .setVisible(isWatchModeActive() && isWatchInstructionsVisible());

    this.refreshBadge();

    const kb = scene.input.keyboard;
    if (!kb) return;

    this.watchKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.pauseKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.skipSmallKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.COMMA);
    this.skipLargeKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.PERIOD);
    this.helpKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.H);

    this.watchKey.on('down', this.onWatchKey, this);
    this.pauseKey.on('down', this.onPauseKey, this);
    this.skipSmallKey.on('down', this.onSkipSmall, this);
    this.skipLargeKey.on('down', this.onSkipLarge, this);
    this.helpKey.on('down', this.onHelpKey, this);

    this.syncInstructionsUi();
  }

  private onWatchKey(): void {
    const now = this.scene.time.now;
    if (now - this.lastToggleMs < 400) return;
    this.lastToggleMs = now;
    const active = toggleWatchMode();
    if (active) {
      resetWatchInstructions();
    }
    this.syncInstructionsUi();
    this.opts.onChange(active);
    this.refreshBadge();
    this.flashToggle(active);
  }

  private onHelpKey(): void {
    if (!this.consumeAction() || !isWatchModeActive()) return;
    const visible = toggleWatchInstructionsVisible();
    this.syncInstructionsUi();
    this.flashMessage(visible ? 'Help shown' : 'Help hidden');
  }

  private syncInstructionsUi(): void {
    const show = isWatchModeActive() && isWatchInstructionsVisible();
    this.badge?.setVisible(show);
    this.opts.onInstructionsVisibleChange?.(show);
  }

  private onPauseKey(): void {
    if (!this.consumeAction() || !isWatchModeActive()) return;
    toggleWatchTimePaused();
    this.refreshBadge();
    this.flashMessage(isWatchTimePaused() ? 'Time paused' : 'Time running');
  }

  private onSkipSmall(): void {
    if (!this.consumeAction() || !isWatchModeActive()) return;
    this.opts.onSkipTime(5);
    this.flashMessage('+5s');
  }

  private onSkipLarge(): void {
    if (!this.consumeAction() || !isWatchModeActive()) return;
    this.opts.onSkipTime(15);
    this.flashMessage('+15s');
  }

  private consumeAction(): boolean {
    const now = this.scene.time.now;
    if (now - this.lastActionMs < 200) return false;
    this.lastActionMs = now;
    return true;
  }

  private refreshBadge(): void {
    if (!this.badge) return;
    if (!isWatchModeActive()) return;
    this.badge.setText(isWatchTimePaused() ? BADGE_PAUSED : BADGE_IDLE);
  }

  private flashToggle(active: boolean): void {
    this.flashMessage(active ? 'Watch mode ON' : 'Watch mode OFF');
  }

  private flashMessage(msg: string): void {
    const t = this.scene.add
      .text(this.scene.scale.width / 2, 40, msg, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#a8e8ff',
        backgroundColor: '#00000099',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setDepth(STAGE.hudDepth + 3)
      .setScrollFactor(0);

    this.scene.tweens.add({
      targets: t,
      alpha: 0,
      y: 28,
      duration: 900,
      delay: 400,
      onComplete: () => t.destroy(),
    });
  }

  destroy(): void {
    this.watchKey?.off('down', this.onWatchKey, this);
    this.pauseKey?.off('down', this.onPauseKey, this);
    this.skipSmallKey?.off('down', this.onSkipSmall, this);
    this.skipLargeKey?.off('down', this.onSkipLarge, this);
    this.helpKey?.off('down', this.onHelpKey, this);
    this.badge?.destroy();
    this.badge = null;
  }
}
