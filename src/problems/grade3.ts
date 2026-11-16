import type { Rng } from '../types';
import { pick, randInt } from '../rng';
import { intProblem, type TopicGenerator, type TopicTable } from './topic';
import { noBorrowSub, noCarryAdd } from './errors';
import { orderGen, orderTemplates as T } from './wholeNumbers';

const addGen = (lo: number, hi: number, max: number): TopicGenerator => rng => {
  const a = randInt(rng, lo, Math.min(hi, max - lo));
  const b = randInt(rng, lo, Math.min(hi, max - a));
  const s = a + b;
  return intProblem('g3.add', `${a} + ${b}`, s, [noCarryAdd(a, b), s + 10, s - 10, s + 100, s - 100]);
};

const subGen = (lo: number, hi: number): TopicGenerator => rng => {
  const a = randInt(rng, lo + 10, hi);
  const b = randInt(rng, lo, a - 1);
  const r = a - b;
  return intProblem('g3.sub', `${a} − ${b}`, r, [noBorrowSub(a, b), r + 10, r - 10, r + 100, r - 100]);
};

const timesTable = (aLo: number, aHi: number, bLo: number, bHi: number): TopicGenerator => rng => {
  let a = randInt(rng, aLo, aHi), b = randInt(rng, bLo, bHi);
  if (rng() < 0.5) [a, b] = [b, a];
  const p = a * b;
  return intProblem('g3.times-table', `${a} × ${b}`, p, [a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b, a + b]);
};

const timesPowers: TopicGenerator = rng => {
  const n = randInt(rng, 2, 99), pow = pick(rng, [10, 100]);
  return intProblem('g3.times-tens', `${n} × ${pow}`, n * pow, [n * pow * 10, n * pow / 10, n + pow]);
};
const timesTensByDigit: TopicGenerator = rng => {
  const t = randInt(rng, 2, 9) * pick(rng, [10, 100]), d = randInt(rng, 2, 9);
  return intProblem('g3.times-tens', `${t} × ${d}`, t * d, [t * d * 10, t * d / 10, t + d, (t / 10) * d]);
};
const timesTensByTens: TopicGenerator = rng => {
  if (rng() < 0.5) {
    const a = randInt(rng, 2, 9) * 10, b = randInt(rng, 2, 9) * 10;
    return intProblem('g3.times-tens', `${a} × ${b}`, a * b, [a * b * 10, a * b / 10, (a / 10) * (b / 10)]);
  }
  const n = randInt(rng, 2, 10);
  return intProblem('g3.times-tens', `${n} × 1000`, n * 1000, [n * 100, n * 10000, n * 100 * 10]);
};

const divTable = (dLo: number, dHi: number): TopicGenerator => rng => {
  const d = randInt(rng, dLo, dHi), q = randInt(rng, 2, 10);
  return intProblem('g3.div-table', `${d * q} ÷ ${d}`, q, [q + 1, q - 1, q + 2, d]);
};

const divPowers: TopicGenerator = rng => {
  const q = randInt(rng, 2, 99), pow = pick(rng, [10, 100]);
  return intProblem('g3.div-tens', `${q * pow} ÷ ${pow}`, q, [q * 10, q * pow, q + 1]);
};
const divTensByDigit: TopicGenerator = (rng: Rng) => {
  if (rng() < 0.5) {
    const d = randInt(rng, 2, 9), k = randInt(rng, 2, 9), pow = pick(rng, [10, 100]);
    const q = k * pow;
    return intProblem('g3.div-tens', `${d * q} ÷ ${d}`, q, [q * 10, q / 10, k]);
  }
  const d = randInt(rng, 2, 9), q = randInt(rng, Math.ceil(11 / d), Math.floor(99 / d));
  return intProblem('g3.div-tens', `${d * q} ÷ ${d}`, q, [q + 1, q - 1, q * 10, d]);
};

const orderAdvanced: TopicGenerator = rng => {
  const a = randInt(rng, 2, 10), b = randInt(rng, 2, 10), c = randInt(rng, 2, 10);
  if (rng() < 0.5) {
    const r = a + b * c;
    return intProblem('g3.order', `${a} + ${b} × ${c}`, r, [(a + b) * c, r + 1, r - 1]);
  }
  const cc = randInt(rng, 1, Math.min(10, a * b - 1));
  const r = a * b - cc;
  return intProblem('g3.order', `${a} × ${b} − ${cc}`, r, [b > cc ? a * (b - cc) : -1, r + 1, r - 1, a * b + cc]);
};
const orderExpert: TopicGenerator = rng => {
  const a = randInt(rng, 2, 12), c = randInt(rng, 2, 12);
  if (rng() < 0.5) {
    const b = randInt(rng, 2, 12), r = (a + b) * c;
    return intProblem('g3.order', `(${a} + ${b}) × ${c}`, r, [a + b * c, a * c + b, r + c, r - c]);
  }
  const b = randInt(rng, 3, 12), d = randInt(rng, 2, b - 1);
  const r = a * (b - d);
  return intProblem('g3.order', `${a} × (${b} − ${d})`, r, [a * b - d, r + a, r - a]);
};

export const topics: TopicTable = {
  beginner: [addGen(10, 90, 100), subGen(10, 100), timesTable(2, 5, 2, 10), timesPowers, divTable(2, 5),
    orderGen('g3.order', [T.timesSum([2, 5], [1, 5]), T.sumTimes([2, 5], [1, 5])], 50)],
  advanced: [addGen(50, 500, 1000), subGen(50, 500), timesTable(2, 10, 2, 10), timesTensByDigit, divTable(2, 10), divPowers, orderAdvanced],
  expert: [addGen(200, 3000, 5000), subGen(100, 3000), timesTable(6, 9, 6, 9), timesTensByTens, divTensByDigit, orderExpert],
};
