import type { Rng } from '../types';
import { pick, randInt } from '../rng';
import { decProblem, fracProblem, intProblem, type TopicGenerator, type TopicTable } from './topic';
import { eq, gcd, rat, sub as subR } from './rational';

const digits = (n: number) => [10 ** (n - 1), 10 ** n - 1] as const;

// ---- g5.mul ---------------------------------------------------------------
const mulGen = (da: number, db: number): TopicGenerator => rng => {
  const a = randInt(rng, ...digits(da)), b = randInt(rng, ...digits(db));
  const p = a * b;
  return intProblem('g5.mul', `${a} × ${b}`, p, [p + 10, p - 10, p + 100, p - 100, p + a, p - a, p + b, p - b]);
};

// ---- g5.div (two-digit divisor, exact) -------------------------------------
const divGen = (kind: 'tens' | 'oneDigit' | 'multiDigit'): TopicGenerator => rng => {
  const d = kind === 'tens' ? randInt(rng, 2, 9) * 10 : randInt(rng, 11, 99);
  const q = kind === 'multiDigit' ? randInt(rng, 10, 150) : kind === 'oneDigit' ? randInt(rng, 2, 9) : randInt(rng, 2, 30);
  return intProblem('g5.div', `${d * q} ÷ ${d}`, q, [q + 1, q - 1, q * 10, q + 10, q - 10, d]);
};

// ---- g5.frac-add / g5.frac-sub ----------------------------------------------
interface Frac { whole: number; a: number; d: number }
const fracNum = (f: Frac) => f.whole * f.d + f.a;
const fracText = (f: Frac) => (f.whole ? `${f.whole} ${f.a}/${f.d}` : `${f.a}/${f.d}`);
const fracValue = (f: Frac) => rat(fracNum(f), f.d);

type Denoms = (rng: Rng) => [number, number];
const sameDenoms: Denoms = rng => { const d = randInt(rng, 2, 10); return [d, d]; };
const multipleDenoms: Denoms = rng => {
  const d = randInt(rng, 2, 4), big = d * randInt(rng, 2, 3);
  return rng() < 0.5 ? [d, big] : [big, d];
};
/** Different denominators up to 12 whose common denominator stays at most 36, so a typed mixed-number answer fits in 8 characters. */
const otherDenoms: Denoms = rng => {
  for (;;) {
    const d1 = randInt(rng, 2, 12), d2 = randInt(rng, 2, 12);
    if (d1 !== d2 && (d1 * d2) / gcd(d1, d2) <= 36) return [d1, d2];
  }
};

const fracGen = (op: 'add' | 'sub', denoms: Denoms, mixed: boolean): TopicGenerator => rng => {
  const make = (d: number): Frac => ({
    whole: mixed && rng() < 0.5 ? randInt(rng, 1, 3) : 0,
    a: randInt(rng, 1, d - 1),
    d,
  });
  let x: Frac, y: Frac;
  do {
    const [d1, d2] = denoms(rng);
    x = make(d1);
    y = make(d2);
  } while (op === 'sub' && eq(fracValue(x), fracValue(y)));
  if (op === 'sub' && fracNum(x) * y.d < fracNum(y) * x.d) [x, y] = [y, x];
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
const tenths: DecPair = rng => {
  const a = randInt(rng, 1, 99), b = randInt(rng, 1, 99);
  return [{ text: fmt(a, 1), h: a * 10 }, { text: fmt(b, 1), h: b * 10 }];
};
const hundredths: DecPair = rng => {
  const a = randInt(rng, 1, 999), b = randInt(rng, 1, 999);
  return [{ text: fmt(a, 2), h: a }, { text: fmt(b, 2), h: b }];
};
const mixedPlaces: DecPair = rng => {
  const a = randInt(rng, 10, 999), b = randInt(rng, 0, 999) * 10 + randInt(rng, 1, 9);   // b is never a whole tenth
  const t: Dec = { text: fmt(a, 1), h: a * 10 }, u: Dec = { text: fmt(b, 2), h: b };
  return rng() < 0.5 ? [t, u] : [u, t];
};

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
const toDecimal = (pool: (rng: Rng) => [number, number], mixed: boolean): TopicGenerator => rng => {
  const [n, d] = pool(rng);
  const whole = mixed && rng() < 0.4 ? randInt(rng, 1, 5) : 0;
  const h = ((whole * d + n) * 100) / d;
  const text = `${whole ? `${whole} ` : ''}${n}/${d} = ?`;
  // Common slips: decimal point misplaced, or the digits of the fraction read as a decimal.
  return decProblem('g5.to-decimal', text, h, [
    h * 10, h / 10, h + 10, h - 10, d < 10 ? d * 10 : d, whole * 100 + n * 10 + d,
  ]);
};
const halvesTenths = (rng: Rng): [number, number] => (rng() < 0.4 ? [1, 2] : [randInt(rng, 1, 9), 10]);
const quartersFifths = (rng: Rng): [number, number] => (rng() < 0.4 ? [pick(rng, [1, 3]), 4] : [randInt(rng, 1, 4), 5]);
const twentiethsEtc = (rng: Rng): [number, number] => (rng() < 0.5 ? [randInt(rng, 1, 19), 20] : [randInt(rng, 1, 24), 25]);

export const topics: TopicTable = {
  beginner: [
    mulGen(2, 2), divGen('tens'), fracGen('add', sameDenoms, false), fracGen('sub', sameDenoms, false),
    decGen('add', tenths), decGen('sub', tenths), expandGen(2, 3, 6, false), toDecimal(halvesTenths, false),
  ],
  advanced: [
    mulGen(3, 2), divGen('oneDigit'), fracGen('add', multipleDenoms, false), fracGen('sub', multipleDenoms, false),
    decGen('add', hundredths), decGen('sub', hundredths), expandGen(2, 6, 8, false), toDecimal(quartersFifths, false),
  ],
  expert: [
    mulGen(3, 3), divGen('multiDigit'), fracGen('add', otherDenoms, true), fracGen('sub', otherDenoms, true),
    decGen('add', mixedPlaces), decGen('sub', mixedPlaces), expandGen(2, 10, 10, true), toDecimal(twentiethsEtc, true),
  ],
};
