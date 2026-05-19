import { COMBO, getComboMilestoneIndexReached, SCORING } from '../config/gameConfig';

/** Streak multiplier — steps up only at combo milestones (see `COMBO.milestones`). */
export function comboMultiplier(combo: number): number {
  if (combo <= 1) return 1;
  const idx = getComboMilestoneIndexReached(combo);
  if (idx < 0) return 1;
  return COMBO.milestoneMultipliers[idx];
}

export function formatComboMultiplierLabel(combo: number): string {
  const mult = comboMultiplier(combo);
  return mult > 1 ? `×${mult.toFixed(1)} combo` : '';
}

/** Longer runs earn more per duck (linear ramp to cap). */
export function survivalMultiplier(timeSurvivedMs: number): number {
  const sec = Math.max(0, timeSurvivedMs) / 1000;
  const mult = 1 + sec / SCORING.survivalFullBonusSec;
  return Math.min(SCORING.survivalMaxMult, mult);
}

/** More ducks saved this run → higher value for the next save. */
export function progressMultiplier(ducksSavedBefore: number): number {
  const mult = 1 + Math.max(0, ducksSavedBefore) * SCORING.savedPerDuck;
  return Math.min(SCORING.savedMaxMult, mult);
}

export function scoreDuckSave(params: {
  kindBasePoints: number;
  combo: number;
  timeSurvivedMs: number;
  ducksSavedBefore: number;
}): number {
  const mult =
    comboMultiplier(params.combo) *
    survivalMultiplier(params.timeSurvivedMs) *
    progressMultiplier(params.ducksSavedBefore);
  return Math.round(params.kindBasePoints * mult);
}
