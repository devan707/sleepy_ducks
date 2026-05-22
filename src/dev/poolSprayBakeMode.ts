import { isDevMode } from './isDevMode';

/** Dev-only: `?bakePoolSpray=1` captures a spritesheet from live desktop-quality spray. */
export function isPoolSprayBakeUrlParam(): boolean {
  if (!isDevMode() || typeof window === 'undefined') return false;
  const v = new URLSearchParams(window.location.search).get('bakePoolSpray');
  return v === '1' || v === 'true';
}
