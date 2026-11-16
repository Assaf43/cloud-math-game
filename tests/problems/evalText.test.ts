import { evalText } from './evalText';
import { rat } from '../../src/problems/rational';

test('evalText handles precedence, parentheses, fractions, decimals', () => {
  expect(evalText('2 + 3 × 4')).toEqual(rat(14));
  expect(evalText('(2 + 3) × 4')).toEqual(rat(20));
  expect(evalText('48 ÷ 6')).toEqual(rat(8));
  expect(evalText('1/2 + 1/4')).toEqual(rat(3, 4));
  expect(evalText('1 1/2 + 1/2')).toEqual(rat(2));
  expect(evalText('2.5 + 0.25')).toEqual(rat(11, 4));
});
test('evalText returns null for Hebrew or placeholders', () => {
  expect(evalText('3/4 מתוך 20')).toBeNull();
  expect(evalText('2/3 = ▢/12')).toBeNull();
});
