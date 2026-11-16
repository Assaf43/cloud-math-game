export const CITY_BONUS = 150;

/** 100 for a correct answer plus up to 100 bonus, proportional to the time that was left. */
export function problemPoints(elapsedMs: number, limitMs: number): number {
  const remaining = Math.min(1, Math.max(0, 1 - elapsedMs / limitMs));
  return 100 + Math.round(100 * remaining);
}
