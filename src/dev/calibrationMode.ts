import { isDevMode } from './isDevMode';

/** Dev query param: `?calibrate=1` starts paused in lip calibration mode. */
export function isCalibrateUrlParam(): boolean {
  if (!isDevMode()) return false;
  if (typeof window === 'undefined') return false;
  const v = new URLSearchParams(window.location.search).get('calibrate');
  return v === '1' || v === 'true';
}

/** Dev query param: `?calibrate=flow` starts paused in flow atlas alignment mode. */
export function isCalibrateFlowUrlParam(): boolean {
  if (!isDevMode()) return false;
  if (typeof window === 'undefined') return false;
  const v = new URLSearchParams(window.location.search).get('calibrate');
  return v === 'flow';
}

/** Dev query param: `?calibrate=cliff` starts paused in left cliff alignment mode. */
export function isCalibrateCliffUrlParam(): boolean {
  if (!isDevMode()) return false;
  if (typeof window === 'undefined') return false;
  const v = new URLSearchParams(window.location.search).get('calibrate');
  return v === 'cliff';
}

export const CALIBRATION_MODE_EVENT = 'calibration-mode-changed';
