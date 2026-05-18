import Phaser from 'phaser';
import { GOLDEN_WAKE_URL, WAKE_QUACK_URLS } from './soundPaths';
import {
  getSfxVolume,
  isSfxEnabled,
  setSfxEnabled,
  setSfxVolume as persistSfxVolume,
} from '../storage/audioSettings';

export type SoundId =
  | 'wake'
  | 'goldenWake'
  | 'miss'
  | 'combo'
  | 'lifeLost'
  | 'gameOver'
  | 'tap'
  | 'bad'
  | 'bonus';

let instance: SoundManager | null = null;

/** Peak volume for mallard wake quacks (HTMLAudioElement 0–1). */
const WAKE_QUACK_PEAK_VOLUME = 0.62;
const GOLDEN_WAKE_PEAK_VOLUME = 0.7;
/** ~250 ms full quack, 250 ms fade, hard stop at 500 ms. */
const WAKE_QUACK_HOLD_MS = 250;
const WAKE_QUACK_FADE_MS = 250;
const WAKE_QUACK_TOTAL_MS = 500;

type FadeHandles = {
  hold: number;
  interval?: number;
  forceStop?: number;
};

/**
 * Browser-native SFX — does not rely on Phaser's async sound.unlock() (which only
 * resumes on the *next* click). Beeps use a dedicated AudioContext; wake quacks use
 * HTMLAudioElement so play() can run synchronously inside the tap handler.
 */
export class SoundManager {
  private sfxEnabled = isSfxEnabled();
  private sfxVolume = getSfxVolume();
  private ctx: AudioContext | null = null;
  private readonly wakeClips: HTMLAudioElement[];
  private readonly goldenWakeClip: HTMLAudioElement;
  private lastWakeIndex = -1;
  private activeWakePlayback: HTMLAudioElement | null = null;
  private activeGoldenPlayback: HTMLAudioElement | null = null;
  private wakeFadeHandles: FadeHandles | null = null;
  private goldenFadeHandles: FadeHandles | null = null;

  private constructor() {
    this.wakeClips = WAKE_QUACK_URLS.map((url) => {
      const clip = new Audio(url);
      clip.preload = 'auto';
      clip.loop = false;
      return clip;
    });
    this.goldenWakeClip = new Audio(GOLDEN_WAKE_URL);
    this.goldenWakeClip.preload = 'auto';
    this.goldenWakeClip.loop = false;
  }

  static forScene(_scene: Phaser.Scene): SoundManager {
    if (!instance) {
      instance = new SoundManager();
    }
    return instance;
  }

  isEnabled(): boolean {
    return this.sfxEnabled;
  }

  isSfxEnabled(): boolean {
    return this.sfxEnabled;
  }

  setEnabled(enabled: boolean): void {
    this.setSfxEnabled(enabled);
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  setSfxVolume(volume: number): void {
    persistSfxVolume(volume);
    this.sfxVolume = getSfxVolume();
    this.sfxEnabled = this.sfxVolume > 0.001;
    if (!this.sfxEnabled) {
      this.stopWakeClips();
    }
  }

  setSfxEnabled(enabled: boolean): void {
    setSfxEnabled(enabled);
    this.sfxVolume = getSfxVolume();
    this.sfxEnabled = this.sfxVolume > 0.001;
    if (!this.sfxEnabled) {
      this.stopWakeClips();
    }
  }

  private scaledGain(gain: number): number {
    return gain * this.sfxVolume;
  }

  private scaledClipVolume(peak: number): number {
    return peak * this.sfxVolume;
  }

  /** Call from pointerdown — must resume audio during the user gesture. */
  tryUnlock(): void {
    if (!this.sfxEnabled) return;
    this.resumeContext();
    for (const clip of this.wakeClips) {
      if (clip.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        clip.load();
      }
    }
    if (this.goldenWakeClip.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      this.goldenWakeClip.load();
    }
  }

  private resumeContext(): AudioContext | null {
    if (!this.sfxEnabled) return null;

    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    return this.ctx;
  }

  private beep(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gain = 0.14,
  ): void {
    const ctx = this.resumeContext();
    if (!ctx) return;

    const startOsc = () => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.value = this.scaledGain(gain);
      osc.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime;
      g.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.start(t);
      osc.stop(t + duration);
    };

    if (ctx.state === 'running') {
      startOsc();
      return;
    }

    void ctx.resume().then(() => {
      if (ctx.state === 'running') startOsc();
    });
  }

  private pickWakeClip(): HTMLAudioElement {
    const count = this.wakeClips.length;
    if (count === 1) return this.wakeClips[0];

    let index: number;
    do {
      index = Math.floor(Math.random() * count);
    } while (index === this.lastWakeIndex);

    this.lastWakeIndex = index;
    return this.wakeClips[index];
  }

  private clearFadeHandles(handles: FadeHandles | null): void {
    if (!handles) return;
    window.clearTimeout(handles.hold);
    if (handles.forceStop !== undefined) {
      window.clearTimeout(handles.forceStop);
    }
    if (handles.interval !== undefined) {
      window.clearInterval(handles.interval);
    }
  }

  private clearWakeFade(): void {
    this.clearFadeHandles(this.wakeFadeHandles);
    this.wakeFadeHandles = null;
  }

  private clearGoldenFade(): void {
    this.clearFadeHandles(this.goldenFadeHandles);
    this.goldenFadeHandles = null;
  }

  private stopPlayback(
    clip: HTMLAudioElement | null,
    track?: 'wake' | 'golden',
  ): void {
    if (!clip) return;
    if (track === 'wake') this.clearWakeFade();
    if (track === 'golden') this.clearGoldenFade();
    clip.pause();
    clip.currentTime = 0;
  }

  private releaseQuackClip(
    clip: HTMLAudioElement,
    track: 'wake' | 'golden',
    handles: FadeHandles,
  ): void {
    this.clearFadeHandles(handles);
    clip.volume = 0;
    clip.pause();
    clip.currentTime = 0;

    if (track === 'wake' && this.activeWakePlayback === clip) {
      this.activeWakePlayback = null;
    }
    if (track === 'golden' && this.activeGoldenPlayback === clip) {
      this.activeGoldenPlayback = null;
    }
    if (track === 'wake' && this.wakeFadeHandles === handles) {
      this.wakeFadeHandles = null;
    }
    if (track === 'golden' && this.goldenFadeHandles === handles) {
      this.goldenFadeHandles = null;
    }
  }

  private scheduleQuackFade(
    clip: HTMLAudioElement,
    peakVolume: number,
    track: 'wake' | 'golden',
  ): void {
    if (track === 'wake') {
      this.clearWakeFade();
    } else {
      this.clearGoldenFade();
    }

    clip.loop = false;

    const handles: FadeHandles = { hold: 0 };

    const stopClip = () => {
      if (track === 'wake' && this.activeWakePlayback !== clip) return;
      if (track === 'golden' && this.activeGoldenPlayback !== clip) return;
      this.releaseQuackClip(clip, track, handles);
    };

    const startFade = () => {
      if (track === 'wake' && this.activeWakePlayback !== clip) return;
      if (track === 'golden' && this.activeGoldenPlayback !== clip) return;

      const steps = Math.max(6, Math.round(WAKE_QUACK_FADE_MS / 40));
      const stepMs = WAKE_QUACK_FADE_MS / steps;
      let step = 0;
      handles.interval = window.setInterval(() => {
        step += 1;
        clip.volume = Math.max(0, peakVolume * (1 - step / steps));
        if (step >= steps) {
          stopClip();
        }
      }, stepMs);
    };

    handles.hold = window.setTimeout(startFade, WAKE_QUACK_HOLD_MS);
    handles.forceStop = window.setTimeout(stopClip, WAKE_QUACK_TOTAL_MS);

    if (track === 'wake') {
      this.wakeFadeHandles = handles;
    } else {
      this.goldenFadeHandles = handles;
    }
  }

  private stopWakeClips(): void {
    this.stopPlayback(this.activeWakePlayback, 'wake');
    this.activeWakePlayback = null;
    this.stopPlayback(this.activeGoldenPlayback, 'golden');
    this.activeGoldenPlayback = null;
    for (const clip of this.wakeClips) {
      clip.pause();
    }
    this.goldenWakeClip.pause();
  }

  /** Fresh element per play — avoids pause/timer races after scene changes. */
  private playOneShot(
    source: HTMLAudioElement,
    track: 'wake' | 'golden',
    peakVolume: number,
  ): void {
    const clip = new Audio(source.src);
    clip.preload = 'auto';
    clip.loop = false;
    const peak = this.scaledClipVolume(peakVolume);
    clip.volume = peak;

    if (track === 'wake') {
      this.stopPlayback(this.activeWakePlayback, 'wake');
      this.activeWakePlayback = clip;
    } else {
      this.stopPlayback(this.activeGoldenPlayback, 'golden');
      this.activeGoldenPlayback = clip;
    }

    const beginTimedPlayback = () => {
      this.scheduleQuackFade(clip, peak, track);
    };

    const result = clip.play();
    if (result) {
      void result.then(beginTimedPlayback).catch(() => {
        clip.load();
        void clip.play().then(beginTimedPlayback).catch(() => {});
      });
    } else {
      beginTimedPlayback();
    }
  }

  private playGoldenWake(): void {
    this.resumeContext();
    this.stopPlayback(this.activeWakePlayback, 'wake');
    this.activeWakePlayback = null;
    this.playOneShot(this.goldenWakeClip, 'golden', GOLDEN_WAKE_PEAK_VOLUME);
  }

  private playWakeQuack(): void {
    this.resumeContext();
    this.stopPlayback(this.activeGoldenPlayback, 'golden');
    this.activeGoldenPlayback = null;
    this.stopPlayback(this.activeWakePlayback, 'wake');
    this.playOneShot(this.pickWakeClip(), 'wake', WAKE_QUACK_PEAK_VOLUME);
  }

  play(id: SoundId): void {
    if (!this.sfxEnabled) return;

    this.tryUnlock();

    switch (id) {
      case 'wake':
        this.playWakeQuack();
        break;
      case 'goldenWake':
        this.playGoldenWake();
        break;
      case 'miss':
        this.beep(180, 0.2, 'sawtooth', 0.1);
        break;
      case 'combo':
        this.beep(400 + Math.random() * 80, 0.07);
        break;
      case 'lifeLost':
        this.beep(120, 0.25, 'square', 0.09);
        break;
      case 'gameOver':
        this.beep(300, 0.15);
        window.setTimeout(() => this.beep(200, 0.3), 120);
        break;
      case 'tap':
        this.beep(440, 0.05, 'sine', 0.1);
        break;
      case 'bad':
        this.beep(140, 0.22, 'sawtooth', 0.12);
        break;
      case 'bonus':
        this.beep(660, 0.08, 'sine', 0.12);
        window.setTimeout(() => this.beep(880, 0.1, 'sine', 0.1), 90);
        break;
    }
  }

  /** First menu tap — unlock and play a short confirmation blip. */
  unlock(): void {
    this.tryUnlock();
    this.play('tap');
  }

  detach(): void {
    this.stopWakeClips();
  }
}
