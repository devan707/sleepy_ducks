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
  private gameplayNightCrossfaded = false;
  private crossfadeRaf: number | null = null;

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

  private applyClipVolumes(): void {
    if (this.crossfadeRaf !== null) return;
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
      this.cancelCrossfade();
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

  private preloadAll(): void {
    for (const clip of Object.values(this.clips)) {
      if (clip.readyState < HTMLMediaElement.HAVE_METADATA) {
        clip.load();
      }
    }
  }

  /** Preload clips during a user gesture (mobile unlock). */
  tryUnlock(): void {
    this.preloadAll();
    if (this.musicEnabled && this.activeTrack) {
      if (this.activeTrack === 'gameplayNight') {
        this.play('gameplayNight');
      } else {
        this.play(this.activeTrack);
      }
    }
  }

  playMenuUi(): void {
    this.cancelCrossfade();
    this.gameplayNightCrossfaded = false;
    this.play('menuUi');
  }

  playGameplay(): void {
    this.cancelCrossfade();
    this.gameplayNightCrossfaded = false;
    this.play('gameplay');
  }

  /**
   * 3s overlap crossfade at sunset: Sunday Morning Paddle out, Beneath the First Star in (loops).
   */
  crossfadeGameplayToNight(): void {
    if (this.gameplayNightCrossfaded || !this.musicEnabled) return;
    this.gameplayNightCrossfaded = true;
    this.cancelCrossfade();

    const from = this.clips.gameplay;
    const to = this.clips.gameplayNight;
    const targetVol = getMusicVolume();

    const startCrossfade = () => {
      if (!this.musicEnabled || !this.gameplayNightCrossfaded) return;

      to.currentTime = 0;
      const playFrom = from.paused ? from.play() : Promise.resolve();
      const playTo = to.play();
      void Promise.all([playFrom, playTo]).catch(() => {
        /* Autoplay blocked until gesture. */
      });

      const t0 = performance.now();
      const tick = () => {
        if (!this.gameplayNightCrossfaded) return;

        const t = Math.min(1, (performance.now() - t0) / DAY_NIGHT.gameplayMusicCrossfadeMs);
        from.volume = targetVol * (1 - t);
        to.volume = targetVol * t;

        if (t < 1) {
          this.crossfadeRaf = requestAnimationFrame(tick);
        } else {
          from.pause();
          from.currentTime = 0;
          from.volume = targetVol;
          to.volume = targetVol;
          this.crossfadeRaf = null;
          this.activeTrack = 'gameplayNight';
        }
      };
      this.crossfadeRaf = requestAnimationFrame(tick);
    };

    if (to.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      startCrossfade();
    } else {
      to.addEventListener('canplay', startCrossfade, { once: true });
      to.load();
    }
  }

  playGameOver(): void {
    this.cancelCrossfade();
    this.gameplayNightCrossfaded = false;
    this.play('gameOver');
  }

  private cancelCrossfade(): void {
    if (this.crossfadeRaf !== null) {
      cancelAnimationFrame(this.crossfadeRaf);
      this.crossfadeRaf = null;
    }
  }

  private play(track: MusicTrack): void {
    this.cancelCrossfade();

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

    for (const [key, clip] of Object.entries(this.clips) as [MusicTrack, HTMLAudioElement][]) {
      if (key !== track) {
        clip.pause();
        clip.currentTime = 0;
      }
    }

    if (previousTrack !== track) {
      next.currentTime = 0;
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
      next.load();
    }
  }

  pauseAll(): void {
    this.cancelCrossfade();
    for (const clip of Object.values(this.clips)) {
      clip.pause();
    }
  }

  stop(): void {
    this.cancelCrossfade();
    this.pauseAll();
    for (const clip of Object.values(this.clips)) {
      clip.currentTime = 0;
    }
    this.activeTrack = null;
    this.gameplayNightCrossfaded = false;
  }
}
