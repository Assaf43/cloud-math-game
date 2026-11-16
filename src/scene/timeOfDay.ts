import type { TimeOfDay } from '../types';

/** Local device hour: 6-10 morning, 11-15 noon, 16-18 sunset, 19-5 night. */
export function timeOfDay(date: Date): TimeOfDay {
  const h = date.getHours();
  if (h >= 6 && h <= 10) return 'morning';
  if (h >= 11 && h <= 15) return 'noon';
  if (h >= 16 && h <= 18) return 'sunset';
  return 'night';
}
