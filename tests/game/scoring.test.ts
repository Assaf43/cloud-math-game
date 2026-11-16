import { CITY_BONUS, problemPoints } from '../../src/game/scoring';

test('problemPoints', () => {
  expect(problemPoints(0, 30000)).toBe(200);
  expect(problemPoints(15000, 30000)).toBe(150);
  expect(problemPoints(30000, 30000)).toBe(100);
  expect(problemPoints(99999, 30000)).toBe(100);
});
test('negative elapsed time cannot exceed the maximum', () => {
  expect(problemPoints(-500, 30000)).toBe(200);
});
test('city bonus is 150', () => expect(CITY_BONUS).toBe(150));
