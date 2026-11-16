import type { Rng } from '../types';
import { randInt } from '../rng';
import { intProblem, type TopicGenerator, type TopicTable } from './topic';
import { noBorrowSub, noCarryAdd } from './errors';

/*
 * Children answer in their heads in about 30 seconds, by tapping one of a few answers, so the numbers stay friendly:
 * add/sub grow from 1,000 to 10,000 (tens) to 100,000 (hundreds); multiplication has one small factor until expert,
 * where a two-digit factor meets a small two-digit one; division stays within three digits.
 */

/** Operands are multiples of `unit`, so big numbers stay easy to hold in the head. */
const addGen = (max: number, unit: number): TopicGenerator => rng => {
  const lo = max / 10 / unit;
  const a = randInt(rng, lo, (max - max / 10) / unit) * unit;
  const b = randInt(rng, lo, (max - a) / unit) * unit;
  const s = a + b;
  return intProblem('g4.add', `${a} + ${b}`, s, [noCarryAdd(a, b), s + unit * 10, s - unit * 10, s + unit * 100, s - unit * 100, s + unit]);
};
const subGen = (max: number, unit: number): TopicGenerator => rng => {
  const lo = max / 10 / unit;
  const a = randInt(rng, max / 5 / unit, max / unit) * unit;
  const b = randInt(rng, lo, a / unit - 1) * unit;
  const r = a - b;
  return intProblem('g4.sub', `${a} − ${b}`, r, [noBorrowSub(a, b), r + unit * 10, r - unit * 10, r + unit * 100, r - unit * 100, r + unit]);
};

const mulWrong = (a: number, b: number): number[] => {
  const p = a * b;
  return [p + 10, p - 10, p + 100, p - 100, p + a, p - a, p + b, p - b];
};
const mulBeginner: TopicGenerator = rng => {
  const a = randInt(rng, 11, 25), b = randInt(rng, 2, 9);
  return intProblem('g4.mul', `${a} × ${b}`, a * b, mulWrong(a, b));
};
const mulAdvanced: TopicGenerator = rng => {
  if (rng() < 0.5) {
    const a = randInt(rng, 26, 99), b = randInt(rng, 2, 9);
    return intProblem('g4.mul', `${a} × ${b}`, a * b, mulWrong(a, b));
  }
  const a = randInt(rng, 11, 99) * 10, b = randInt(rng, 2, 9);          // 120 x 4: round hundreds are easy
  return intProblem('g4.mul', `${a} × ${b}`, a * b, [a * b * 10, a * b / 10, ...mulWrong(a, b)]);
};
const mulExpert: TopicGenerator = rng => {
  const a = randInt(rng, 12, 40), b = randInt(rng, 11, 25);
  return intProblem('g4.mul', `${a} × ${b}`, a * b, mulWrong(a, b));
};

/** Exact division by a one-digit divisor of at most `maxDivisor`, dividend of `digits` digits (at most 999). */
const divGen = (digits: 2 | 3, maxDivisor: number): TopicGenerator => rng => {
  const lo = digits === 2 ? 10 : 100, hi = digits === 2 ? 99 : 999;
  const d = randInt(rng, 2, maxDivisor);
  const q = randInt(rng, Math.ceil(lo / d), Math.floor(hi / d));
  return intProblem('g4.div', `${d * q} ÷ ${d}`, q, [q + 1, q - 1, q + 10, q - 10, q * 10, d]);
};

const orderBeginner: TopicGenerator = rng => {
  const a = randInt(rng, 2, 30), b = randInt(rng, 2, 9), c = randInt(rng, 2, 9);
  const r = a + b * c;
  return intProblem('g4.order', `${a} + ${b} × ${c}`, r, [(a + b) * c, r + 1, r - 1]);
};
const orderAdvanced: TopicGenerator = rng => {
  if (rng() < 0.5) {
    const a = randInt(rng, 3, 20), b = randInt(rng, 3, 20), c = randInt(rng, 2, 9), r = (a + b) * c;
    return intProblem('g4.order', `(${a} + ${b}) × ${c}`, r, [a + b * c, a * c + b, r + c, r - c]);
  }
  const a = randInt(rng, 2, 9), b = randInt(rng, 10, 30), c = randInt(rng, 2, b - 5), r = a * (b - c);
  return intProblem('g4.order', `${a} × (${b} − ${c})`, r, [a * b - c, r + a, r - a]);
};
const orderExpert: TopicGenerator = rng => {
  if (rng() < 0.5) {
    const a = randInt(rng, 2, 9), b = randInt(rng, 2, 9), c = randInt(rng, 8, 15), d = randInt(rng, 2, 6);
    const r = (a + b) * (c - d);
    return intProblem('g4.order', `(${a} + ${b}) × (${c} − ${d})`, r, [(a + b) * c - d, a + b * (c - d), r + a + b]);
  }
  const a = randInt(rng, 3, 9), b = randInt(rng, 3, 9), c = randInt(rng, 3, 9), d = randInt(rng, 3, 9);
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
  beginner: [addGen(1000, 1), subGen(1000, 1), mulBeginner, divGen(2, 9), orderBeginner, fractionOf(2, 5, true, 60)],
  advanced: [addGen(10000, 10), subGen(10000, 10), mulAdvanced, divGen(3, 5), orderAdvanced, fractionOf(2, 6, false, 60)],
  expert: [addGen(100000, 100), subGen(100000, 100), mulExpert, divGen(3, 9), orderExpert, fractionOf(2, 10, false, 120)],
};


