/** Whole-number score with thousands separators (e.g. 1,234,567). */
export function formatScore(value: number): string {
  return Math.max(0, Math.floor(value)).toLocaleString('en-US');
}
