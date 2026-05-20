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
  /** Tab/app hidden, etc. — resume only when this returns to 0. */
  private playbackInterruptionCount = 0;
  /** In-game settings drawer — idempotent (safe for rapid open/close). */
  private settingsPaused = false;
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
    if (this.settingsPaused) return true;
    if (this.playbackInterruptionCount > 0) return true;
    return typeof document !== 'undefined' && document.hidden;
  }

  /** Pause music while the in-game settings drawer is open. */
  pauseForSettings(): void {
    if (this.settingsPaused) return;
    this.settingsPaused = true;
    this.pauseAll();
  }

  /** Resume music after the settings drawer closes. */
  resumeFromSettings(): void {
    if (!this.settingsPaused) return;
    this.settingsPaused = false;
    this.resumeAfterUnblocked();
  }

  /** Pause music while gameplay/UI is interrupted (hidden tab, etc.). */
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
      this.resumeAfterUnblocked();
    }
  }

  private resumeAfterUnblocked(): void {
    if (this.isPlaybackBlocked()) return;

    const inGameplayMusic =
      this.activeTrack === 'gameplay' ||
      this.activeTrack === 'gameplayNight' ||
      this.gameplayMusicTimelineActive ||
      this.gameplayNightCrossfaded;

    if (inGameplayMusic) {
      this.syncGameplayMusicCrossfade(this.lastGameplayElapsedSec);
      return;
    }

    this.tryResumeActiveTrack();
  }

  /** Called when leaving a scene so the next scene can start fresh playback. */
  clearPlaybackInterruptions(): void {
    this.settingsPaused = false;
    this.playbackInterruptionCount = 0;
    if (typeof document !== 'undefined' && document.hidden) {
      this.pauseForInterruption();
    }
  }

  private tryResumeActiveTrack(): void {
    if (this.isPlaybackBlocked()) return;
    if (!this.activeTrack) return;
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
      this.resumeClipIfPaused(from);
      return;
    }
    if (from.volume > 0.001) {
      this.resumeClipIfPaused(from);
    }
    this.resumeClipIfPaused(to);
  }

  private ensureNightGameplayMusic(): void {
    const to = this.clips.gameplayNight;
    to.volume = this.trackVolume('gameplayNight');
    this.resumeClipIfPaused(to);
  }

  /** Unpause without re-seeking — safe to call repeatedly. */
  private resumeClipIfPaused(clip: HTMLAudioElement): void {
    if (clip.paused && !clip.ended) {
      void clip.play().catch(() => {
        /* Autoplay blocked until gesture. */
      });
    }
  }

  private isNightMusicLockedIn(): boolean {
    return (
      this.gameplayNightCrossfaded &&
      this.activeTrack === 'gameplayNight' &&
      this.nightTrackStarted
    );
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
    if (this.isManagingGameplayCrossfade() || this.gameplayNightCrossfaded) {
      this.updateGameplayMusicCrossfade(this.lastGameplayElapsedSec);
      return;
    }
    for (const [key, clip] of Object.entries(this.clips) as [MusicTrack, HTMLAudioElement][]) {
      clip.volume = this.trackVolume(key);
    }
  }

  /** Restore audible levels without re-seeking — timeline keeps running while muted. */
  private refreshGameplayAudibility(): void {
    if (this.isPlaybackBlocked()) return;

    const inGameplay =
      this.lastGameplayElapsedSec > 0 &&
      (this.activeTrack === 'gameplay' ||
        this.activeTrack === 'gameplayNight' ||
        this.gameplayMusicTimelineActive ||
        this.gameplayNightCrossfaded);

    if (inGameplay) {
      this.updateGameplayMusicCrossfade(this.lastGameplayElapsedSec);
      return;
    }

    this.applyClipVolumes();
    if (this.activeTrack) {
      this.resumeClipIfPaused(this.clips[this.activeTrack]);
    }
  }

  getMusicVolume(): number {
    return getMusicVolume();
  }

  setMusicVolume(volume: number): void {
    persistMusicVolume(volume);
    this.applyClipVolumes();
    this.refreshGameplayAudibility();
  }

  isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  setMusicEnabled(enabled: boolean): void {
    setMusicEnabled(enabled);
    this.applyClipVolumes();
    this.refreshGameplayAudibility();
  }

  getActiveTrack(): MusicTrack | null {
    return this.activeTrack;
  }

  /** True when the active track is unpaused (may still be silent — that's fine). */
  isActiveTrackPlaying(): boolean {
    if (!this.activeTrack || this.isPlaybackBlocked()) return false;
    if (this.isManagingGameplayCrossfade()) {
      const from = this.clips.gameplay;
      const to = this.clips.gameplayNight;
      return (!from.paused && !from.ended) || (!to.paused && !to.ended);
    }
    const clip = this.clips[this.activeTrack];
    return !clip.paused && !clip.ended;
  }

  /**
   * Called inside a user-gesture handler (pointerdown / touchstart / keydown).
   * Resumes playback without re-seeking — never tears down an in-progress day/night crossfade.
   */
  tryUnlock(): void {
    if (typeof document !== 'undefined' && document.hidden) return;

    if (this.isManagingGameplayCrossfade()) {
      this.resumeGameplayCrossfadeClips();
      return;
    }

    if (this.gameplayNightCrossfaded) {
      this.ensureNightGameplayMusic();
      return;
    }

    if (!this.activeTrack) this.activeTrack = 'menuUi';

    const clip = this.clips[this.activeTrack];
    if (!clip.paused && !clip.ended) {
      void clip.play().catch(() => {
        /* Autoplay blocked until gesture. */
      });
      return;
    }

    this.play(this.activeTrack);
  }

  playMenuUi(): void {
    this.resetGameplayCrossfadeState();
    this.gameplayNightCrossfaded = false;
    this.nightTrackStarted = false;
    this.play('menuUi');
  }

  playGameplay(): void {
    this.resetGameplayCrossfadeState();
    this.gameplayNightCrossfaded = false;
    this.nightTrackStarted = false;
    this.lastGameplayElapsedSec = 0;
    this.play('gameplay');
  }

  /**
   * Reconcile day/night playback after settings or tab pause (uses live elapsed time).
   */
  syncGameplayMusicCrossfade(elapsedSec: number): void {
    if (this.isPlaybackBlocked()) return;
    this.lastGameplayElapsedSec = elapsedSec;

    const { gameplayNightMusicFadeInEndSec: nightEnd } = DAY_NIGHT;

    if (elapsedSec >= nightEnd) {
      this.snapToNightMusic();
      return;
    }

    if (this.gameplayNightCrossfaded && this.activeTrack !== 'gameplayNight') {
      this.gameplayNightCrossfaded = false;
    }

    this.updateGameplayMusicCrossfade(elapsedSec);
  }

  /** Jump straight to night playback without re-running the fade-in start. */
  private snapToNightMusic(): void {
    const from = this.clips.gameplay;
    const to = this.clips.gameplayNight;
    const nightVol = this.trackVolume('gameplayNight');

    from.pause();
    from.currentTime = 0;
    from.volume = 0;

    to.volume = nightVol;

    if (!this.nightTrackStarted) {
      this.nightTrackStarted = true;
      this.seekTrackToStart(to, 'gameplayNight');
    }

    this.resumeClipIfPaused(to);

    this.activeTrack = 'gameplayNight';
    this.gameplayNightCrossfaded = true;
    this.gameplayMusicTimelineActive = false;
  }

  private ensureEarlyGameplayMusic(): void {
    if (this.activeTrack !== 'gameplay') return;
    const clip = this.clips.gameplay;
    clip.volume = this.trackVolume('gameplay');
    this.resumeClipIfPaused(clip);
  }

  /**
   * Drive day→night music from game elapsed time (pauses with gameplay).
   * Day: full → fade out 40s–48s. Night: fade in 45s–50s from loop offset.
   */
  updateGameplayMusicCrossfade(elapsedSec: number): void {
    this.lastGameplayElapsedSec = elapsedSec;
    if (this.isPlaybackBlocked()) return;

    if (this.gameplayNightCrossfaded) {
      if (this.isNightMusicLockedIn()) {
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

    if (elapsedSec >= nightEnd) {
      this.snapToNightMusic();
      return;
    }

    if (elapsedSec < dayStart) {
      this.ensureEarlyGameplayMusic();
      return;
    }

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
      if (from.paused && !from.ended) {
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
      this.resumeClipIfPaused(to);
    }

    const nightFade = this.fadeT(elapsedSec, nightStart, nightEnd);
    to.volume = nightTargetVol * nightFade;

    if (elapsedSec >= nightStart && !to.ended) {
      this.resumeClipIfPaused(to);
    }

    if (nightFade >= 1) {
      from.pause();
      from.currentTime = 0;
      from.volume = 0;
      to.volume = nightTargetVol;
      this.activeTrack = 'gameplayNight';
      this.gameplayNightCrossfaded = true;
      this.gameplayMusicTimelineActive = false;
    }
  }

  playGameOver(variant: GameOverMusicVariant = this.gameOverMusicVariant): void {
    this.gameOverMusicVariant = variant;
    this.resetGameplayCrossfadeState();
    this.gameplayNightCrossfaded = false;
    this.nightTrackStarted = false;
    this.settingsPaused = false;
    const track: MusicTrack = variant === 'passed' ? 'menuUi' : 'gameOver';
    this.stopGameplayMusic();
    this.play(track);
  }

  /** Silence day/night gameplay beds when leaving a run. */
  private stopGameplayMusic(): void {
    for (const key of ['gameplay', 'gameplayNight'] as const) {
      const clip = this.clips[key];
      clip.pause();
      clip.currentTime = 0;
      clip.volume = 0;
    }
    this.gameplayMusicTimelineActive = false;
  }

  /**
   * Switch to (or restart) a track. Synchronous: calls audio.play() directly so
   * the browser counts it as a user-gesture-driven play when called inside one.
   * If autoplay is blocked the catch() is silent — the next user gesture will
   * call tryUnlock() and try again.
   */
  private play(track: MusicTrack): void {
    if (this.isManagingGameplayCrossfade()) {
      if (track === 'gameplay' || track === 'gameplayNight') {
        this.resumeGameplayCrossfadeClips();
      }
      return;
    }

    if (
      this.gameplayNightCrossfaded &&
      (track === 'gameplay' || track === 'gameplayNight')
    ) {
      this.ensureNightGameplayMusic();
      return;
    }

    const next = this.clips[track];
    const previousTrack = this.activeTrack;
    this.activeTrack = track;

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
    this.nightTrackStarted = false;
  }
}
