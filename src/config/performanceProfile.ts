let cachedMobile: boolean | null = null;

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
