import { DAY_NIGHT } from '../config/gameConfig';
import {
  GAME_OVER_MUSIC_URL,
  GAMEPLAY_MUSIC_URL,
  GAMEPLAY_NIGHT_MUSIC_URL,
  MENU_UI_MUSIC_URL,
} from './musicPaths';
import {
  getMusicVolume,
  isMusicEnabled,
  setMusicEnabled,
  setMusicVolume as persistMusicVolume,
} from '../storage/audioSettings';

export type MusicTrack = 'menuUi' | 'gameplay' | 'gameplayNight' | 'gameOver';

let instance: MusicManager | null = null;

export class MusicManager {
  private readonly clips: Record<MusicTrack, HTMLAudioElement>;
  private activeTrack: MusicTrack | null = null;
  private musicEnabled = isMusicEnabled();
  /** Set after first user gesture — retries playback when clips finish buffering. */
  private userGestureUnlocked = false;
  private gameplayNightCrossfaded = false;
  private gameplayMusicTimelineActive = false;
  private nightTrackStarted = false;
  /** Settings drawer, tab hidden, etc. — resume only when this returns to 0. */
  private playbackInterruptionCount = 0;

  private constructor() {
    this.clips = {
      menuUi: this.createClip(MENU_UI_MUSIC_URL),
      gameplay: this.createClip(GAMEPLAY_MUSIC_URL),
      gameplayNight: this.createClip(GAMEPLAY_NIGHT_MUSIC_URL),
      gameOver: this.createClip(GAME_OVER_MUSIC_URL),
    };
    this.clips.menuUi.load();
    this.applyClipVolumes();
  }

  private isPlaybackBlocked(): boolean {
    if (this.playbackInterruptionCount > 0) return true;
    return typeof document !== 'undefined' && document.hidden;
  }

  /** Pause music while gameplay/UI is interrupted (settings, hidden tab). */
  pauseForInterruption(): void {
    this.playbackInterruptionCount += 1;
    if (this.playbackInterruptionCount === 1) {
      this.pauseAll();
    }
  }

  resumeFromInterruption(): void {
    if (this.playbackInterruptionCount <= 0) return;
    this.playbackInterruptionCount -= 1;
    if (this.playbackInterruptionCount === 0) {
      this.tryResumeActiveTrack();
    }
  }

  /** Call when leaving a scene so the next scene can start fresh playback. */
  clearPlaybackInterruptions(): void {
    this.playbackInterruptionCount = 0;
  }

  private tryResumeActiveTrack(): void {
    if (this.isPlaybackBlocked()) return;
    if (!this.musicEnabled || !this.activeTrack) return;

    if (this.activeTrack === 'gameplayNight') {
      this.play('gameplayNight');
    } else {
      this.play(this.activeTrack);
    }
  }

  static getInstance(): MusicManager {
    if (!instance) {
      instance = new MusicManager();
    }
    return instance;
  }

  /**
   * Start menu music as soon as the app bundle loads (during Phaser preload),
   * instead of waiting for MenuScene.
   */
  static startEarly(): void {
    const mgr = MusicManager.getInstance();
    mgr.activeTrack = 'menuUi';
    mgr.preloadAll();
    mgr.play('menuUi');
  }

  private createClip(url: string): HTMLAudioElement {
    const clip = new Audio(url);
    clip.preload = 'auto';
    clip.loop = true;
    clip.volume = getMusicVolume();
    return clip;
  }

  private getTrackStartSec(track: MusicTrack): number {
    if (track === 'gameplayNight') return DAY_NIGHT.gameplayNightStartSec;
    return 0;
  }

  private seekTrackToStart(clip: HTMLAudioElement, track: MusicTrack): void {
    const startSec = this.getTrackStartSec(track);
    if (startSec <= 0) {
      clip.currentTime = 0;
      return;
    }
    const { duration } = clip;
    if (Number.isFinite(duration) && duration > startSec) {
      clip.currentTime = startSec;
    } else {
      clip.currentTime = startSec;
    }
  }

  private fadeT(elapsedSec: number, startSec: number, endSec: number): number {
    if (elapsedSec <= startSec) return 0;
    if (elapsedSec >= endSec) return 1;
    return (elapsedSec - startSec) / (endSec - startSec);
  }

  private isManagingGameplayCrossfade(): boolean {
    return this.gameplayMusicTimelineActive && !this.gameplayNightCrossfaded;
  }

  private resetGameplayCrossfadeState(): void {
    this.gameplayMusicTimelineActive = false;
    this.nightTrackStarted = false;
  }

  private applyClipVolumes(): void {
    if (this.isManagingGameplayCrossfade()) return;
    const volume = getMusicVolume();
    for (const clip of Object.values(this.clips)) {
      clip.volume = volume;
    }
    this.musicEnabled = volume > 0.001;
  }

  getMusicVolume(): number {
    return getMusicVolume();
  }

  setMusicVolume(volume: number): void {
    persistMusicVolume(volume);
    this.applyClipVolumes();
    if (!this.musicEnabled) {
      this.pauseAll();
      return;
    }
    if (this.activeTrack) {
      this.play(this.activeTrack);
    }
  }

  isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  setMusicEnabled(enabled: boolean): void {
    setMusicEnabled(enabled);
    this.applyClipVolumes();
    if (!this.musicEnabled) {
      this.resetGameplayCrossfadeState();
      this.pauseAll();
      this.activeTrack = null;
      return;
    }
    if (this.activeTrack) {
      this.play(this.activeTrack);
    }
  }

  getActiveTrack(): MusicTrack | null {
    return this.activeTrack;
  }

  /** True when the active clip is actually audible (not blocked or still buffering). */
  isActiveTrackPlaying(): boolean {
    if (!this.activeTrack || !this.musicEnabled || this.isPlaybackBlocked()) return false;
    const clip = this.clips[this.activeTrack];
    return !clip.paused && !clip.ended && clip.currentTime > 0;
  }

  private preloadAll(): void {
    for (const clip of Object.values(this.clips)) {
      if (clip.readyState < HTMLMediaElement.HAVE_METADATA) {
        clip.load();
      }
    }
  }

  /** Preload clips during a user gesture (mobile unlock). */
  tryUnlock(): void {
    this.userGestureUnlocked = true;
    this.preloadAll();
    if (!this.musicEnabled) return;
    if (!this.activeTrack) {
      this.activeTrack = 'menuUi';
    }
    if (this.activeTrack === 'gameplayNight') {
      this.play('gameplayNight');
    } else {
      this.play(this.activeTrack);
    }
  }

  playMenuUi(): void {
    this.resetGameplayCrossfadeState();
    this.gameplayNightCrossfaded = false;
    this.play('menuUi');
  }

  playGameplay(): void {
    this.resetGameplayCrossfadeState();
    this.gameplayNightCrossfaded = false;
    this.play('gameplay');
  }

  /**
   * Drive day→night music from game elapsed time (pauses with gameplay).
   * Day: full → fade out 40s–48s. Night: fade in 45s–50s from loop offset.
   */
  updateGameplayMusicCrossfade(elapsedSec: number): void {
    if (this.isPlaybackBlocked()) return;
    if (!this.musicEnabled || this.gameplayNightCrossfaded) return;
    if (this.activeTrack !== 'gameplay' && !this.gameplayMusicTimelineActive) return;

    const {
      gameplayDayMusicFadeOutStartSec: dayStart,
      gameplayDayMusicFadeOutEndSec: dayEnd,
      gameplayNightMusicFadeInStartSec: nightStart,
      gameplayNightMusicFadeInEndSec: nightEnd,
    } = DAY_NIGHT;

    if (elapsedSec < dayStart) return;

    this.gameplayMusicTimelineActive = true;

    const from = this.clips.gameplay;
    const to = this.clips.gameplayNight;
    const targetVol = getMusicVolume();
    const dayFade = this.fadeT(elapsedSec, dayStart, dayEnd);
    const dayVol = targetVol * (1 - dayFade);

    if (dayFade >= 1) {
      from.pause();
      from.currentTime = 0;
      from.volume = 0;
    } else {
      from.volume = dayVol;
      if (from.paused && dayVol > 0) {
        void from.play().catch(() => {
          /* Autoplay blocked until gesture. */
        });
      }
    }

    if (elapsedSec < nightStart) {
      to.pause();
      to.volume = 0;
      return;
    }

    if (!this.nightTrackStarted) {
      this.nightTrackStarted = true;
      this.seekTrackToStart(to, 'gameplayNight');
      to.volume = 0;
      void to.play().catch(() => {
        /* Autoplay blocked until gesture. */
      });
    }

    const nightFade = this.fadeT(elapsedSec, nightStart, nightEnd);
    to.volume = targetVol * nightFade;

    if (nightFade >= 1) {
      from.pause();
      from.currentTime = 0;
      from.volume = targetVol;
      to.volume = targetVol;
      this.activeTrack = 'gameplayNight';
      this.gameplayNightCrossfaded = true;
      this.resetGameplayCrossfadeState();
    }
  }

  playGameOver(): void {
    this.resetGameplayCrossfadeState();
    this.gameplayNightCrossfaded = false;
    this.play('gameOver');
  }

  private play(track: MusicTrack): void {
    const next = this.clips[track];
    const alreadyPlaying =
      this.activeTrack === track &&
      this.musicEnabled &&
      !next.paused &&
      !next.ended &&
      next.currentTime > 0;

    if (alreadyPlaying) return;

    const previousTrack = this.activeTrack;
    this.activeTrack = track;
    if (!this.musicEnabled) return;

    if (this.isPlaybackBlocked()) {
      return;
    }

    for (const [key, clip] of Object.entries(this.clips) as [MusicTrack, HTMLAudioElement][]) {
      if (key !== track) {
        clip.pause();
        clip.currentTime = 0;
      }
    }

    if (previousTrack !== track) {
      this.seekTrackToStart(next, track);
    }

    const startPlayback = () => {
      if (this.activeTrack !== track || !this.musicEnabled) return;
      const result = next.play();
      if (result) {
        void result.catch(() => {
          /* Autoplay blocked until gesture — tryUnlock will retry. */
        });
      }
    };

    if (next.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      startPlayback();
    } else {
      next.addEventListener('canplay', startPlayback, { once: true });
      next.addEventListener(
        'canplaythrough',
        () => {
          if (this.userGestureUnlocked && next.paused) {
            startPlayback();
          }
        },
        { once: true },
      );
      next.load();
    }
  }

  pauseAll(): void {
    for (const clip of Object.values(this.clips)) {
      clip.pause();
    }
  }

  stop(): void {
    this.resetGameplayCrossfadeState();
    this.clearPlaybackInterruptions();
    this.pauseAll();
    for (const clip of Object.values(this.clips)) {
      clip.currentTime = 0;
    }
    this.activeTrack = null;
    this.gameplayNightCrossfaded = false;
  }
}
