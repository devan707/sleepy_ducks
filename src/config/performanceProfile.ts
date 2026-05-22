let cachedMobile: boolean | null = null;
let cachedWaterfallFxDisabled: boolean | null = null;

/**
 * Disable live waterfall particles for perf A/B testing on device.
 * Hosted PWA: `https://sleepyducks.app/?waterfallFx=0`
 */
export function isWaterfallFxDisabled(): boolean {
  if (cachedWaterfallFxDisabled !== null) return cachedWaterfallFxDisabled;
  if (typeof window === 'undefined') {
    cachedWaterfallFxDisabled = false;
    return cachedWaterfallFxDisabled;
  }
  const v = new URLSearchParams(window.location.search).get('waterfallFx');
  cachedWaterfallFxDisabled = v === '0' || v === 'off' || v === 'false';
  return cachedWaterfallFxDisabled;
}

/** Mobile pool-base FX uses tile loops instead of burst particle emitters. */
export function shouldUseBakedPoolSprayFx(): boolean {
  return isMobileGameplayProfile() && !isWaterfallFxDisabled();
}

/** Lip column streak emitters — fewer on mobile, still real particles (not tiles). */
export function getFallsStreakEmitterCount(desktopCount: number): number {
  if (!isMobileGameplayProfile()) return desktopCount;
  return Math.min(desktopCount, 6);
}

/** Micro-streaks below each rock foot. */
export function getRockStreakEmittersPerRock(desktopCount: number): number {
  if (!isMobileGameplayProfile()) return desktopCount;
  return Math.min(desktopCount, 2);
}

/** Touch-first phones and small tablets — desktop always false. */
export function isMobileGameplayProfile(): boolean {
  if (cachedMobile !== null) return cachedMobile;
  if (typeof window === 'undefined') {
    cachedMobile = false;
    return cachedMobile;
  }

  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  cachedMobile = coarsePointer && shortSide <= 820;
  return cachedMobile;
}

/** Pool spray wave/micro-burst tuning — desktop uses gameConfig values unchanged. */
export interface PoolSprayWaveTuning {
  burstQuantityMin: number;
  burstQuantityMax: number;
  waveIntervalMinMs: number;
  waveIntervalMaxMs: number;
  microBurstMinMs: number;
  microBurstMaxMs: number;
  microBurstQuantityMin: number;
  microBurstQuantityMax: number;
  /** Per burst emitter — omitted on desktop (no cap). */
  burstMaxParticles?: number;
}

export function getPoolSprayWaveTuning(cfg: {
  burstQuantityMin: number;
  burstQuantityMax: number;
  waveIntervalMinMs: number;
  waveIntervalMaxMs: number;
  microBurstMinMs: number;
  microBurstMaxMs: number;
  microBurstQuantityMin: number;
  microBurstQuantityMax: number;
}): PoolSprayWaveTuning {
  if (!isMobileGameplayProfile()) {
    return { ...cfg };
  }

  return {
    burstQuantityMin: 10,
    burstQuantityMax: 20,
    waveIntervalMinMs: Math.round(cfg.waveIntervalMinMs * 1.3),
    waveIntervalMaxMs: Math.round(cfg.waveIntervalMaxMs * 1.3),
    microBurstMinMs: Math.round(cfg.microBurstMinMs * 2),
    microBurstMaxMs: Math.round(cfg.microBurstMaxMs * 2),
    microBurstQuantityMin: Math.max(1, Math.round(cfg.microBurstQuantityMin * 0.5)),
    microBurstQuantityMax: Math.max(2, Math.round(cfg.microBurstQuantityMax * 0.5)),
    burstMaxParticles: 24,
  };
}
