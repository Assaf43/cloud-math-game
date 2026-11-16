import type { Rng } from '../types';
import { pick, randInt } from '../rng';
import { intProblem, type TopicGenerator } from './topic';

/*
 * Whole-number exercise builders shared by grades 4-6: sums and differences, products, exact divisions, "missing
 * number" and order-of-operations exercises such as 6 × (2 + 3). Numbers are kept small enough for mental arithmetic;
 * every exercise has a whole, non-negative answer.
 */

type Range = readonly [number, number];
const draw = (rng: Rng, ranges: readonly Range[]) => ranges.map(([lo, hi]) => randInt(rng, lo, hi));

// ---- sums, products, divisions --------------------------------------------------------
/** a + b where each operand is a multiple of `unit` and the sum stays at most `max`. */
export const sumGen = (topic: string, lo: number, hi: number, max: number, unit = 1): TopicGenerator => rng => {
  const a = randInt(rng, lo / unit, Math.min(hi, max - lo) / unit) * unit;
  const b = randInt(rng, lo / unit, Math.min(hi, max - a) / unit) * unit;
  const s = a + b;
  return intProblem(topic, `${a} + ${b}`, s, [s + 10 * unit, s - 10 * unit, s + 100 * unit, s - 100 * unit, s + unit, s - unit]);
};

/** a − b, a up to `hi`, b at least `lo`, both multiples of `unit`. */
export const diffGen = (topic: string, lo: number, hi: number, unit = 1): TopicGenerator => rng => {
  const a = randInt(rng, (lo * 2) / unit, hi / unit) * unit;
  const b = randInt(rng, lo / unit, a / unit - 1) * unit;
  const r = a - b;
  return intProblem(topic, `${a} − ${b}`, r, [r + 10 * unit, r - 10 * unit, r + 100 * unit, r - 100 * unit, r + unit, r - unit]);
};

/** Either a range, or one of a short list of friendly numbers (such as 11, 12, 15, 20). */
export type NumberSource = Range | { readonly choices: readonly number[] };
const drawFrom = (rng: Rng, src: NumberSource): number =>
  'choices' in src ? pick(rng, src.choices) : randInt(rng, src[0], src[1]);

/** a × b, the factors drawn from two sources. */
export const productGen = (topic: string, a: NumberSource, b: NumberSource): TopicGenerator => rng => {
  const x = drawFrom(rng, a), y = drawFrom(rng, b);
  const p = x * y;
  return intProblem(topic, `${x} × ${y}`, p, [p + 10, p - 10, p + x, p - x, p + y, p - y, p * 10]);
};

/** Exact division with the divisor and the quotient drawn from two sources. */
export const quotientGen = (topic: string, d: NumberSource, q: NumberSource): TopicGenerator => rng => {
  const divisor = drawFrom(rng, d);
  const quot = drawFrom(rng, q);
  return intProblem(topic, `${divisor * quot} ÷ ${divisor}`, quot, [quot + 1, quot - 1, quot + 10, quot - 10, quot * 10, divisor]);
};

// ---- missing number ---------------------------------------------------------------------
/** "▢ × 7 = 56", "5 × ▢ = 45", "▢ + 38 = 91", "120 − ▢ = 45", "▢ ÷ 6 = 8", "72 ÷ ▢ = 9". */
export const missingGen = (topic: string, small: Range, big: Range): TopicGenerator => rng => {
  const kind = randInt(rng, 0, 5);
  const a = randInt(rng, small[0], small[1]), b = randInt(rng, small[0], small[1]);
  const x = randInt(rng, big[0], big[1]), y = randInt(rng, small[0], big[1]);
  switch (kind) {
    case 0: return intProblem(topic, `▢ × ${a} = ${a * b}`, b, [a, a * b, b + 1, b - 1]);
    case 1: return intProblem(topic, `${a} × ▢ = ${a * b}`, b, [a, a * b, b + 1, b - 1]);
    case 2: return intProblem(topic, `▢ + ${y} = ${x + y}`, x, [x + y + y, x + y, x + 1, x - 1, x + 10, x - 10]);
    case 3: return intProblem(topic, `${x + y} − ▢ = ${x}`, y, [x + y + x, x + y, y + 1, y - 1, y + 10, y - 10]);
    case 4: return intProblem(topic, `▢ ÷ ${a} = ${b}`, a * b, [b, a + b, a * b + a, a * b - a, a * b + 1]);
    default: return intProblem(topic, `${a * b} ÷ ▢ = ${b}`, a, [b, a * b, a + 1, a - 1]);
  }
};

// ---- order of operations ----------------------------------------------------------------------
interface Template {
  ranges: readonly Range[];
  text: (v: number[]) => string;
  value: (v: number[]) => number;
  /** mistakes: ignoring the brackets, doing the operations left to right, ... */
  wrong: (v: number[]) => number[];
}

const T = {
  // 6 × (2 + 3)
  timesSum: (r: Range, s: Range): Template => ({
    ranges: [r, s, s], text: ([a, b, c]) => `${a} × (${b} + ${c})`, value: ([a, b, c]) => a * (b + c),
    wrong: ([a, b, c]) => [a * b + c, a + b + c, a * b],
  }),
  sumTimes: (r: Range, s: Range): Template => ({
    ranges: [s, s, r], text: ([a, b, c]) => `(${a} + ${b}) × ${c}`, value: ([a, b, c]) => (a + b) * c,
    wrong: ([a, b, c]) => [a + b * c, a * c + b, a + b + c],
  }),
  plusTimes: (r: Range, s: Range): Template => ({
    ranges: [r, s, s], text: ([a, b, c]) => `${a} + ${b} × ${c}`, value: ([a, b, c]) => a + b * c,
    wrong: ([a, b, c]) => [(a + b) * c, a + b + c, a * b * c],
  }),
  timesMinus: (r: Range, s: Range): Template => ({
    ranges: [r, s, s], text: ([a, b, c]) => `${a} × ${b} − ${c}`, value: ([a, b, c]) => a * b - c,
    wrong: ([a, b, c]) => [a * (b - c), a * b + c, a - b * c],
  }),
  timesDiff: (r: Range, s: Range): Template => ({
    ranges: [r, [s[0] + 2, s[1] + 4], s], text: ([a, b, c]) => `${a} × (${b} − ${c})`, value: ([a, b, c]) => a * (b - c),
    wrong: ([a, b, c]) => [a * b - c, a - b - c, a * b],
  }),
  timesSumMinus: (r: Range, s: Range): Template => ({
    ranges: [r, s, s, s], text: ([a, b, c, d]) => `${a} × (${b} + ${c}) − ${d}`, value: ([a, b, c, d]) => a * (b + c) - d,
    wrong: ([a, b, c, d]) => [a * b + c - d, a * (b + c - d), a * (b + c) + d],
  }),
  /** both brackets come from the small range s */
  sumTimesDiff: (s: Range): Template => ({
    ranges: [s, s, [s[1] + 1, s[1] + 6], [1, s[1]]], text: ([a, b, c, d]) => `(${a} + ${b}) × (${c} − ${d})`,
    value: ([a, b, c, d]) => (a + b) * (c - d), wrong: ([a, b, c, d]) => [(a + b) * c - d, a + b * (c - d), (a + b) * c + d],
  }),
  plusTimesMinus: (r: Range, s: Range): Template => ({
    ranges: [r, s, s, s], text: ([a, b, c, d]) => `${a} + ${b} × ${c} − ${d}`, value: ([a, b, c, d]) => a + b * c - d,
    wrong: ([a, b, c, d]) => [(a + b) * c - d, a + b * (c - d), a + b * c + d],
  }),
  sumOverNumber: (s: Range): Template => ({
    ranges: [[2, 5], s, s], text: ([c, a, b]) => `(${a} + ${b}) ÷ ${c}`, value: ([c, a, b]) => (a + b) / c,
    wrong: ([c, a, b]) => [a + b / c, a / c + b, a + b + c],
  }),
  timesOver: (r: Range, s: Range): Template => ({
    ranges: [r, s, [2, 6]], text: ([a, b, c]) => `${a} × ${b} ÷ ${c}`, value: ([a, b, c]) => (a * b) / c,
    wrong: ([a, b, c]) => [a * (b / c), a * b * c, a + b + c],
  }),
  twoProducts: (r: Range, s: Range): Template => ({
    ranges: [r, s, r, s], text: ([a, b, c, d]) => `${a} × ${b} + ${c} × ${d}`, value: ([a, b, c, d]) => a * b + c * d,
    wrong: ([a, b, c, d]) => [(a * b + c) * d, a * (b + c) * d, a * b * c * d],
  }),
  sumTimesMinusProduct: (r: Range, s: Range): Template => ({
    ranges: [s, s, r, s, s], text: ([a, b, c, d, e]) => `(${a} + ${b}) × ${c} − ${d} × ${e}`,
    value: ([a, b, c, d, e]) => (a + b) * c - d * e, wrong: ([a, b, c, d, e]) => [a + b * c - d * e, (a + b) * (c - d) * e, (a + b) * c - d + e],
  }),
  timesSumOver: (r: Range, s: Range): Template => ({
    ranges: [r, s, s, [2, 4]], text: ([a, b, c, d]) => `${a} × (${b} + ${c}) ÷ ${d}`, value: ([a, b, c, d]) => (a * (b + c)) / d,
    wrong: ([a, b, c, d]) => [a * b + c / d, a * (b + c) * d, a * b + c],
  }),
} as const;
export const orderTemplates = T;

/** Order-of-operations exercises: draws numbers until the whole thing works out to a whole, non-negative number. */
export const orderGen = (topic: string, templates: readonly Template[], maxResult: number): TopicGenerator => rng => {
  for (let attempt = 0; attempt < 400; attempt++) {
    const t = pick(rng, templates);
    const v = draw(rng, t.ranges);
    const r = t.value(v);
    if (Number.isInteger(r) && r >= 1 && r <= maxResult) return intProblem(topic, t.text(v), r, t.wrong(v));
  }
  const [a, b, c] = [3, 2, 4];
  return intProblem(topic, `${a} × (${b} + ${c})`, a * (b + c), [a * b + c]);       // never reached in practice
};
