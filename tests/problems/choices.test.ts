import { buildChoices, choiceCount } from '../../src/problems/choices';
import { rat, eq, intAnswer, fractionAnswer, decimalAnswer } from '../../src/problems/rational';
import { createRng } from '../../src/rng';

test.each([['beginner', 4], ['advanced', 5], ['expert', 6]] as const)('%s has %i choices', (d, n) =>
  expect(choiceCount(d)).toBe(n));
test('contains the answer once, right count, all distinct and non-negative', () => {
  for (let seed = 0; seed < 200; seed++) {
    const ans = intAnswer(seed % 3);                       // small answers stress the filters
    const out = buildChoices(ans, [rat(0), rat(seed % 3)], 6, createRng(seed));
    expect(out).toHaveLength(6);
    expect(out.filter(c => eq(c.value, ans.value))).toHaveLength(1);
    expect(new Set(out.map(c => `${c.value.n}/${c.value.d}`)).size).toBe(6);
  }
});
test('prefers supplied candidates', () => {
  const out = buildChoices(intAnswer(56), [rat(54), rat(48), rat(63)], 4, createRng(1));
  expect(out.map(c => c.text).sort()).toEqual(['48', '54', '56', '63']);
});
test('fraction and decimal answers keep their kind', () => {
  expect(buildChoices(fractionAnswer(rat(3, 4)), [], 6, createRng(1)).every(c => c.kind !== 'decimal')).toBe(true);
  expect(buildChoices(decimalAnswer(rat(5, 2)), [], 6, createRng(1)).every(c => c.kind !== 'fraction')).toBe(true);
});
test('decimal choices stay within 2 decimal places and are distinct', () => {
  for (let seed = 0; seed < 100; seed++) {
    const out = buildChoices(decimalAnswer(rat(seed % 40 + 1, 20)), [], 6, createRng(seed));
    expect(out).toHaveLength(6);
    expect(out.every(c => 100 % c.value.d === 0)).toBe(true);
    expect(new Set(out.map(c => c.text)).size).toBe(6);
  }
});
test('fraction choices are distinct for many answers', () => {
  for (let seed = 0; seed < 100; seed++) {
    const out = buildChoices(fractionAnswer(rat(seed % 7 + 1, seed % 5 + 2)), [], 6, createRng(seed));
    expect(out).toHaveLength(6);
    expect(new Set(out.map(c => c.text)).size).toBe(6);
  }
});
test('unrepresentable or negative candidates are dropped', () => {
  const out = buildChoices(intAnswer(10), [rat(1, 2), { n: -3, d: 1 }, rat(10)], 4, createRng(1));
  expect(out).toHaveLength(4);
  expect(out.every(c => c.kind === 'int' && c.value.n >= 0)).toBe(true);
});
