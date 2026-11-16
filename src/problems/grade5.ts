import type { Rng } from '../types';
import { pick, randInt } from '../rng';
import { decProblem, fracProblem, intProblem, type TopicGenerator, type TopicTable } from './topic';
import { eq, gcd, rat, sub as subR, add as addR } from './rational';
import { diffGen, missingGen, orderGen, orderTemplates as T, productGen, quotientGen, sumGen } from './wholeNumbers';
import type { Rational } from '../types';

/*
 * Children answer in their heads in about 30 seconds, by tapping one of a few answers, so the numbers stay friendly
 * (the national tests use paper for big multiplications and long division; the game does not):
 * one-digit factors, then friendly two-digit factors, then two-digit by two-digit; divisors that are easy to work with;
 * fractions whose common denominator is small; decimals below 10 (below 20 at expert).
 */

// ---- g5.frac-add / g5.frac-sub ----------------------------------------------
interface Frac { whole: number; a: number; d: number }
const fracNum = (f: Frac) => f.whole * f.d + f.a;
const fracText = (f: Frac) => (f.whole ? `${f.whole} ${f.a}/${f.d}` : `${f.a}/${f.d}`);
const fracValue = (f: Frac) => rat(fracNum(f), f.d);

type Denoms = (rng: Rng) => [number, number];
const sameDenoms: Denoms = rng => { const d = randInt(rng, 3, 10); return [d, d]; };
const multipleDenoms: Denoms = rng => {
  const d = randInt(rng, 2, 4), big = d * randInt(rng, 2, 3);
  return rng() < 0.5 ? [d, big] : [big, d];
};
/** Different denominators from a short list whose common denominator is at most 24. */
const otherDenoms: Denoms = rng => {
  for (;;) {
    const d1 = pick(rng, [2, 3, 4, 5, 6, 8, 10, 12]), d2 = pick(rng, [2, 3, 4, 5, 6, 8, 10, 12]);
    if (d1 !== d2 && (d1 * d2) / gcd(d1, d2) <= 24) return [d1, d2];
  }
};

/** Which results a level accepts (the generator draws again until one fits). */
type ResultRule = (result: Rational, d1: number, d2: number) => boolean;
const anyResult: ResultRule = () => true;
/** Below 1: no mixed numbers to build. */
const belowOne: ResultRule = r => r.n < r.d;
/** Below 1 and already in lowest terms over the shared denominator (5/8 + 2/8 = 7/8): nothing to simplify. */
const plainSameDenominator: ResultRule = (r, d1) => r.n < r.d && r.d === d1;

const fracGen = (op: 'add' | 'sub', denoms: Denoms, mixed: boolean, accept: ResultRule = anyResult): TopicGenerator => rng => {
  const make = (d: number): Frac => ({
    whole: mixed && rng() < 0.5 ? randInt(rng, 1, 2) : 0,
    a: randInt(rng, 1, d - 1),
    d,
  });
  let x: Frac, y: Frac;
  do {
    const [d1, d2] = denoms(rng);
    x = make(d1);
    y = make(d2);
    if (op === 'sub' && fracNum(x) * y.d < fracNum(y) * x.d) [x, y] = [y, x];
  } while ((op === 'sub' && eq(fracValue(x), fracValue(y))) ||
           !accept(op === 'add' ? addR(fracValue(x), fracValue(y)) : subR(fracValue(x), fracValue(y)), x.d, y.d));
  const n1 = fracNum(x), n2 = fracNum(y);
  const text = `${fracText(x)} ${op === 'add' ? '+' : '−'} ${fracText(y)}`;
  if (op === 'add') {
    const r = rat(n1 * y.d + n2 * x.d, x.d * y.d);
    return fracProblem('g5.frac-add', text, r, [
      rat(n1 + n2, x.d + y.d), rat(n1 + n2, x.d * y.d), rat(n1 + n2, Math.max(x.d, y.d)),
    ]);
  }
  const r = subR(fracValue(x), fracValue(y));
  const diff = Math.abs(n1 - n2);
  return fracProblem('g5.frac-sub', text, r, [
    rat(diff, x.d + y.d), rat(diff, x.d * y.d), rat(diff, Math.max(x.d, y.d)),
  ]);
};

// ---- g5.dec-add / g5.dec-sub --------------------------------------------------
const fmt = (units: number, places: number) => (units / 10 ** places).toFixed(places);
const decWrong = (h: number) => [h * 10, h / 10, h + 10, h - 10, h + 1, h - 1];

interface Dec { text: string; h: number }          // h = value in hundredths
type DecPair = (rng: Rng) => [Dec, Dec];
const decGen = (op: 'add' | 'sub', make: DecPair): TopicGenerator => rng => {
  let [x, y] = make(rng);
  if (op === 'sub' && x.h < y.h) [x, y] = [y, x];
  const h = op === 'add' ? x.h + y.h : x.h - y.h;
  return decProblem(`g5.dec-${op}`, `${x.text} ${op === 'add' ? '+' : '−'} ${y.text}`, h, decWrong(h));
};
const tenths = (rng: Rng): Dec => { const a = randInt(rng, 1, 99); return { text: fmt(a, 1), h: a * 10 }; };
const hundredths = (rng: Rng, lo: number, hi: number): Dec => {
  let a: number;
  do { a = randInt(rng, lo, hi); } while (a % 10 === 0);      // always shows two decimal places
  return { text: fmt(a, 2), h: a };
};
const decBeginner: DecPair = rng => [tenths(rng), tenths(rng)];
/** One number with tenths, one with hundredths (3.45 + 2.7), both below 10. */
const decAdvanced: DecPair = rng => {
  const pair: [Dec, Dec] = [tenths(rng), hundredths(rng, 101, 999)];
  return rng() < 0.5 ? pair : [pair[1], pair[0]];
};
const decExpert: DecPair = rng => [hundredths(rng, 101, 1999), hundredths(rng, 101, 1999)];

// ---- g5.expand ------------------------------------------------------------------
const expandGen = (fLo: number, fHi: number, bHi: number, allowReduction: boolean): TopicGenerator => rng => {
  let a: number, b: number;
  do { b = randInt(rng, 2, bHi); a = randInt(rng, 1, b - 1); } while (gcd(a, b) !== 1);
  const f = randInt(rng, fLo, fHi);
  if (allowReduction && rng() < 0.4)
    return intProblem('g5.expand', `${a * f}/${b * f} = ${a}/▢`, b, [b + 1, b - 1, f, a * f, b * f - a]);
  return intProblem('g5.expand', `${a}/${b} = ▢/${b * f}`, a * f, [a + (b * f - b), a * f + 1, a * f - 1, b * f, a + f]);
};

// ---- g5.to-decimal ----------------------------------------------------------------
/** A pool yields [numerator, denominator, whole part allowed]. */
type FracPool = (rng: Rng) => [number, number, boolean];
const toDecimal = (pool: FracPool): TopicGenerator => rng => {
  const [n, d, wholeOk] = pool(rng);
  const whole = wholeOk && rng() < 0.4 ? randInt(rng, 1, 5) : 0;
  const h = ((whole * d + n) * 100) / d;
  const text = `${whole ? `${whole} ` : ''}${n}/${d} = ?`;
  // Common slips: decimal point misplaced, or the digits of the fraction read as a decimal.
  return decProblem('g5.to-decimal', text, h, [
    h * 10, h / 10, h + 10, h - 10, d < 10 ? d * 10 : d, whole * 100 + n * 10 + d,
  ]);
};
const halvesTenths: FracPool = rng => (rng() < 0.4 ? [1, 2, false] : [randInt(rng, 1, 9), 10, false]);
const quartersFifths: FracPool = rng => (rng() < 0.4 ? [pick(rng, [1, 3]), 4, false] : [randInt(rng, 1, 4), 5, false]);
const expertPool: FracPool = rng => {
  const r = rng();
  if (r < 0.35) return [randInt(rng, 1, 19), 20, false];
  if (r < 0.6) return [randInt(rng, 1, 24), 25, false];
  return quartersFifths(rng).map((x, i) => (i === 2 ? true : x)) as [number, number, boolean];   // 2 3/4 = ?
};

/** Parked until the school's own material says what to ask: fractions and decimals. */
export const parkedTopics: TopicTable = {
  beginner: [
    fracGen('add', sameDenoms, false, plainSameDenominator), fracGen('sub', sameDenoms, false, plainSameDenominator),
    decGen('add', decBeginner), decGen('sub', decBeginner), expandGen(2, 3, 6, false), toDecimal(halvesTenths),
  ],
  advanced: [
    fracGen('add', multipleDenoms, false, belowOne), fracGen('sub', multipleDenoms, false, belowOne),
    decGen('add', decAdvanced), decGen('sub', decAdvanced), expandGen(2, 6, 6, false), toDecimal(quartersFifths),
  ],
  expert: [
    fracGen('add', otherDenoms, true), fracGen('sub', otherDenoms, true),
    decGen('add', decExpert), decGen('sub', decExpert), expandGen(2, 6, 6, true), toDecimal(expertPool),
  ],
};

/**
 * Active: whole numbers only. Sums and differences, products and quotients from the tables and a little beyond, missing
 * numbers, and order-of-operations exercises with brackets such as 6 × (2 + 3).
 */
export const topics: TopicTable = {
  beginner: [
    sumGen('g5.add', 10, 90, 100), diffGen('g5.sub', 10, 100), productGen('g5.mul', [3, 12], [3, 9]),
    quotientGen('g5.div', [2, 9], [3, 12]), missingGen('g5.missing', [2, 9], [10, 60]),
    orderGen('g5.order', [T.timesSum([2, 9], [1, 6]), T.sumTimes([2, 9], [1, 6]), T.plusTimes([2, 9], [1, 6]), T.timesMinus([2, 9], [1, 6])], 100),
  ],
  advanced: [
    sumGen('g5.add', 100, 900, 1000, 10), diffGen('g5.sub', 100, 1000, 10), productGen('g5.mul', [12, 40], [2, 9]),
    quotientGen('g5.div', [2, 9], [10, 60]), missingGen('g5.missing', [3, 12], [20, 200]),
    orderGen('g5.order', [
      T.timesSumMinus([2, 9], [1, 9]), T.sumTimesDiff([2, 6]), T.plusTimesMinus([2, 9], [2, 9]), T.timesDiff([2, 9], [1, 9]),
      T.sumOverNumber([2, 15]), T.timesOver([2, 9], [2, 12]),
    ], 200),
  ],
  expert: [
    sumGen('g5.add', 100, 5000, 6000, 100), diffGen('g5.sub', 100, 5000, 100),
    productGen('g5.mul', [12, 30], { choices: [11, 12, 15, 20, 25] }),
    quotientGen('g5.div', { choices: [11, 12, 15, 20, 25] }, [4, 20]), missingGen('g5.missing', [6, 12], [50, 500]),
    orderGen('g5.order', [
      T.sumTimesMinusProduct([2, 6], [2, 9]), T.twoProducts([2, 9], [2, 9]), T.timesSumOver([2, 9], [2, 9]), T.sumTimesDiff([2, 8]),
      T.timesSumMinus([3, 9], [2, 9]),
    ], 300),
  ],
};
