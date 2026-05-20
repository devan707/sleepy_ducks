import { MusicManager } from './MusicManager';
import { SoundManager } from './SoundManager';

export type AudioCategory =
  | 'tapFeedback'
  | 'gameplayEvent'
  | 'gameplayAmbient'
  | 'music';

export type AudioSessionDebugSnapshot = {
  appForeground: boolean;
  settingsOpen: boolean;
  unlocked: boolean;
};

let instance: AudioSession | null = null;

/**
 * Single source of truth for audio lifecycle gating (foreground, settings pause, unlock).
 * Mute and volume sliders stay in SoundManager / MusicManager — not handled here.
 */
export class AudioSession {
  private appForeground = typeof document === 'undefined' ? true : !document.hidden;
  private settingsOpen = false;
  private unlocked = false;
  private readonly devListeners = new Set<(snapshot: AudioSessionDebugSnapshot) => void>();

  static getInstance(): AudioSession {
    if (!instance) {
      instance = new AudioSession();
    }
    return instance;
  }

  syncForegroundFromDocument(): void {
    if (typeof document === 'undefined') return;
    const visible = !document.hidden;
    if (visible !== this.appForeground) {
      this.setForeground(visible);
    }
  }

  isForeground(): boolean {
    return this.appForeground;
  }

  isSettingsOpen(): boolean {
    return this.settingsOpen;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  /** Lifecycle blocking — master mute and volume sliders are not included. */
  isLifecycleBlocked(): boolean {
    return !this.appForeground || this.settingsOpen;
  }

  canPlay(_category: AudioCategory): boolean {
    if (!this.appForeground) return false;
    if (this.settingsOpen) return false;
    return true;
  }

  onUserGesture(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    this.notifyDev();
  }

  onSettingsOpen(open: boolean): void {
    if (this.settingsOpen === open) return;
    this.settingsOpen = open;
    this.notifyDev();

    const sound = SoundManager.getInstance();
    const music = MusicManager.getInstance();

    if (open) {
      sound.pauseForSettings();
      music.pauseForSettings();
    } else {
      sound.resumeFromSettings();
      music.resumeFromSettings();
    }
  }

  onForegroundChange(visible: boolean): void {
    this.setForeground(visible);
  }

  /** Clear stale blocks and resume engines when foregrounded and settings closed. */
  ensureReady(): void {
    if (this.isLifecycleBlocked()) return;
    SoundManager.getInstance().ensureLifecycleReady();
    MusicManager.getInstance().ensureLifecycleReady();
  }

  /** Scene start / transition — drop settings pause and sync foreground without resuming. */
  resetForSceneTransition(): void {
    this.settingsOpen = false;
    this.notifyDev();

    SoundManager.getInstance().resetSettingsPauseState();
    MusicManager.getInstance().resetSettingsPauseState();

    if (typeof document !== 'undefined' && document.hidden) {
      if (this.appForeground) {
        this.appForeground = false;
        this.notifyDev();
      }
      SoundManager.getInstance().pauseForBackground();
      MusicManager.getInstance().pauseForBackground();
      return;
    }

    this.appForeground = true;
    this.notifyDev();
    SoundManager.getInstance().clearBackgroundPauseOnly();
    MusicManager.getInstance().clearBackgroundPauseOnly();
  }

  /** Recover from a stuck settings pause (drawer closed but audio still paused). */
  forceResume(): void {
    this.settingsOpen = false;
    this.notifyDev();
    SoundManager.getInstance().forceResumePlayback();
    MusicManager.getInstance().forceResumePlayback();
  }

  getDebugSnapshot(): AudioSessionDebugSnapshot {
    return {
      appForeground: this.appForeground,
      settingsOpen: this.settingsOpen,
      unlocked: this.unlocked,
    };
  }

  subscribeDebug(listener: (snapshot: AudioSessionDebugSnapshot) => void): () => void {
    this.devListeners.add(listener);
    listener(this.getDebugSnapshot());
    return () => {
      this.devListeners.delete(listener);
    };
  }

  private setForeground(visible: boolean): void {
    if (this.appForeground === visible) return;
    this.appForeground = visible;
    this.notifyDev();

    const sound = SoundManager.getInstance();
    const music = MusicManager.getInstance();

    if (visible) {
      sound.resumeFromBackground();
      music.resumeFromBackground();
      this.ensureReady();
    } else {
      sound.pauseForBackground();
      music.pauseForBackground();
    }
  }

  private notifyDev(): void {
    if (this.devListeners.size === 0) return;
    const snapshot = this.getDebugSnapshot();
    for (const listener of this.devListeners) {
      listener(snapshot);
    }
  }
}

/** Dev-only: log session state whenever foreground/settings/unlock changes. */
export function initAudioSessionDevLog(): void {
  if (!import.meta.env.DEV) return;
  AudioSession.getInstance().subscribeDebug((snapshot) => {
    console.debug('[AudioSession]', snapshot);
  });
}
