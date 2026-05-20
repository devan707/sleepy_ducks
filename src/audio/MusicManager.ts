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
import { isMasterMuted, subscribeMasterMute } from '../storage/masterMute';

export type MusicTrack = 'menuUi' | 'gameplay' | 'gameplayNight' | 'gameOver';

export type GameOverMusicVariant = 'failed' | 'passed';

/**
 * Per-track caps applied on top of the user's music slider — slider at 100%
 * plays each track at this fraction of its source file's volume.
 */
const MUSIC_PEAKS: Record<MusicTrack, number> = {
  menuUi: 0.5,
  gameOver: 0.25,
  gameplay: 0.6,
  gameplayNight: 0.6,
};

let instance: MusicManager | null = null;

export class MusicManager {
  private readonly clips: Record<MusicTrack, HTMLAudioElement>;
  private activeTrack: MusicTrack | null = null;
  private musicEnabled = isMusicEnabled();
  private gameplayNightCrossfaded = false;
  private gameplayMusicTimelineActive = false;
  private nightTrackStarted = false;
  private gameOverMusicVariant: GameOverMusicVariant = 'failed';
  /** Settings drawer, tab hidden, etc. — resume only when this returns to 0. */
  private playbackInterruptionCount = 0;
  /** Last elapsed time passed from GameScene — used to catch up crossfade after tab/settings pause. */
  private lastGameplayElapsedSec = 0;

  private constructor() {
    this.clips = {
      menuUi: this.createClip(MENU_UI_MUSIC_URL),
      gameplay: this.createClip(GAMEPLAY_MUSIC_URL),
      gameplayNight: this.createClip(GAMEPLAY_NIGHT_MUSIC_URL),
      gameOver: this.createClip(GAME_OVER_MUSIC_URL),
    };
    this.applyClipVolumes();
    this.applyMasterMute(isMasterMuted());
    subscribeMasterMute((muted) => this.applyMasterMute(muted));
  }

  /** Mute (but keep playing) every clip so tracks keep their timeline. */
  private applyMasterMute(muted: boolean): void {
    for (const clip of Object.values(this.clips)) {
      clip.muted = muted;
    }
  }

  static getInstance(): MusicManager {
    if (!instance) {
      instance = new MusicManager();
    }
    return instance;
  }

  /** Begin downloading music files alongside the rest of the loading screen. */
  static preload(): void {
    const mgr = MusicManager.getInstance();
    mgr.preloadAll();
  }

  private createClip(url: string): HTMLAudioElement {
    const clip = new Audio(url);
    clip.preload = 'auto';
    clip.loop = true;
    clip.volume = 0;
    clip.muted = isMasterMuted();
    return clip;
  }

  private preloadAll(): void {
    for (const clip of Object.values(this.clips)) {
      if (clip.readyState < HTMLMediaElement.HAVE_METADATA) {
        clip.load();
      }
    }
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
    if (this.playbackInterruptionCount === 0 && !this.isPlaybackBlocked()) {
      this.tryResumeActiveTrack();
      if (
        this.lastGameplayElapsedSec > 0 &&
        (this.activeTrack === 'gameplay' ||
          this.activeTrack === 'gameplayNight' ||
          this.gameplayMusicTimelineActive ||
          this.gameplayNightCrossfaded)
      ) {
        this.syncGameplayMusicCrossfade(this.lastGameplayElapsedSec);
      }
    }
  }

  /** Called when leaving a scene so the next scene can start fresh playback. */
  clearPlaybackInterruptions(): void {
    this.playbackInterruptionCount = 0;
    if (typeof document !== 'undefined' && document.hidden) {
      this.pauseForInterruption();
    }
  }

  private tryResumeActiveTrack(): void {
    if (this.isPlaybackBlocked()) return;
    if (!this.musicEnabled || !this.activeTrack) return;
    if (this.gameplayMusicTimelineActive && !this.gameplayNightCrossfaded) {
      this.resumeGameplayCrossfadeClips();
      return;
    }
    if (this.gameplayNightCrossfaded && this.activeTrack === 'gameplayNight') {
      this.ensureNightGameplayMusic();
      return;
    }
    this.play(this.activeTrack);
  }

  /** Both clips may be audible mid crossfade — do not call play(track) for just one. */
  private resumeGameplayCrossfadeClips(): void {
    const from = this.clips.gameplay;
    const to = this.clips.gameplayNight;
    if (!this.nightTrackStarted) {
      if (from.paused) {
        void from.play().catch(() => {
          /* Autoplay blocked until gesture. */
        });
      }
      return;
    }
    if (from.volume > 0.001 && from.paused) {
      void from.play().catch(() => {
        /* Autoplay blocked until gesture. */
      });
    }
    if (to.paused) {
      void to.play().catch(() => {
        /* Autoplay blocked until gesture. */
      });
    }
  }

  private ensureNightGameplayMusic(): void {
    const to = this.clips.gameplayNight;
    to.volume = this.trackVolume('gameplayNight');
    if (to.paused) {
      void to.play().catch(() => {
        /* Autoplay blocked until gesture. */
      });
    }
  }

  /** Effective playback volume for a single track given the current slider value. */
  private trackVolume(track: MusicTrack): number {
    const slider = getMusicVolume();
    if (slider <= 0.001) return 0;
    return Math.max(0, Math.min(1, slider * MUSIC_PEAKS[track]));
  }

  private getTrackStartSec(track: MusicTrack): number {
    if (track === 'gameplayNight') return DAY_NIGHT.gameplayNightStartSec;
    return 0;
  }

  private seekTrackToStart(clip: HTMLAudioElement, track: MusicTrack): void {
    const startSec = this.getTrackStartSec(track);
    try {
      clip.currentTime = startSec;
    } catch {
      /* Element not seekable yet — browser will seek on first play. */
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
    const slider = getMusicVolume();
    this.musicEnabled = slider > 0.001;
    if (this.isManagingGameplayCrossfade()) return;
    for (const [key, clip] of Object.entries(this.clips) as [MusicTrack, HTMLAudioElement][]) {
      clip.volume = this.trackVolume(key);
    }
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
      return;
    }
    if (this.activeTrack) {
      this.play(this.activeTrack);
    }
  }

  getActiveTrack(): MusicTrack | null {
    return this.activeTrack;
  }

  /** True when the active track is unpaused (may still be buffering — that's fine). */
  isActiveTrackPlaying(): boolean {
    if (!this.activeTrack || !this.musicEnabled || this.isPlaybackBlocked()) return false;
    const clip = this.clips[this.activeTrack];
    return !clip.paused && !clip.ended;
  }

  /**
   * Called inside a user-gesture handler (pointerdown / touchstart / keydown).
   * Forces a synchronous play() so the browser registers the gesture as audio
   * unlock for our elements. If no scene has set an active track yet, default
   * to menu music so the first interaction always starts something.
   */
  tryUnlock(): void {
    if (!this.musicEnabled) return;
    if (!this.activeTrack) this.activeTrack = 'menuUi';
    this.play(this.activeTrack);
  }

  playMenuUi(): void {
    this.resetGameplayCrossfadeState();
    this.gameplayNightCrossfaded = false;
    this.play('menuUi');
  }

  playGameplay(): void {
    this.resetGameplayCrossfadeState();
    this.gameplayNightCrossfaded = false;
    this.lastGameplayElapsedSec = 0;
    this.play('gameplay');
  }

  /**
   * Drive day→night music from game elapsed time (pauses with gameplay).
   * Day: full → fade out 40s–48s. Night: fade in 45s–50s from loop offset.
   */
  /**
   * Reconcile day/night playback after settings or tab pause (uses live elapsed time).
   */
  syncGameplayMusicCrossfade(elapsedSec: number): void {
    if (this.isPlaybackBlocked() || !this.musicEnabled) return;
    this.lastGameplayElapsedSec = elapsedSec;

    const { gameplayNightMusicFadeInEndSec: nightEnd } = DAY_NIGHT;

    if (this.gameplayNightCrossfaded && this.activeTrack !== 'gameplayNight') {
      this.gameplayNightCrossfaded = false;
    }

    if (elapsedSec >= nightEnd && this.activeTrack !== 'gameplayNight') {
      this.gameplayNightCrossfaded = false;
      this.nightTrackStarted = false;
      this.gameplayMusicTimelineActive =
        elapsedSec >= DAY_NIGHT.gameplayDayMusicFadeOutStartSec;
    }

    if (
      elapsedSec >= DAY_NIGHT.gameplayNightMusicFadeInStartSec &&
      this.clips.gameplayNight.paused &&
      (this.nightTrackStarted || elapsedSec >= nightEnd)
    ) {
      this.nightTrackStarted = false;
    }

    this.updateGameplayMusicCrossfade(elapsedSec);
  }

  updateGameplayMusicCrossfade(elapsedSec: number): void {
    this.lastGameplayElapsedSec = elapsedSec;
    if (this.isPlaybackBlocked()) return;
    if (!this.musicEnabled) return;

    if (this.gameplayNightCrossfaded) {
      if (this.activeTrack === 'gameplayNight') {
        this.ensureNightGameplayMusic();
        return;
      }
      this.gameplayNightCrossfaded = false;
    }

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
    const dayTargetVol = this.trackVolume('gameplay');
    const nightTargetVol = this.trackVolume('gameplayNight');
    const dayFade = this.fadeT(elapsedSec, dayStart, dayEnd);
    const dayVol = dayTargetVol * (1 - dayFade);

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
    to.volume = nightTargetVol * nightFade;

    if (nightFade > 0 && to.paused) {
      void to.play().catch(() => {
        /* Autoplay blocked until gesture. */
      });
    }

    if (nightFade >= 1) {
      from.pause();
      from.currentTime = 0;
      from.volume = dayTargetVol;
      to.volume = nightTargetVol;
      this.activeTrack = 'gameplayNight';
      this.gameplayNightCrossfaded = true;
      this.resetGameplayCrossfadeState();
    }
  }

  playGameOver(variant: GameOverMusicVariant = this.gameOverMusicVariant): void {
    this.gameOverMusicVariant = variant;
    this.resetGameplayCrossfadeState();
    this.gameplayNightCrossfaded = false;
    const track: MusicTrack = variant === 'passed' ? 'menuUi' : 'gameOver';
    this.play(track);
  }

  /**
   * Switch to (or restart) a track. Synchronous: calls audio.play() directly so
   * the browser counts it as a user-gesture-driven play when called inside one.
   * If autoplay is blocked the catch() is silent — the next user gesture will
   * call tryUnlock() and try again.
   */
  private play(track: MusicTrack): void {
    const next = this.clips[track];
    const previousTrack = this.activeTrack;
    this.activeTrack = track;

    if (!this.musicEnabled) return;
    if (this.isPlaybackBlocked()) return;

    for (const [key, clip] of Object.entries(this.clips) as [MusicTrack, HTMLAudioElement][]) {
      if (key !== track && !clip.paused) {
        clip.pause();
        clip.currentTime = 0;
      }
    }

    const switchingTrack = previousTrack !== track;
    if (switchingTrack) {
      next.pause();
      this.seekTrackToStart(next, track);
    }

    next.volume = this.trackVolume(track);

    if (!switchingTrack && !next.paused) return;

    const playPromise = next.play();
    if (playPromise) {
      void playPromise.catch(() => {
        /* Autoplay blocked — first user gesture will retry via tryUnlock(). */
      });
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
