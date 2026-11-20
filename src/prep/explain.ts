import type { Rational } from '../types';
import { decimalAnswer, fractionAnswer, gcd } from '../problems/rational';
import { evaluate, exerciseAnswer, exerciseText } from './expr';
import type { Bin, Exercise, Expr, Num, Op } from './expr';
import type { PrepProblem } from './generate';
import { SLIP_TEXT } from './slips';

export interface Explanation { steps: string[]; slip: string | null }

const MAX_PARTS = 4;      // an × split into more parts would not fit in 5 steps
const lcm = (a: number, b: number) => a / gcd(a, b) * b;

/** A computed value as the game writes it: a whole number, a decimal (only in decimal exercises), or a fraction. */
function fmt(v: Rational, decimal: boolean): string {
  if (v.d === 1) return String(v.n);
  return decimal && 100 % v.d === 0 ? decimalAnswer(v).text : fractionAnswer(v).text;
}

const nums = (e: Expr): Num[] => e.type === 'num' ? [e] : e.type === 'bin' ? [...nums(e.left), ...nums(e.right)] : [];
const bins = (e: Expr): number => e.type === 'bin' ? 1 + bins(e.left) + bins(e.right) : 0;
const isFrac = (n: Num) => n.kind === 'fraction' || n.kind === 'mixed';

// ---- int, int: one function per row -----------------------------------------------------------------

/** Both ≥ 10: the part above the ones, the ones, then the sum of the parts. */
function addInts(a: number, b: number, answer: string): string[] | null {
  if (a < 10 || b < 10) return null;
  const [ra, rb, oa, ob] = [a - a % 10, b - b % 10, a % 10, b % 10];
  const rest = ra + rb;
  if (oa === 0 && ob === 0) return [`${ra} + ${rb} = ${rest}`];
  if (oa === 0 || ob === 0) return [`${ra} + ${rb} = ${rest}`, `${rest} + ${oa + ob} = ${answer}`];
  return [`${ra} + ${rb} = ${rest}`, `${oa} + ${ob} = ${oa + ob}`, `${rest} + ${oa + ob} = ${answer}`];
}

/** Subtrahend ≥ 10: everything above its ones first, then its ones. */
function subInts(a: number, b: number, answer: string): string[] | null {
  if (b < 10) return null;
  const [rb, ob] = [b - b % 10, b % 10];
  const first = `${a} − ${rb} = ${a - rb}`;
  return ob === 0 ? [first] : [first, `${a - rb} − ${ob} = ${answer}`];
}

/** One factor ≥ 10: the larger factor by place value, one line per non-zero part, then the sum. */
function mulInts(a: number, b: number, answer: string): string[] | null {
  const [big, small] = [Math.max(a, b), Math.min(a, b)];
  if (big < 10) return null;
  const parts = [...String(big)].map((c, i, all) => Number(c) * 10 ** (all.length - 1 - i)).filter((p) => p > 0);
  if (parts.length < 2 || parts.length > MAX_PARTS) return null;
  return [...parts.map((p) => `${p} × ${small} = ${p * small}`), `${parts.map((p) => p * small).join(' + ')} = ${answer}`];
}

/** An exact quotient that is not a one-digit fact: the multiplication that gives the dividend, then the division. */
function divInts(a: number, b: number, answer: string): string[] | null {
  const q = a / b;
  if (!Number.isInteger(q) || (b <= 10 && q <= 10)) return null;
  return [`${b} × ${q} = ${a}`, `${a} ÷ ${b} = ${answer}`];
}

// ---- fractions and mixed numbers, + − ------------------------------------------------------------------

interface Part { whole: number; n: number; d: number; frac: boolean }

function part(x: Num): Part {
  if (x.kind === 'int') return { whole: x.value.n, n: 0, d: 1, frac: false };
  const [front, d] = x.text.split('/');
  const words = front.split(' ');
  const n = Number(words[words.length - 1]);
  return { whole: words.length === 2 ? Number(words[0]) : 0, n, d: Number(d), frac: true };
}

/** The unsimplified result over the common denominator: `5/8` when no whole part was involved, else `1 1/4`. */
function overDenominator(total: number, L: number, plain: boolean): string {
  if (plain) return `${total}/${L}`;
  const [w, r] = [Math.floor(total / L), total % L];
  return r === 0 ? String(w) : w === 0 ? `${r}/${L}` : `${w} ${r}/${L}`;
}

function addSubFractions(a: Num, b: Num, op: Op, answer: string): string[] {
  const [pa, pb] = [part(a), part(b)];
  const L = [pa, pb].filter((p) => p.frac).reduce((l, p) => lcm(l, p.d), 1);
  const scaled = (p: Part) => p.n * (L / p.d);
  const [ta, tb] = [pa.whole * L + scaled(pa), pb.whole * L + scaled(pb)];
  const plain = a.kind === 'fraction' && b.kind === 'fraction' && pa.n < pa.d && pb.n < pb.d;
  const steps: string[] = [];
  if (plain && pa.d === pb.d) steps.push(`${pa.n} ${op} ${pb.n} = ${op === '+' ? pa.n + pb.n : pa.n - pb.n}`);
  const wide = [pa, pb].filter((p) => p.frac && p.d !== L);
  if (wide.length > 0) {
    steps.push(`מכנה משותף: ${L}`);
    for (const p of wide) steps.push(`${p.n}/${p.d} = ${scaled(p)}/${L}`);
  }
  const written = (p: Part) => overDenominator(p.whole * L + scaled(p), L, plain);
  const result = overDenominator(op === '+' ? ta + tb : ta - tb, L, plain);
  const [left, right] = [written(pa), written(pb)];
  steps.push(`${left} ${op} ${right} = ${result}`);
  if (result !== answer) steps.push(`${result} = ${answer}`);
  return steps;
}

// ---- decimals, + − ------------------------------------------------------------------------------------

/** The operand(s) with fewer places are padded; with equal places there is just the result line. */
function addSubDecimals(a: Num, b: Num, op: Op, answer: string): string[] {
  const places = Math.max(a.places, b.places);
  const steps: string[] = [];
  const pad = (x: Num) => {
    if (x.kind !== 'decimal' || x.places === places) return x.text;
    const padded = x.text + '0'.repeat(places - x.places);
    steps.push(`${x.text} = ${padded}`);
    return padded;
  };
  const [left, right] = [pad(a), pad(b)];
  return [...steps, `${left} ${op} ${right} = ${answer}`];
}

// ---- more than one operator -----------------------------------------------------------------------------

/** One line per operation in evaluation order; each line uses the previous results' text. Returns the text of `e`'s value. */
function walk(e: Expr, decimal: boolean, out: string[]): string {
  if (e.type !== 'bin') return e.type === 'num' ? e.text : '▢';
  const [l, r] = [walk(e.left, decimal, out), walk(e.right, decimal, out)];
  const result = fmt(evaluate(e), decimal);
  out.push(`${l} ${e.op} ${r} = ${result}`);
  return result;
}

// ---- one operator -----------------------------------------------------------------------------------------

function singleOperator(e: Bin, answer: string): string[] {
  const [a, b] = [e.left as Num, e.right as Num];
  const addSub = e.op === '+' || e.op === '−';
  let steps: string[] | null = null;
  if (a.kind === 'int' && b.kind === 'int') {
    const [x, y] = [a.value.n, b.value.n];
    steps = e.op === '+' ? addInts(x, y, answer) : e.op === '−' ? subInts(x, y, answer) : e.op === '×' ? mulInts(x, y, answer) : divInts(x, y, answer);
  } else if (addSub && [a, b].every((n) => n.kind === 'int' || isFrac(n))) steps = addSubFractions(a, b, e.op, answer);
  else if (addSub) steps = addSubDecimals(a, b, e.op, answer);
  return steps ?? [`${a.text} ${e.op} ${b.text} = ${answer}`];
}

// ---- missing number ---------------------------------------------------------------------------------------

/** The inverse operation, then the original equation with the solution filled in. */
function missing(x: Extract<Exercise, { form: 'missing' }>): string[] {
  const { left, result } = x;
  const holeLeft = left.left.type === 'hole';
  const other = evaluate(holeLeft ? left.right : left.left);
  const [o, r] = [fmt(other, false), result.text];
  const s = fmt(exerciseAnswer(x), false);
  let inverse: string;
  switch (left.op) {
    case '+': inverse = `${r} − ${o}`; break;
    case '×': inverse = `${r} ÷ ${o}`; break;
    case '−': inverse = holeLeft ? `${r} + ${o}` : `${o} − ${r}`; break;
    case '÷': inverse = holeLeft ? `${r} × ${o}` : `${o} ÷ ${r}`; break;
  }
  const filled = holeLeft ? `${s} ${left.op} ${o}` : `${o} ${left.op} ${s}`;
  return [`${inverse} = ${s}`, `בדיקה: ${filled} = ${r}`];
}

// ---- expand and convert -----------------------------------------------------------------------------------

/** The factor between the two parts, applied to the other part of the known fraction. */
function expand(x: Extract<Exercise, { form: 'expand' }>): string[] | null {
  const { known, numerator, denominator } = x;
  const [kn, kd] = known.text.split('/').map(Number);
  const [given, other, base] = numerator === null ? [denominator!, kn, kd] : [numerator, kd, kn];   // `given` pairs with `base`
  const grows = given >= base;
  const [big, small] = grows ? [given, base] : [base, given];
  if (big % small !== 0 || big === small) return null;
  const f = big / small;
  const op = grows ? '×' : '÷';
  const filled = grows ? other * f : other / f;
  if (!Number.isInteger(filled)) return null;
  const result = numerator === null ? `${filled}/${denominator}` : `${numerator}/${filled}`;
  return [`${big} ÷ ${small} = ${f}`, `${other} ${op} ${f} = ${filled}`, `${known.text} = ${result}`];
}

/** Expand to tenths when the denominator divides 10, else hundredths; then the decimal. */
function convert(fraction: Num, answer: string): string[] | null {
  const { whole, n, d } = part(fraction);
  const target = 10 % d === 0 ? 10 : 100 % d === 0 ? 100 : 0;
  if (target === 0) return null;
  if (target === d) return [`${fraction.text} = ${answer}`];
  const scaled = n * (target / d);
  const front = whole > 0 ? `${whole} ` : '';
  return [`${n}/${d} = ${scaled}/${target}`, `${front}${scaled}/${target} = ${answer}`];
}

// ---- the dispatcher ---------------------------------------------------------------------------------------

function stepsFor(p: PrepProblem): string[] {
  const x = p.exercise;
  const answer = p.answer.text;
  let steps: string[] | null = null;
  switch (x.form) {
    case 'plain':
      if (bins(x.expr) > 1) {
        const out: string[] = [];
        walk(x.expr, nums(x.expr).some((n) => n.kind === 'decimal'), out);
        steps = out;
      } else steps = singleOperator(x.expr, answer);
      break;
    case 'missing': steps = missing(x); break;
    case 'expand': steps = expand(x); break;
    case 'convert': steps = convert(x.fraction, answer); break;
  }
  if (steps && steps.length > 0) return steps;
  const text = exerciseText(x);
  return [x.form === 'plain' ? `${text} = ${answer}` : text.replace(/▢|\?/, answer)];
}

export function explain(p: PrepProblem, pickedText: string | null): Explanation {
  let steps: string[];
  try {
    steps = stepsFor(p);
  } catch {
    steps = [`${p.text} = ${p.answer.text}`];
  }
  const id = pickedText === null ? undefined : p.slips[pickedText];
  return { steps, slip: (id && SLIP_TEXT[id]) || null };
}
