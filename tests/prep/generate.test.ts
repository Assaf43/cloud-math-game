import { describe, expect, it } from 'vitest';
import { canVary, generateSimilar } from '../../src/prep/generate';
import { exerciseAnswer } from '../../src/prep/expr';
import { choiceCount } from '../../src/problems/choices';
import { eq } from '../../src/problems/rational';
import { createRng } from '../../src/rng';
import { evalText } from '../problems/evalText';
import { EXAMPLES, shape } from './helpers';
import type { Rational } from '../../src/types';

/** The answer checked against the text with tests/problems/evalText.ts, not with the code that produced it. */
function independentCheck(form: string, text: string, answer: Rational, where: string) {
  const same = (a: Rational | null, b: Rational | null) => a !== null && b !== null && eq(a, b);
  if (form === 'plain') return expect(same(evalText(text), answer), where).toBe(true);
  if (form === 'convert') return expect(same(evalText(text.split(' = ')[0]), answer), where).toBe(true);
  // missing and expand: put the answer in the box, then both sides of = must be equal
  const filled = text.replace('▢', answer.d === 1 ? String(answer.n) : `${answer.n}/${answer.d}`);
  const [left, right] = filled.split(' = ');
  expect(same(evalText(left), evalText(right)), where).toBe(true);
}

describe.each(EXAMPLES)('%s', example => {
  const s = shape(example);
  it.each(['beginner', 'advanced', 'expert'] as const)('%s: 200 correct, same-shape, well-formed problems', d => {
    for (let seed = 0; seed < 200; seed++) {
      const p = generateSimilar(s, d, 5, createRng(seed), new Set())!;
      const again = shape(p.text);                                     // the generated text parses back
      const loose = (k: string) => k.replace(/i\d+/g, 'i');           // amended 2026-11-19: expert may add a digit
      expect(d === 'expert' ? loose(again.key) : again.key).toBe(d === 'expert' ? loose(s.key) : s.key);
      expect(p.shapeKey).toBe(s.key);
      expect(eq(exerciseAnswer(again.exercise), p.answer.value)).toBe(true);   // independent recomputation from the text
      expect(p.answer.kind).toBe(s.answerKind);
      expect(p.answer.text.length).toBeLessThanOrEqual(8);
      expect(p.text).not.toBe(s.exampleText);
      expect(p.choices.filter(c => eq(c.value, p.answer.value))).toHaveLength(1);
      expect(new Set(p.choices.map(c => c.text)).size).toBe(choiceCount(d));
      independentCheck(p.exercise.form, p.text, p.answer.value, `${example} ${d} seed ${seed}`);
    }
  });
  it('can be varied', () => expect(canVary(s, 5)).toBe(true));
});
it('also checks plain texts with the independent test evaluator', () => {       // tests/problems/evalText.ts
  const p = generateSimilar(shape('6 × (2 + 3)'), 'expert', 5, createRng(7), new Set())!;
  expect(eq(evalText(p.text)!, p.answer.value)).toBe(true);
});
it('beginner stays at or below the example', () => {
  for (let seed = 0; seed < 100; seed++) {
    const [a, b] = generateSimilar(shape('48 × 6'), 'beginner', 5, createRng(seed), new Set())!.text.split(' × ').map(Number);
    expect(a).toBeGreaterThanOrEqual(24); expect(a).toBeLessThanOrEqual(48); expect(b).toBeGreaterThanOrEqual(3); expect(b).toBeLessThanOrEqual(6);
  }
});
it('keeps round numbers round', () => {
  for (let seed = 0; seed < 50; seed++) expect(Number(generateSimilar(shape('300 + 40'), 'advanced', 5, createRng(seed), new Set())!.text.split(' + ')[0]) % 100).toBe(0);
});
it('respects avoid and the grade cap', () => {
  const s = shape('48 × 6'); const first = generateSimilar(s, 'beginner', 5, createRng(3), new Set())!;
  expect(generateSimilar(s, 'beginner', 5, createRng(3), new Set([first.text]))!.text).not.toBe(first.text);
  for (let seed = 0; seed < 50; seed++) for (const n of generateSimilar(shape('900 + 80'), 'expert', 3, createRng(seed), new Set())!.text.split(' + ')) expect(Number(n)).toBeLessThanOrEqual(1000);
});
it.each(['1 × 1', '1 + 1'])('%s cannot be varied and never hangs', e => {
  expect(canVary(shape(e), 5)).toBe(false);
  const p = generateSimilar(shape(e), 'beginner', 5, createRng(1), new Set()); if (p) expect(p.text).not.toBe(e);
});
// owner ruling 2026-11-19: beginner fraction denominators come from 2…max(6, example denominators), capped at 12, same relation
it.each(['1/2 + 1/4', '1/2 + 1/3', '1 1/2 − 1/2'])('%s can be varied', e => expect(canVary(shape(e), 5)).toBe(true));
it('beginner 1/2 + 1/4 keeps denominators ≤ 6, one a multiple of the other', () => {
  for (let seed = 0; seed < 100; seed++) {
    const [a, b] = generateSimilar(shape('1/2 + 1/4'), 'beginner', 5, createRng(seed), new Set())!.text.split(' + ').map(f => Number(f.split('/')[1]));
    expect(a).toBeLessThanOrEqual(6); expect(b).toBeLessThanOrEqual(6);
    expect(a).not.toBe(b);
    expect(a % b === 0 || b % a === 0).toBe(true);
  }
});
// owner decision 2026-11-22: when the beginner ranges give fewer than 5 problems, beginner draws its whole numbers from the
// whole same-digit range (the advanced rule); fractions, mixed numbers, decimals, expand and convert keep their rules
const SMALL = ['2 × 3', '2 × 5', '3 × 3', '12 ÷ 4', '9 ÷ 3', '20 ÷ 4', '10 × 5', '7 × 10', '7 × 100', '20 × 3', '200 × 3', '12 × 2',
  '11 × 3', '100 − 50', '20 + 30', '10 − 5', '5 − 2', '▢ ÷ 3 = 4', '10 ÷ ▢ = 5', '1/2 × 2', '1.5 × 2'];
describe.each([3, 5] as const)('grade %s', g => {
  it.each(SMALL)('%s can be varied', e => expect(canVary(shape(e), g)).toBe(true));
  it.each(['1 × 1', '1 + 1'])('%s still cannot be varied', e => expect(canVary(shape(e), g)).toBe(false));
});
it('beginner 2 × 3 draws one-digit factors from 2…9 and never repeats the example', () => {
  for (let seed = 0; seed < 100; seed++) {
    const p = generateSimilar(shape('2 × 3'), 'beginner', 5, createRng(seed), new Set())!;
    expect(p.text).not.toBe('2 × 3');
    for (const n of p.text.split(' × ').map(Number)) { expect(n).toBeGreaterThanOrEqual(2); expect(n).toBeLessThanOrEqual(9); }
  }
});
it('beginner 7 × 10 keeps the round factor round and the same shape', () => {
  for (let seed = 0; seed < 100; seed++) {
    const p = generateSimilar(shape('7 × 10'), 'beginner', 5, createRng(seed), new Set())!;
    expect(Number(p.text.split(' × ')[1]) % 10).toBe(0);
    expect(shape(p.text).key).toBe('plain:i1×i2');
  }
});
it('a beginner shape that already has 5 problems is drawn exactly as before (48 × 6 stays within 24…48 and 3…6)', () => {
  for (let seed = 0; seed < 100; seed++) {
    const [a, b] = generateSimilar(shape('48 × 6'), 'beginner', 5, createRng(seed), new Set())!.text.split(' × ').map(Number);
    expect(a).toBeGreaterThanOrEqual(24); expect(a).toBeLessThanOrEqual(48); expect(b).toBeGreaterThanOrEqual(3); expect(b).toBeLessThanOrEqual(6);
  }
});
it('generateSimilar stays deterministic for a given rng, also when beginner is widened', () => {
  for (const e of ['2 × 3', '48 × 6'])
    for (let seed = 0; seed < 20; seed++)
      expect(generateSimilar(shape(e), 'beginner', 5, createRng(seed), new Set())!.text)
        .toBe(generateSimilar(shape(e), 'beginner', 5, createRng(seed), new Set())!.text);
});

it('gives up quickly on shapes that yield nothing', () => {   // the pack editor calls canVary on every keystroke
  const start = performance.now();
  for (const e of ['2/3 = ▢/10', '1 × 1', '1 + 1']) expect(canVary(shape(e), 5)).toBe(false);
  expect(performance.now() - start).toBeLessThan(200);
});
