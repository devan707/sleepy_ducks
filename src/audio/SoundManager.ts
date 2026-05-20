import Phaser from 'phaser';
import {
  GAMEPLAY_BACKGROUND_LOOPS,
  GOLDEN_WAKE_URL,
  WAKE_QUACK_URLS,
} from './soundPaths';
import { COMBO } from '../config/gameConfig';
import {
  getSfxVolume,
  isSfxEnabled,
  setSfxEnabled,
  setSfxVolume as persistSfxVolume,
} from '../storage/audioSettings';
import { isMasterMuted, subscribeMasterMute } from '../storage/masterMute';

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
  | 'bonus';

let instance: SoundManager | null = null;

/** Peak volume for mallard wake quacks (HTMLAudioElement 0–1). */
const WAKE_QUACK_PEAK_VOLUME = 0.62;
const GOLDEN_WAKE_PEAK_VOLUME = 0.7;
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

  /** Bright chime when the combo meter appears. */
  private playComboStartChime(): void {
    this.playScheduledChime(
      [
        { freq: 523, delay: 0, dur: 0.16 },
        { freq: 659, delay: 0.09, dur: 0.16 },
        { freq: 784, delay: 0.18, dur: 0.18 },
        { freq: 1047, delay: 0.3, dur: 0.22 },
        { freq: 1319, delay: 0.44, dur: 0.24, gainMult: 0.85 },
      ],
      0.2,
    );
  }

  /** Escalating fanfare at combo milestones (5 … 100). */
  private playComboMilestoneChime(tier: number): void {
    const baseNotes = [784, 880, 988, 1047, 1175, 1319, 1568, 1760];
    const noteCount = 3 + tier;
    const notes: Array<{ freq: number; delay: number; dur: number; gainMult?: number }> = [];

    for (let i = 0; i < noteCount; i++) {
      notes.push({
        freq: baseNotes[i % baseNotes.length] * (i >= baseNotes.length ? 1.25 : 1),
        delay: i * 0.075,
        dur: 0.12 + tier * 0.025,
      });
    }

    const chordAt = noteCount * 0.075;
    if (tier >= 1) {
      notes.push({ freq: 988, delay: chordAt, dur: 0.22 + tier * 0.04, gainMult: 0.9 });
      notes.push({ freq: 1175, delay: chordAt, dur: 0.22 + tier * 0.04, gainMult: 0.9 });
    }
    if (tier >= 2) {
      notes.push({ freq: 1319, delay: chordAt, dur: 0.22 + tier * 0.04, gainMult: 0.85 });
    }
    if (tier >= 3) {
      notes.push({ freq: 1568, delay: chordAt + 0.14, dur: 0.32, gainMult: 0.95 });
    }
    if (tier >= 4) {
      notes.push({ freq: 1760, delay: chordAt + 0.14, dur: 0.36, gainMult: 1 });
      notes.push({ freq: 2093, delay: chordAt + 0.28, dur: 0.42, gainMult: 0.9 });
    }
    if (tier >= 5) {
      notes.push({ freq: 2349, delay: chordAt + 0.32, dur: 0.44, gainMult: 0.95 });
    }
    if (tier >= 6) {
      notes.push({ freq: 2637, delay: chordAt + 0.4, dur: 0.48, gainMult: 1 });
    }

    this.playScheduledChime(notes, 0.15 + tier * 0.028);
  }

  private playScheduledChime(
    notes: ReadonlyArray<{ freq: number; delay: number; dur: number; gainMult?: number }>,
    masterGain: number,
  ): void {
    const ctx = this.resumeContext();
    if (!ctx) return;

    const run = () => {
      const t0 = ctx.currentTime;
      const peak = this.scaledGain(masterGain);
      for (const note of notes) {
        this.scheduleChimeTone(
          ctx,
          t0 + note.delay,
          note.freq,
          note.dur,
          peak * (note.gainMult ?? 1),
        );
      }
    };

    if (ctx.state === 'running') {
      run();
      return;
    }
    void ctx.resume().then(() => {
      if (ctx.state === 'running') run();
    });
  }

  private scheduleChimeTone(
    ctx: AudioContext,
    start: number,
    freq: number,
    dur: number,
    peak: number,
  ): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(peak, start + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  /** Combo meter start or milestone fanfare (tier 0 = 5 combo …). */
  playComboReward(kind: 'start' | 'milestone', milestoneTier = 0): void {
    if (!this.sfxEnabled) return;
    this.tryUnlock();
    if (kind === 'start') {
      this.playComboStartChime();
    } else {
      const maxTier = COMBO.milestones.length - 1;
      this.playComboMilestoneChime(
        Phaser.Math.Clamp(Math.floor(milestoneTier), 0, maxTier),
      );
    }
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
    if (!this.sfxEnabled || this.isPlaybackBlocked()) return;
    if (isMasterMuted()) return;

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
      case 'badTap':
        this.playBadTapWhiff();
        break;
      case 'earlyBuzzer':
        this.playTooEarlyBuzzer();
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
    this.stopWakeClips();
    this.stopGameplayBackground();
    this.clearPlaybackInterruptions();
  }
}
