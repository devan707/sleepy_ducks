const KEY = 'sleeping-ducks-audio';
const LEGACY_KEY = 'sleeping-ducks-sound';

export interface AudioSettings {
  music: boolean;
  sfx: boolean;
  musicVolume: number;
  sfxVolume: number;
}

const DEFAULTS: AudioSettings = {
  music: true,
  sfx: true,
  musicVolume: 0.28,
  sfxVolume: 0.42,
};

let musicRestoreVolume = DEFAULTS.musicVolume;
let sfxRestoreVolume = DEFAULTS.sfxVolume;

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function load(): AudioSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AudioSettings>;
      const musicVolume =
        typeof parsed.musicVolume === 'number'
          ? clamp01(parsed.musicVolume)
          : parsed.music === false
            ? 0
            : DEFAULTS.musicVolume;
      const sfxVolume =
        typeof parsed.sfxVolume === 'number'
          ? clamp01(parsed.sfxVolume)
          : parsed.sfx === false
            ? 0
            : DEFAULTS.sfxVolume;
      return {
        music: musicVolume > 0.001,
        sfx: sfxVolume > 0.001,
        musicVolume,
        sfxVolume,
      };
    }

    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy !== null) {
      const on = legacy === '1';
      const settings = {
        music: on,
        sfx: on,
        musicVolume: on ? DEFAULTS.musicVolume : 0,
        sfxVolume: on ? DEFAULTS.sfxVolume : 0,
      };
      if (settings.musicVolume > 0.001) musicRestoreVolume = settings.musicVolume;
      if (settings.sfxVolume > 0.001) sfxRestoreVolume = settings.sfxVolume;
      return settings;
    }
  } catch {
    /* ignore */
  }
  const settings = { ...DEFAULTS };
  musicRestoreVolume = settings.musicVolume;
  sfxRestoreVolume = settings.sfxVolume;
  return settings;
}

function save(settings: AudioSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* ignore quota / private mode */
  }
}

let cached = load();
if (cached.musicVolume > 0.001) musicRestoreVolume = cached.musicVolume;
if (cached.sfxVolume > 0.001) sfxRestoreVolume = cached.sfxVolume;

export function getAudioSettings(): AudioSettings {
  return { ...cached };
}

export function isMusicEnabled(): boolean {
  return cached.musicVolume > 0.001;
}

export function isSfxEnabled(): boolean {
  return cached.sfxVolume > 0.001;
}

export function getMusicVolume(): number {
  return cached.musicVolume;
}

export function getSfxVolume(): number {
  return cached.sfxVolume;
}

export function setMusicVolume(volume: number): void {
  const musicVolume = clamp01(volume);
  if (musicVolume > 0.001) {
    musicRestoreVolume = musicVolume;
  }
  cached = {
    ...cached,
    musicVolume,
    music: musicVolume > 0.001,
  };
  save(cached);
}

export function setSfxVolume(volume: number): void {
  const sfxVolume = clamp01(volume);
  if (sfxVolume > 0.001) {
    sfxRestoreVolume = sfxVolume;
  }
  cached = {
    ...cached,
    sfxVolume,
    sfx: sfxVolume > 0.001,
  };
  save(cached);
}

export function setMusicEnabled(enabled: boolean): void {
  if (enabled) {
    setMusicVolume(
      musicRestoreVolume > 0.001 ? musicRestoreVolume : DEFAULTS.musicVolume,
    );
    return;
  }
  setMusicVolume(0);
}

export function setSfxEnabled(enabled: boolean): void {
  if (enabled) {
    setSfxVolume(sfxRestoreVolume > 0.001 ? sfxRestoreVolume : DEFAULTS.sfxVolume);
    return;
  }
  setSfxVolume(0);
}

export function getMusicRestoreVolume(): number {
  return musicRestoreVolume;
}

export function getSfxRestoreVolume(): number {
  return sfxRestoreVolume;
}

/** @deprecated Use isSfxEnabled */
export function isSoundEnabled(): boolean {
  return isSfxEnabled();
}

/** @deprecated Use setSfxEnabled */
export function setSoundEnabled(enabled: boolean): void {
  setSfxEnabled(enabled);
}
