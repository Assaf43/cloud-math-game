import type { Rng } from '../types';
import { pick, randInt } from '../rng';
import { decProblem, fracProblem, intProblem, type TopicGenerator, type TopicProblem, type TopicTable } from './topic';
import { div, gcd, mul, rat } from './rational';

/** Retries until the typed form of the answer fits the 8-character input limit. */
const bounded = (gen: TopicGenerator): TopicGenerator => rng => {
  let p: TopicProblem = gen(rng);
  for (let i = 0; i < 50 && p.answer.text.length > 8; i++) p = gen(rng);
  return p;
};

// ---- helpers for fractions -----------------------------------------------------
interface Frac { whole: number; a: number; d: number }
const fracNum = (f: Frac) => f.whole * f.d + f.a;
const fracText = (f: Frac) => (f.whole ? `${f.whole} ${f.a}/${f.d}` : `${f.a}/${f.d}`);
const fracValue = (f: Frac) => rat(fracNum(f), f.d);
const properFrac = (rng: Rng, dLo: number, dHi: number, whole = 0): Frac => {
  const d = randInt(rng, dLo, dHi);
  return { whole, a: randInt(rng, 1, d - 1), d };
};

// ---- g6.frac-mul -----------------------------------------------------------------
const fracMul = (shape: 'whole' | 'frac' | 'mixed'): TopicGenerator => bounded(rng => {
  if (shape === 'whole') {
    // a whole number that the denominator divides (6 × 2/3 = 4): a fraction of a quantity, no mixed number to build
    const d = randInt(rng, 2, 6), w = d * randInt(rng, 1, 4), f: Frac = { whole: 0, a: randInt(rng, 1, d - 1), d };
    return fracProblem('g6.frac-mul', `${w} × ${fracText(f)}`, mul(rat(w), fracValue(f)), [
      rat(f.a, f.d), rat(w * f.a, w + f.d), rat(w + f.a, f.d),
    ]);
  }
  const x = shape === 'mixed' ? properFrac(rng, 2, 5, randInt(rng, 1, 2)) : properFrac(rng, 2, 6);
  const y = properFrac(rng, 2, shape === 'mixed' ? 5 : 6);
  const nx = fracNum(x), ny = fracNum(y);
  return fracProblem('g6.frac-mul', `${fracText(x)} × ${fracText(y)}`, mul(fracValue(x), fracValue(y)), [
    rat(nx * ny, x.d + y.d), rat(nx + ny, x.d * y.d), rat(nx * ny, Math.max(x.d, y.d)),
  ]);
});

// ---- g6.frac-div -----------------------------------------------------------------
const fracDiv = (shape: 'smallDivisions' | 'frac' | 'mixed'): TopicGenerator => bounded(rng => {
  if (shape === 'smallDivisions') {
    if (rng() < 0.5) {
      // 4/5 ÷ 2 = 2/5: the numerator divides evenly and the answer is already in lowest terms
      let w: number, m: number, d: number;
      do {
        w = randInt(rng, 2, 4); m = randInt(rng, 1, 4); d = randInt(rng, w * m + 1, 9);
      } while (w * m >= d || gcd(m, d) !== 1);
      const f: Frac = { whole: 0, a: w * m, d };
      return fracProblem('g6.frac-div', `${fracText(f)} ÷ ${w}`, div(fracValue(f), rat(w)), [
        mul(fracValue(f), rat(w)), rat(f.a, f.d + w), rat(f.a / gcd(f.a, w), f.d),
      ]);
    }
    const w = randInt(rng, 2, 9), d = randInt(rng, 2, 9);
    return fracProblem('g6.frac-div', `${w} ÷ 1/${d}`, rat(w * d), [rat(w, d), rat(w + d), rat(w * d + d), rat(w * d - d)]);
  }
  const x = shape === 'mixed' ? properFrac(rng, 2, 5, randInt(rng, 1, 2)) : properFrac(rng, 2, 6);
  const y = properFrac(rng, 2, shape === 'mixed' ? 5 : 6);
  return fracProblem('g6.frac-div', `${fracText(x)} ÷ ${fracText(y)}`, div(fracValue(x), fracValue(y)), [
    mul(fracValue(x), fracValue(y)), div(fracValue(y), fracValue(x)), rat(fracNum(x) * y.d, x.d * fracNum(y) + 1),
  ]);
});

// ---- decimals ----------------------------------------------------------------------
/** Plain decimal text: trailing zeros dropped (4.50 -> 4.5, 12.00 -> 12). */
const fmt = (units: number, places: number) => {
  const s = (units / 10 ** places).toFixed(places);
  return places ? s.replace(/\.?0+$/, '') : s;
};
const misplaced = (h: number) => [h * 10, h / 10, h * 100, h + 10, h - 10];

const decMulPowers: TopicGenerator = bounded(rng => {
  const pow = pick(rng, [10, 100]);
  if (rng() < 0.5) {
    const x = randInt(rng, 1, 99);                                   // tenths
    return decProblem('g6.dec-mul', `${fmt(x, 1)} × ${pow}`, x * 10 * pow, misplaced(x * 10 * pow));
  }
  const x = randInt(rng, 1, 999);                                    // hundredths
  return decProblem('g6.dec-mul', `${fmt(x, 2)} × ${pow}`, x * pow, misplaced(x * pow));
});
const decMulDigit: TopicGenerator = bounded(rng => {
  const x = randInt(rng, 2, 99), d = randInt(rng, 2, 9);              // tenths x one digit
  const h = x * d * 10;
  return decProblem('g6.dec-mul', `${fmt(x, 1)} × ${d}`, h, misplaced(h));
});
const decMulDecimals: TopicGenerator = bounded(rng => {
  const x = randInt(rng, 2, 60), y = randInt(rng, 2, 9);               // tenths x one tenth -> hundredths (3.4 x 0.7)
  const h = x * y;
  return decProblem('g6.dec-mul', `${fmt(x, 1)} × ${fmt(y, 1)}`, h, [h * 10, h / 10, h + 10, h - 10, x * y * 100 / 10]);
});

const decDivPowers: TopicGenerator = bounded(rng => {
  if (rng() < 0.5) {
    const x = randInt(rng, 1, 999);                                   // tenths / 10 -> hundredths = x
    return decProblem('g6.dec-div', `${fmt(x, 1)} ÷ 10`, x, [x * 10, x * 100, x / 10, x + 10, x - 10]);
  }
  const n = randInt(rng, 1, 999);                                     // whole / 100
  return decProblem('g6.dec-div', `${n} ÷ 100`, n, [n * 10, n * 100, n / 10, n + 10, n - 10]);
});
const decDivDigit: TopicGenerator = bounded(rng => {
  const d = randInt(rng, 2, 9);
  const r = rng() < 0.5 ? randInt(rng, 1, 99) * 10 : randInt(rng, 1, 99);   // quotient in hundredths
  return decProblem('g6.dec-div', `${fmt(r * d, 2)} ÷ ${d}`, r, misplaced(r));
});
const decDivDecimal: TopicGenerator = bounded(rng => {
  const y = randInt(rng, 2, 9), q = randInt(rng, 2, 30);               // dividend = q * y tenths
  return decProblem('g6.dec-div', `${fmt(q * y, 1)} ÷ ${fmt(y, 1)}`, q * 100, [q * 1000, q * 10, (q + 1) * 100, (q - 1) * 100]);
});

// ---- g6.percent ----------------------------------------------------------------------
const percentForward = (percents: number[], maxK: number): TopicGenerator => bounded(rng => {
  const p = pick(rng, percents);
  const step = 100 / gcd(p, 100);
  const base = step * randInt(rng, 1, Math.max(1, Math.floor(maxK / step)));
  const r = (p * base) / 100;
  return intProblem('g6.percent', `${p}% מתוך ${base}`, r, [base - r, r * 10, r + 10, r - 10, p, Math.floor(base / p)]);
});
const percentReverse: TopicGenerator = bounded(rng => {
  const p = pick(rng, [10, 20, 25, 30, 40, 50, 60, 75]);
  const step = 100 / gcd(p, 100);
  const n = step * randInt(rng, 1, Math.max(1, Math.floor(200 / step)));
  const part = (p * n) / 100;
  return intProblem('g6.percent', `${p}% מהמספר הם ${part}. מה המספר?`, n, [n + part, n - part, part * 10, part * 2, 100 - part]);
});

// ---- g6.ratio ----------------------------------------------------------------------------
const ratio = (aMax: number, bMax: number, kind: 'unit' | 'large' | 'either'): TopicGenerator => bounded(rng => {
  let a = 1, b = randInt(rng, 2, bMax);
  if (kind !== 'unit') {
    do { a = randInt(rng, 1, aMax); b = randInt(rng, 1, bMax); } while (a === b);
  }
  const k = randInt(rng, 2, 10), total = (a + b) * k;
  const askSmall = kind === 'either' && rng() < 0.5;
  const part = (askSmall ? Math.min(a, b) : Math.max(a, b)) * k;
  const other = (askSmall ? Math.max(a, b) : Math.min(a, b)) * k;
  return intProblem('g6.ratio', `חלקו ${total} ביחס ${a}:${b}. מה החלק ${askSmall ? 'הקטן' : 'הגדול'}?`, part, [
    other, k, total / 2, total - k, part + k, part - k,
  ]);
});

export const topics: TopicTable = {
  beginner: [
    fracMul('whole'), fracDiv('smallDivisions'), decMulPowers, decDivPowers, percentForward([10, 25, 50], 200), ratio(1, 5, 'unit'),
  ],
  advanced: [
    fracMul('frac'), fracDiv('frac'), decMulDigit, decDivDigit,
    percentForward([5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90], 200), ratio(5, 5, 'large'),
  ],
  expert: [
    fracMul('mixed'), fracDiv('mixed'), decMulDecimals, decDivDecimal, percentReverse, ratio(7, 7, 'either'),
  ],
};
