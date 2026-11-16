import { rat, add, sub, mul, div, eq, intAnswer, fractionAnswer, decimalAnswer } from '../../src/problems/rational';

test('arithmetic reduces', () => {
  expect(add(rat(1, 4), rat(1, 4))).toEqual({ n: 1, d: 2 });
  expect(div(rat(3, 4), rat(3, 8))).toEqual({ n: 2, d: 1 });
});
test('sub and mul, eq, and guarded errors', () => {
  expect(sub(rat(3, 4), rat(1, 4))).toEqual({ n: 1, d: 2 });
  expect(mul(rat(2, 3), rat(3, 4))).toEqual({ n: 1, d: 2 });
  expect(eq(rat(6, 8), rat(3, 4))).toBe(true);
  expect(eq(rat(1, 2), rat(1, 3))).toBe(false);
  expect(() => rat(1, 0)).toThrow();
  expect(() => rat(-1, 2)).toThrow();
  expect(() => sub(rat(1, 4), rat(1, 2))).toThrow();
  expect(() => div(rat(1), rat(0))).toThrow();
  expect(intAnswer(7)).toEqual({ value: { n: 7, d: 1 }, kind: 'int', text: '7' });
});
test('formatting', () => {
  expect(fractionAnswer(rat(3, 2)).text).toBe('1 1/2');
  expect(fractionAnswer(rat(6, 8)).text).toBe('3/4');
  expect(fractionAnswer(rat(4, 2))).toMatchObject({ kind: 'int', text: '2' });
  expect(decimalAnswer(rat(5, 2)).text).toBe('2.5');
  expect(decimalAnswer(rat(1, 20)).text).toBe('0.05');
  expect(decimalAnswer(rat(3)).text).toBe('3');
  expect(() => decimalAnswer(rat(1, 3))).toThrow();
});
