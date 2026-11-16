import type { Rng } from '../types';
import { pick, randInt } from '../rng';
import { intProblem, type TopicGenerator, type TopicTable } from './topic';
import { noBorrowSub, noCarryAdd } from './errors';

const addGen = (max: number): TopicGenerator => rng => {
  const lo = max / 10;
  const a = randInt(rng, lo, max - lo), b = randInt(rng, lo, max - a);
  const s = a + b;
  return intProblem('g4.add', `${a} + ${b}`, s, [noCarryAdd(a, b), s + 10, s - 10, s + 100, s - 100, s + 1000]);
};
const subGen = (max: number): TopicGenerator => rng => {
  const lo = max / 10;
  const a = randInt(rng, max / 5, max), b = randInt(rng, lo, a - 1);
  const r = a - b;
  return intProblem('g4.sub', `${a} − ${b}`, r, [noBorrowSub(a, b), r + 10, r - 10, r + 100, r - 100, r + 1000]);
};

const digits = (n: number) => [10 ** (n - 1), 10 ** n - 1] as const;
const mulGen = (shapes: ReadonlyArray<readonly [number, number]>): TopicGenerator => rng => {
  const [da, db] = pick(rng, shapes);
  const a = randInt(rng, ...digits(da)), b = randInt(rng, ...digits(db));
  const p = a * b;
  return intProblem('g4.mul', `${a} × ${b}`, p, [p + 10, p - 10, p + 100, p - 100, p + a, p - a, p + b, p - b]);
};

const divGen = (dividendDigits: number): TopicGenerator => rng => {
  const [lo, hi] = digits(dividendDigits);
  const d = randInt(rng, 2, 9);
  const q = randInt(rng, Math.ceil(lo / d), Math.floor(hi / d));
  return intProblem('g4.div', `${d * q} ÷ ${d}`, q, [q + 1, q - 1, q + 10, q - 10, q * 10, d]);
};

const orderBeginner: TopicGenerator = rng => {
  const a = randInt(rng, 2, 50), b = randInt(rng, 2, 12), c = randInt(rng, 2, 12);
  const r = a + b * c;
  return intProblem('g4.order', `${a} + ${b} × ${c}`, r, [(a + b) * c, r + 1, r - 1]);
};
const orderAdvanced: TopicGenerator = rng => {
  if (rng() < 0.5) {
    const a = randInt(rng, 5, 30), b = randInt(rng, 5, 30), c = randInt(rng, 2, 12), r = (a + b) * c;
    return intProblem('g4.order', `(${a} + ${b}) × ${c}`, r, [a + b * c, a * c + b, r + c, r - c]);
  }
  const a = randInt(rng, 2, 12), b = randInt(rng, 10, 40), c = randInt(rng, 2, b - 5), r = a * (b - c);
  return intProblem('g4.order', `${a} × (${b} − ${c})`, r, [a * b - c, r + a, r - a]);
};
const orderExpert: TopicGenerator = rng => {
  if (rng() < 0.5) {
    const a = randInt(rng, 3, 20), b = randInt(rng, 3, 20), c = randInt(rng, 12, 30), d = randInt(rng, 2, 10);
    const r = (a + b) * (c - d);
    return intProblem('g4.order', `(${a} + ${b}) × (${c} − ${d})`, r, [(a + b) * c - d, a + b * (c - d), r + a + b]);
  }
  const a = randInt(rng, 3, 12), b = randInt(rng, 3, 12), c = randInt(rng, 3, 12), d = randInt(rng, 3, 12);
  const r = a * b + c * d;
  return intProblem('g4.order', `${a} × ${b} + ${c} × ${d}`, r, [(a * b + c) * d, a * (b + c) * d, r + a, r - c]);
};

/** `n/d מתוך q` with q a multiple of d. */
const fractionOf = (dLo: number, dHi: number, unit: boolean, maxQ: number): TopicGenerator => (rng: Rng) => {
  const d = randInt(rng, unit ? dLo : Math.max(dLo, 3), dHi);
  const n = unit ? 1 : randInt(rng, 2, d - 1);
  const k = randInt(rng, 2, Math.floor(maxQ / d));
  const q = d * k, r = n * k;
  return intProblem('g4.fraction-of', `${n}/${d} מתוך ${q}`, r, [k, q - r, r + k, r - k, n * q / (d + 1)]);
};

export const topics: TopicTable = {
  beginner: [addGen(10000), subGen(10000), mulGen([[2, 1]]), divGen(2), orderBeginner, fractionOf(2, 5, true, 60)],
  advanced: [addGen(100000), subGen(100000), mulGen([[3, 1], [2, 2]]), divGen(3), orderAdvanced, fractionOf(2, 8, false, 120)],
  expert: [addGen(1000000), subGen(1000000), mulGen([[3, 2]]), divGen(4), orderExpert, fractionOf(2, 12, false, 200)],
};
