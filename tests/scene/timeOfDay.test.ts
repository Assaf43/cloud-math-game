import { timeOfDay } from '../../src/scene/timeOfDay';

test.each([[6, 'morning'], [10, 'morning'], [11, 'noon'], [15, 'noon'], [16, 'sunset'], [18, 'sunset'], [19, 'night'], [0, 'night'], [5, 'night']])(
  'hour %i is %s', (h, t) => expect(timeOfDay(new Date(2026, 10, 16, h, 30))).toBe(t));
