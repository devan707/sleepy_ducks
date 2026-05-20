import Phaser from 'phaser';
import {
  CHEERING_URL,
  COMBO_URL,
  CRACKING_EGG_URL,
  GAMEPLAY_BACKGROUND_LOOPS,
  GOLDEN_WAKE_URL,
  LEVEL_PASS_URL,
  LIFE_URL,
  MOONFLOWER_URL,
  WAKE_QUACK_URLS,
  WOOD_URL,
} from './soundPaths';
import {
  getSfxVolume,
  isSfxEnabled,
  setSfxEnabled,
  setSfxVolume as persistSfxVolume,
} from '../storage/audioSettings';
import { isMasterMuted, subscribeMasterMute } from '../storage/masterMute';
import { COMBO } from '../config/gameConfig';

export type SoundId =
  | 'wake'
  | 'goldenWake'
  | 'miss'
  | 'lifeLost'
  | 'gameOver'
  | 'tap'
  | 'bad'
  | 'badTap'
  | 'earlyBuzzer'
  | 'bonus'
  | 'decoyRock';

let instance: SoundManager | null = null;

/** Peak volume for mallard wake quacks (HTMLAudioElement 0–1). */
const WAKE_QUACK_PEAK_VOLUME = 0.62;
const GOLDEN_WAKE_PEAK_VOLUME = 0.7;
const COMBO_PEAK_VOLUME = 0.76;
const MOONFLOWER_PEAK_VOLUME = 0.78;
const LIFE_PEAK_VOLUME = 0.76;
const CRACKING_EGG_PEAK_VOLUME = 0.78;
const LEVEL_PASS_PEAK_VOLUME = 0.78;
const CHEERING_PEAK_VOLUME = 0.72;
const WOOD_PEAK_VOLUME = 0.74;
/** Cheer follows the pass stinger by this much (ms). */
const LEVEL_PASS_CHEER_DELAY_MS = 420;
/** ~250 ms full quack, 250 ms fade, hard stop at 500 ms. */
const WAKE_QUACK_HOLD_MS = 250;
const WAKE_QUACK_FADE_MS = 250;
const WAKE_QUACK_TOTAL_MS = 500;
const BACKGROUND_FADE_IN_MS = 1500;
const BACKGROUND_FADE_STEP_MS = 50;

type BackgroundTrack = {
  clip: HTMLAudioElement;
  peak: number;
  fadeInterval?: number;
  fadeTargetVolume?: number;
};

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
  private readonly comboClip: HTMLAudioElement;
  private readonly moonflowerClip: HTMLAudioElement;
  private readonly lifeClip: HTMLAudioElement;
  private readonly crackingEggClip: HTMLAudioElement;
  private readonly levelPassClip: HTMLAudioElement;
  private readonly cheeringClip: HTMLAudioElement;
  private readonly woodClip: HTMLAudioElement;
  private lastWakeIndex = -1;
  private activeWakePlayback: HTMLAudioElement | null = null;
  private activeGoldenPlayback: HTMLAudioElement | null = null;
  private wakeFadeHandles: FadeHandles | null = null;
  private goldenFadeHandles: FadeHandles | null = null;

  private readonly backgroundTracks: BackgroundTrack[] = [];
  private backgroundActive = false;
  private backgroundUnlockHandlersAttached = false;
  /** Tab/app hidden, settings drawer, etc. */
  private playbackInterruptionCount = 0;
  /** When false, scheduled gameplay SFX (combo stacks, etc.) are skipped. */
  private gameplaySfxActive = true;
  private scheduledSfxTimeouts: number[] = [];
  private activeOneShots: HTMLAudioElement[] = [];

  private constructor() {
    const muted = isMasterMuted();
    this.wakeClips = WAKE_QUACK_URLS.map((url) => {
      const clip = new Audio(url);
      clip.preload = 'auto';
      clip.loop = false;
      clip.muted = muted;
      return clip;
    });
    this.goldenWakeClip = new Audio(GOLDEN_WAKE_URL);
    this.goldenWakeClip.preload = 'auto';
    this.goldenWakeClip.loop = false;
    this.goldenWakeClip.muted = muted;

    this.comboClip = new Audio(COMBO_URL);
    this.comboClip.preload = 'auto';
    this.comboClip.loop = false;
    this.comboClip.muted = muted;

    this.moonflowerClip = new Audio(MOONFLOWER_URL);
    this.moonflowerClip.preload = 'auto';
    this.moonflowerClip.loop = false;
    this.moonflowerClip.muted = muted;

    this.lifeClip = new Audio(LIFE_URL);
    this.lifeClip.preload = 'auto';
    this.lifeClip.loop = false;
    this.lifeClip.muted = muted;

    this.crackingEggClip = new Audio(CRACKING_EGG_URL);
    this.crackingEggClip.preload = 'auto';
    this.crackingEggClip.loop = false;
    this.crackingEggClip.muted = muted;

    this.levelPassClip = new Audio(LEVEL_PASS_URL);
    this.levelPassClip.preload = 'auto';
    this.levelPassClip.loop = false;
    this.levelPassClip.muted = muted;

    this.cheeringClip = new Audio(CHEERING_URL);
    this.cheeringClip.preload = 'auto';
    this.cheeringClip.loop = false;
    this.cheeringClip.muted = muted;

    this.woodClip = new Audio(WOOD_URL);
    this.woodClip.preload = 'auto';
    this.woodClip.loop = false;
    this.woodClip.muted = muted;

    for (const { url, peak } of GAMEPLAY_BACKGROUND_LOOPS) {
      const clip = new Audio(url);
      clip.preload = 'auto';
      clip.loop = true;
      clip.volume = 0;
      clip.muted = muted;
      this.backgroundTracks.push({ clip, peak });
    }

    subscribeMasterMute((m) => this.applyMasterMute(m));
  }

  /** Mute every long-running sound element (loops + active quacks). */
  private applyMasterMute(muted: boolean): void {
    for (const clip of this.wakeClips) clip.muted = muted;
    this.goldenWakeClip.muted = muted;
    this.comboClip.muted = muted;
    this.moonflowerClip.muted = muted;
    this.lifeClip.muted = muted;
    this.crackingEggClip.muted = muted;
    this.levelPassClip.muted = muted;
    this.cheeringClip.muted = muted;
    this.woodClip.muted = muted;
    for (const { clip } of this.backgroundTracks) clip.muted = muted;
    if (this.activeWakePlayback) this.activeWakePlayback.muted = muted;
    if (this.activeGoldenPlayback) this.activeGoldenPlayback.muted = muted;
  }

  static getInstance(): SoundManager {
    if (!instance) {
      instance = new SoundManager();
    }
    return instance;
  }

  static forScene(_scene: Phaser.Scene): SoundManager {
    return SoundManager.getInstance();
  }

  private isPlaybackBlocked(): boolean {
    if (this.playbackInterruptionCount > 0) return true;
    return typeof document !== 'undefined' && document.hidden;
  }

  pauseForInterruption(): void {
    this.playbackInterruptionCount += 1;
    if (this.playbackInterruptionCount === 1) {
      this.stopWakeClips();
      this.pauseGameplayBackground();
      if (this.ctx && this.ctx.state !== 'closed') {
        void this.ctx.suspend();
      }
    }
  }

  resumeFromInterruption(): void {
    if (this.playbackInterruptionCount <= 0) return;
    this.playbackInterruptionCount -= 1;
    if (this.playbackInterruptionCount === 0 && !this.isPlaybackBlocked()) {
      void this.resumeContext();
      this.resumeGameplayBackground();
    }
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
    this.refreshBackgroundPlayback();
  }

  setSfxEnabled(enabled: boolean): void {
    setSfxEnabled(enabled);
    this.sfxVolume = getSfxVolume();
    this.sfxEnabled = this.sfxVolume > 0.001;
    if (!this.sfxEnabled) {
      this.stopWakeClips();
    }
    this.refreshBackgroundPlayback();
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
    if (this.comboClip.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      this.comboClip.load();
    }
    if (this.moonflowerClip.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      this.moonflowerClip.load();
    }
    if (this.lifeClip.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      this.lifeClip.load();
    }
    if (this.crackingEggClip.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      this.crackingEggClip.load();
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

  /** Harsh on/off buzzer for tapping a duck before it is saveable. */
  private playTooEarlyBuzzer(): void {
    const ctx = this.resumeContext();
    if (!ctx) return;

    const run = () => {
      const t0 = ctx.currentTime;
      const duration = 0.34;
      const peak = this.scaledGain(0.13);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 262;

      gain.gain.setValueAtTime(0, t0);
      const flutterHz = 16;
      const steps = Math.floor(duration * flutterHz);
      for (let i = 0; i < steps; i++) {
        const step = t0 + i / flutterHz;
        gain.gain.setValueAtTime(i % 2 === 0 ? peak : peak * 0.35, step);
      }
      gain.gain.setValueAtTime(peak * 0.2, t0 + duration - 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    };

    if (ctx.state === 'running') {
      run();
      return;
    }
    void ctx.resume().then(() => {
      if (ctx.state === 'running') run();
    });
  }

  /** Missed tap — airy whiff with a soft sploosh (empty space, decoy, etc.). */
  private playBadTapWhiff(): void {
    const ctx = this.resumeContext();
    if (!ctx) return;

    const run = () => {
      const t0 = ctx.currentTime;
      const dur = 0.17;
      const peak = this.scaledGain(0.15);

      const sampleCount = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < sampleCount; i++) {
        const env = 1 - i / sampleCount;
        samples[i] = (Math.random() * 2 - 1) * env * env;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(1400, t0);
      bandpass.frequency.exponentialRampToValueAtTime(320, t0 + dur);
      bandpass.Q.value = 0.55;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(peak, t0);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur + 0.02);

      noise.connect(bandpass);
      bandpass.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(t0);
      noise.stop(t0 + dur + 0.03);

      const thump = ctx.createOscillator();
      const thumpGain = ctx.createGain();
      thump.type = 'sine';
      thump.frequency.setValueAtTime(200, t0);
      thump.frequency.exponentialRampToValueAtTime(55, t0 + 0.11);
      thumpGain.gain.setValueAtTime(peak * 0.4, t0);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.13);
      thump.connect(thumpGain);
      thumpGain.connect(ctx.destination);
      thump.start(t0);
      thump.stop(t0 + 0.14);
    };

    if (ctx.state === 'running') {
      run();
      return;
    }
    void ctx.resume().then(() => {
      if (ctx.state === 'running') run();
    });
  }

  /** Combo meter start or milestone — stacked combo.mp3 layers at milestones. */
  playComboReward(kind: 'start' | 'milestone', milestoneTier = 0): void {
    if (!this.sfxEnabled || !this.gameplaySfxActive || this.isPlaybackBlocked()) return;
    if (isMasterMuted()) return;
    this.tryUnlock();
    const tierBoost = kind === 'milestone' ? Math.min(milestoneTier, 6) * 0.04 : 0;
    const volume = COMBO_PEAK_VOLUME + tierBoost;

    if (kind === 'start') {
      this.playGenericOneShot(this.comboClip, volume);
      return;
    }

    const layers =
      COMBO.milestoneRewardLayers[
        Math.min(Math.max(milestoneTier, 0), COMBO.milestoneRewardLayers.length - 1)
      ];
    /** Each staggered hit in this burst is 5% louder than the previous one. */
    const LAYER_BUILD_FACTOR = 1.05;
    const stackPeakVolume = Math.min(1, volume);
    const stackStartVolume =
      layers > 1
        ? stackPeakVolume / LAYER_BUILD_FACTOR ** (layers - 1)
        : stackPeakVolume;
    for (let i = 0; i < layers; i++) {
      const layerVolume = Math.min(1, stackStartVolume * LAYER_BUILD_FACTOR ** i);
      this.scheduleGameplaySfx(() => {
        this.playGenericOneShot(this.comboClip, layerVolume);
      }, i * COMBO.milestoneRewardStackMs);
    }
  }

  /** Moonflower tapped and collected. */
  playMoonflowerCollect(): void {
    if (!this.sfxEnabled || !this.gameplaySfxActive || this.isPlaybackBlocked()) return;
    if (isMasterMuted()) return;
    this.tryUnlock();
    this.playGenericOneShot(this.moonflowerClip, MOONFLOWER_PEAK_VOLUME);
  }

  /** Balloon pop or golden egg — player gained a heart. */
  playLifeGain(): void {
    if (!this.sfxEnabled || !this.gameplaySfxActive || this.isPlaybackBlocked()) return;
    if (isMasterMuted()) return;
    this.tryUnlock();
    this.playGenericOneShot(this.lifeClip, LIFE_PEAK_VOLUME);
  }

  /** Full golden egg cracks open (plays before life gain). */
  playGoldenEggCrack(): void {
    if (!this.sfxEnabled || !this.gameplaySfxActive || this.isPlaybackBlocked()) return;
    if (isMasterMuted()) return;
    this.tryUnlock();
    this.playGenericOneShot(this.crackingEggClip, CRACKING_EGG_PEAK_VOLUME);
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
    clip.muted = isMasterMuted();
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
    this.stopPlayback(this.activeGoldenPlayback, 'golden');
    this.activeGoldenPlayback = null;
    this.playGenericOneShot(this.goldenWakeClip, GOLDEN_WAKE_PEAK_VOLUME);
  }

  /** Nightfall level-pass stinger, then a short crowd cheer. */
  playLevelPassedCelebration(): void {
    if (!this.sfxEnabled || !this.gameplaySfxActive || this.isPlaybackBlocked()) return;
    if (isMasterMuted()) return;

    this.tryUnlock();
    this.playGenericOneShot(this.levelPassClip, LEVEL_PASS_PEAK_VOLUME);
    this.scheduleGameplaySfx(() => {
      this.playGenericOneShot(this.cheeringClip, CHEERING_PEAK_VOLUME);
    }, LEVEL_PASS_CHEER_DELAY_MS);
  }

  private playGenericOneShot(source: HTMLAudioElement, peakVolume: number): void {
    const clip = new Audio(source.src);
    clip.preload = 'auto';
    clip.loop = false;
    clip.muted = isMasterMuted();
    clip.volume = this.scaledClipVolume(peakVolume);
    this.trackOneShot(clip);
    void clip.play().catch(() => {
      this.untrackOneShot(clip);
    });
  }

  private trackOneShot(clip: HTMLAudioElement): void {
    this.activeOneShots.push(clip);
    clip.addEventListener(
      'ended',
      () => {
        this.untrackOneShot(clip);
      },
      { once: true },
    );
  }

  private untrackOneShot(clip: HTMLAudioElement): void {
    const idx = this.activeOneShots.indexOf(clip);
    if (idx >= 0) this.activeOneShots.splice(idx, 1);
  }

  private scheduleGameplaySfx(fn: () => void, delayMs: number): void {
    const id = window.setTimeout(() => {
      this.unscheduleSfx(id);
      if (!this.gameplaySfxActive || !this.sfxEnabled || this.isPlaybackBlocked()) return;
      if (isMasterMuted()) return;
      fn();
    }, delayMs);
    this.scheduledSfxTimeouts.push(id);
  }

  private unscheduleSfx(id: number): void {
    const idx = this.scheduledSfxTimeouts.indexOf(id);
    if (idx >= 0) this.scheduledSfxTimeouts.splice(idx, 1);
  }

  private clearScheduledSfx(): void {
    for (const id of this.scheduledSfxTimeouts) {
      window.clearTimeout(id);
    }
    this.scheduledSfxTimeouts = [];
  }

  private stopActiveOneShots(): void {
    for (const clip of this.activeOneShots) {
      clip.pause();
      clip.currentTime = 0;
    }
    this.activeOneShots = [];
  }

  /** Cut off gameplay SFX (combo layers, quacks, ambient loops) when a run ends. */
  stopAllGameplaySfx(): void {
    this.gameplaySfxActive = false;
    this.clearScheduledSfx();
    this.stopWakeClips();
    this.stopActiveOneShots();
    this.stopGameplayBackground();
    if (this.ctx && this.ctx.state === 'running') {
      void this.ctx.suspend().then(() => {
        if (this.ctx && this.ctx.state === 'suspended') {
          void this.ctx.resume();
        }
      });
    }
  }

  /** Re-enable gameplay one-shots at the start of a new run. */
  resumeGameplaySfx(): void {
    this.gameplaySfxActive = true;
  }

  private playWakeQuack(): void {
    this.resumeContext();
    this.stopPlayback(this.activeGoldenPlayback, 'golden');
    this.activeGoldenPlayback = null;
    this.stopPlayback(this.activeWakePlayback, 'wake');
    this.playOneShot(this.pickWakeClip(), 'wake', WAKE_QUACK_PEAK_VOLUME);
  }

  play(id: SoundId): void {
    if (!this.sfxEnabled || this.isPlaybackBlocked()) return;
    if (isMasterMuted()) return;

    this.tryUnlock();

    switch (id) {
      case 'wake':
        if (!this.gameplaySfxActive) return;
        this.playWakeQuack();
        break;
      case 'goldenWake':
        if (!this.gameplaySfxActive) return;
        this.playGoldenWake();
        break;
      case 'miss':
        if (!this.gameplaySfxActive) return;
        this.beep(180, 0.2, 'sawtooth', 0.1);
        break;
      case 'lifeLost':
        if (!this.gameplaySfxActive) return;
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
        if (!this.gameplaySfxActive) return;
        this.beep(140, 0.22, 'sawtooth', 0.12);
        break;
      case 'badTap':
        if (!this.gameplaySfxActive) return;
        this.playBadTapWhiff();
        break;
      case 'earlyBuzzer':
        if (!this.gameplaySfxActive) return;
        this.playTooEarlyBuzzer();
        break;
      case 'bonus':
        if (!this.gameplaySfxActive) return;
        this.beep(660, 0.08, 'sine', 0.12);
        window.setTimeout(() => {
          if (!this.gameplaySfxActive) return;
          this.beep(880, 0.1, 'sine', 0.1);
        }, 90);
        break;
      case 'decoyRock':
        if (!this.gameplaySfxActive) return;
        this.playGenericOneShot(this.woodClip, WOOD_PEAK_VOLUME);
        break;
    }
  }

  /** First menu tap — unlock and play a short confirmation blip. */
  unlock(): void {
    this.tryUnlock();
    this.play('tap');
  }

  /** Begin (or resume) the gameplay ambient loops. Safe to call repeatedly. */
  startGameplayBackground(): void {
    this.backgroundActive = true;
    this.attachBackgroundUnlock();
    this.refreshBackgroundPlayback();
  }

  /** Pause loops while keeping `backgroundActive` so resume can restart them. */
  pauseGameplayBackground(): void {
    for (const track of this.backgroundTracks) {
      this.cancelBackgroundFade(track);
      track.clip.pause();
    }
  }

  resumeGameplayBackground(): void {
    if (!this.backgroundActive) return;
    this.refreshBackgroundPlayback();
  }

  /** Fully stop ambient loops (scene shutdown / quit). */
  stopGameplayBackground(): void {
    this.backgroundActive = false;
    for (const track of this.backgroundTracks) {
      this.cancelBackgroundFade(track);
      track.clip.pause();
      track.clip.currentTime = 0;
      track.clip.volume = 0;
    }
  }

  private getBackgroundTargetVolume(peak: number): number {
    if (!this.sfxEnabled) return 0;
    return Phaser.Math.Clamp(this.sfxVolume * peak, 0, 1);
  }

  private cancelBackgroundFade(track: BackgroundTrack): void {
    if (track.fadeInterval !== undefined) {
      clearInterval(track.fadeInterval);
      track.fadeInterval = undefined;
    }
    track.fadeTargetVolume = undefined;
  }

  private startBackgroundFadeIn(track: BackgroundTrack, targetVolume: number): void {
    this.cancelBackgroundFade(track);
    const { clip } = track;
    track.fadeTargetVolume = targetVolume;
    const startVolume = clip.volume;
    const startTime = performance.now();

    track.fadeInterval = window.setInterval(() => {
      const target = track.fadeTargetVolume ?? targetVolume;
      const t = Math.min(1, (performance.now() - startTime) / BACKGROUND_FADE_IN_MS);
      clip.volume = startVolume + (target - startVolume) * t;
      if (t >= 1) {
        clip.volume = target;
        this.cancelBackgroundFade(track);
      }
    }, BACKGROUND_FADE_STEP_MS);
  }

  private refreshBackgroundPlayback(): void {
    if (typeof document !== 'undefined' && document.hidden) {
      this.pauseGameplayBackground();
      return;
    }

    for (const track of this.backgroundTracks) {
      const { clip, peak } = track;
      const targetVolume = this.getBackgroundTargetVolume(peak);
      const shouldPlay = this.backgroundActive && targetVolume > 0;

      if (shouldPlay) {
        if (clip.paused) {
          clip.volume = 0;
          const beginFade = () => this.startBackgroundFadeIn(track, targetVolume);
          const result = clip.play();
          if (result) {
            void result.then(beginFade).catch(() => {
              /* Autoplay blocked — pointerdown unlock will retry. */
            });
          } else {
            beginFade();
          }
        } else if (track.fadeInterval !== undefined) {
          track.fadeTargetVolume = targetVolume;
        } else {
          clip.volume = targetVolume;
        }
      } else {
        this.cancelBackgroundFade(track);
        clip.pause();
      }
    }
  }

  /** Some browsers require a user gesture before audio can start; retry once on the next pointer. */
  private attachBackgroundUnlock(): void {
    if (this.backgroundUnlockHandlersAttached) return;
    this.backgroundUnlockHandlersAttached = true;

    const tryStart = () => {
      if (!this.backgroundActive) return;
      this.refreshBackgroundPlayback();
      const stillBlocked = this.backgroundTracks.some(({ clip }) => clip.paused);
      if (!stillBlocked) {
        document.removeEventListener('pointerdown', tryStart, true);
        document.removeEventListener('touchstart', tryStart, true);
        this.backgroundUnlockHandlersAttached = false;
      }
    };

    document.addEventListener('pointerdown', tryStart, { capture: true, passive: true });
    document.addEventListener('touchstart', tryStart, { capture: true, passive: true });
  }

  clearPlaybackInterruptions(): void {
    this.playbackInterruptionCount = 0;
    if (typeof document !== 'undefined' && document.hidden) {
      this.pauseForInterruption();
    }
  }

  detach(): void {
    this.stopAllGameplaySfx();
    this.clearPlaybackInterruptions();
  }
}
