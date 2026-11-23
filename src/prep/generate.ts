import type { Answer, Difficulty, Grade, Problem, Rational, Rng } from '../types';
import { buildChoices, choiceCount } from '../problems/choices';
import { div, eq, gcd, rat } from '../problems/rational';
import { createRng, pick, randInt } from '../rng';
import { evaluate, exerciseAnswer, exerciseText } from './expr';
import type { Bin, Exercise, Expr, Num, NumKind, Op } from './expr';
import { analyze, formatAnswer } from './shape';
import type { Shape } from './shape';
import { slips } from './slips';
import type { SlipId } from './slips';

export interface PrepProblem extends Problem { shapeKey: string; exercise: Exercise; slips: Record<string, SlipId>; stubborn: boolean }

const MAX_ATTEMPTS = 400;
const MAX_DENOMINATOR = 24;
const GRADE_MAX_INT: Record<Grade, number> = { 3: 1000, 4: 10000, 5: 100000, 6: 100000 };
const DIFFICULTIES: Difficulty[] = ['beginner', 'advanced', 'expert'];
const VARY_CALLS = 400;
const MAX_MISSES = 3;          // canVary gives up on a difficulty after this many null calls in a row

/**
 * One generateSimilar call: the difficulty, the grade cap, the rng, the example's largest int leaf (expert growth), and
 * `wide`: a beginner shape whose own ranges give too few problems draws its whole numbers by the advanced rule.
 */
interface Ctx { d: Difficulty; cap: number; rng: Rng; largest: Num | null; wide: boolean }

const lcm = (a: number, b: number) => a / gcd(a, b) * b;
const range = (lo: number, hi: number) => Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);

function makeNum(kind: NumKind, value: Rational, text: string, places = 0): Num {
  return { type: 'num', kind, value, text, places };
}
const intNum = (v: number) => makeNum('int', rat(v), String(v));
const fracNum = (n: number, d: number) => makeNum('fraction', rat(n, d), `${n}/${d}`);
const mixedNum = (w: number, n: number, d: number) => makeNum('mixed', rat(w * d + n, d), `${w} ${n}/${d}`);
const denOf = (n: Num) => Number(n.text.split('/')[1]);   // the typed denominator, not the reduced one

// ---- table row "int" ------------------------------------------------------------------------------

interface IntRange { lo: number; hi: number; unit: number }

/** Null when the leaf keeps its example value (0 or 1). `grows` is the parent operator of the expert's largest leaf. */
function intRange(v: number, c: Ctx, grows: Op | null): IntRange | null {
  if (v <= 1) return null;
  const k = String(v).length;
  let unit = 1;                                     // a multiple of 10^m keeps that unit
  while (v % (unit * 10) === 0) unit *= 10;
  const narrow = c.d === 'beginner' && !c.wide;
  const lo = Math.max(2, 10 ** (k - 1), narrow ? Math.ceil(v / 2) : 0);
  let hi = narrow ? v : 10 ** k - 1;
  if (c.d === 'expert' && grows) hi = grows === '×' || grows === '÷' ? 2 * 10 ** k - 1 : 10 ** (k + 1) - 1;
  return { lo, hi: Math.min(hi, Math.max(c.cap, v)), unit };
}

/** A multiple of the leaf's unit (and of `factor`) inside its range; null when there is none. */
function drawInt(r: IntRange, rng: Rng, factor = 1): number | null {
  const step = lcm(r.unit, factor);
  const [a, b] = [Math.ceil(r.lo / step), Math.floor(r.hi / step)];
  return a > b ? null : step * randInt(rng, a, b);
}

function intLeaf(n: Num, c: Ctx, parent: Op | null, factor = 1): number | null {
  const r = intRange(n.value.n, c, n === c.largest ? parent : null);
  return r ? drawInt(r, c.rng, factor) : n.value.n;
}

// ---- table rows "fraction", "mixed", "decimal" ------------------------------------------------------

type Relation = 'equal' | 'multiple' | 'other';
const HARDER: Record<Relation, Relation> = { equal: 'multiple', multiple: 'other', other: 'other' };

function relation(ds: number[]): Relation {
  if (ds.every((d) => d === ds[0])) return 'equal';
  return ds.every((a) => ds.every((b) => a % b === 0 || b % a === 0)) ? 'multiple' : 'other';
}

/** Denominators for every fraction-like leaf, in tree order; null when this draw breaks the relation. */
function denominators(example: number[], c: Ctx): number[] | null {
  if (example.length === 0) return [];
  const max = c.d === 'beginner' ? Math.min(12, Math.max(6, ...example)) : 12;   // owner ruling 2026-11-19: beginner 2…max(6, example)
  const want = example.length < 2 ? null : c.d === 'expert' ? HARDER[relation(example)] : relation(example);
  let ds: number[];
  if (want === 'equal') {
    const d = randInt(c.rng, 2, max);
    ds = example.map(() => d);
  } else if (want === 'multiple') {
    if (max < 4) return null;
    const base = randInt(c.rng, 2, Math.floor(max / 2));
    ds = example.map(() => base * randInt(c.rng, 1, Math.floor(max / base)));
  } else ds = example.map(() => randInt(c.rng, 2, max));
  if (want && relation(ds) !== want) return null;
  return ds.reduce(lcm, 1) <= MAX_DENOMINATOR ? ds : null;
}

const MIXED_WHOLE_MAX: Record<Difficulty, number> = { beginner: 0, advanced: 2, expert: 3 };   // beginner: the example's

function mixedWhole(n: Num, c: Ctx): number {
  const example = Math.floor(n.value.n / n.value.d);
  const hi = c.d === 'beginner' ? example : MIXED_WHOLE_MAX[c.d];
  return hi < 1 ? example : randInt(c.rng, 1, hi);
}

const DECIMAL_INT_MAX: Record<Difficulty, number> = { beginner: 0, advanced: 9, expert: 19 };   // beginner: the example's

/** Exactly `places` digits after the point; the last one is never 0, so "3.40" is never shown. */
function decimalLeaf(n: Num, c: Ctx): Num {
  const whole = randInt(c.rng, 0, c.d === 'beginner' ? Math.floor(n.value.n / n.value.d) : DECIMAL_INT_MAX[c.d]);
  const p = n.places;
  const digits = 10 * randInt(c.rng, 0, 10 ** (p - 1) - 1) + randInt(c.rng, 1, 9);
  return makeNum('decimal', rat(whole * 10 ** p + digits, 10 ** p), `${whole}.${String(digits).padStart(p, '0')}`, p);
}

// ---- plain: redraw every leaf of the tree ---------------------------------------------------------

const leaves = (e: Expr, parent: Op | null): [Num, Op | null][] =>
  e.type === 'num' ? [[e, parent]] : e.type === 'bin' ? [...leaves(e.left, e.op), ...leaves(e.right, e.op)] : [];

/** The first int leaf with the largest example value. */
function largestInt(e: Expr): Num | null {
  let best: Num | null = null;
  for (const [n] of leaves(e, null)) if (n.kind === 'int' && (!best || n.value.n > best.value.n)) best = n;
  return best;
}

function exactQuotient(b: Bin): boolean {
  if (b.op !== '÷' || b.left.type !== 'num' || b.left.kind !== 'int') return false;
  try {
    return div(evaluate(b.left), evaluate(b.right)).d === 1;
  } catch {
    return false;
  }
}

class Redo extends Error {}
const redo = (): never => { throw new Redo(); };

function redraw(e: Expr, parent: Op | null, c: Ctx, dens: number[]): Expr {
  if (e.type === 'hole') return e;
  if (e.type === 'num') {
    if (e.kind === 'int') return intNum(intLeaf(e, c, parent) ?? redo());
    if (e.kind === 'decimal') return decimalLeaf(e, c);
    const d = dens.shift()!;
    const n = randInt(c.rng, 1, d - 1);
    return e.kind === 'fraction' ? fracNum(n, d) : mixedNum(mixedWhole(e, c), n, d);
  }
  if (exactQuotient(e)) {   // draw the divisor, then a dividend in range that it divides
    const right = redraw(e.right, e.op, c, dens);
    let divisor: Rational;
    try { divisor = evaluate(right); } catch { return redo(); }
    if (divisor.n === 0) redo();
    return { ...e, left: intNum(intLeaf(e.left as Num, c, e.op, divisor.n) ?? redo()), right };
  }
  const left = redraw(e.left, e.op, c, dens);
  return { ...e, left, right: redraw(e.right, e.op, c, dens) };
}

function drawPlain(expr: Bin, c: Ctx): Exercise {
  const fracs = leaves(expr, null).filter(([n]) => n.kind === 'fraction' || n.kind === 'mixed').map(([n]) => denOf(n));
  const dens = denominators(fracs, c) ?? redo();
  return { form: 'plain', expr: redraw(expr, null, { ...c, largest: largestInt(expr) }, dens) as Bin };
}

// ---- missing: draw the hole and the other small operand, compute the third number --------------------

function drawMissing(x: Extract<Exercise, { form: 'missing' }>, c: Ctx): Exercise {
  const { left, result } = x;
  const holeLeft = left.left.type === 'hole';
  const other = (holeLeft ? left.right : left.left) as Num;
  const hole = exerciseAnswer(x);
  const make = (o: number, r: number): Exercise => {
    if (o > Math.max(c.cap, other.value.n) || r > Math.max(c.cap, result.value.n)) redo();
    const on = intNum(o);
    return { form: 'missing', left: { ...left, left: holeLeft ? left.left : on, right: holeLeft ? on : left.right }, result: intNum(r) };
  };
  if (hole.d !== 1) {         // the hole is not a whole number: just redraw the two written numbers
    const ints = { ...c, largest: other.value.n >= result.value.n ? other : result };
    return make(intLeaf(other, ints, left.op) ?? redo(), intLeaf(result, ints, left.op) ?? redo());
  }
  const h = intNum(hole.n);
  // the two "small" numbers that get drawn: the hole and the written operand, or the hole and the result
  const smallResult = left.op === '−' && !holeLeft || left.op === '÷' && !holeLeft;
  const second = smallResult ? result : other;
  const ints = { ...c, largest: h.value.n >= second.value.n ? h : second };
  if (left.op === '÷' && holeLeft) {   // ▢ ÷ o = r: the hole is a dividend that o divides
    const o = intLeaf(other, ints, '÷') ?? redo();
    const hv = intLeaf(h, ints, '÷', o) ?? redo();
    return make(o, hv / o);
  }
  const hv = intLeaf(h, ints, left.op) ?? redo();
  const s = intLeaf(second, ints, left.op) ?? redo();
  switch (left.op) {
    case '+': return make(s, hv + s);
    case '×': return make(s, hv * s);
    case '−': return holeLeft ? (hv < s ? redo() : make(s, hv - s)) : make(hv + s, s);
    case '÷': return make(hv * s, s);
  }
}

// ---- table rows "expand" and "convert" ------------------------------------------------------------

const EXPAND: Record<Difficulty, { den: number; factor: number }> = {
  beginner: { den: 6, factor: 3 }, advanced: { den: 6, factor: 6 }, expert: { den: 9, factor: 6 },
};

/** A reduced fraction a/b and a factor f; keeps whether the example expands (2/3 = ▢/12) or reduces (6/8 = 3/▢). */
function drawExpand(x: Extract<Exercise, { form: 'expand' }>, c: Ctx): Exercise {
  const [kn, kd] = x.known.text.split('/').map(Number);
  const grows = x.numerator === null ? x.denominator! >= kd : x.numerator >= kn;
  const b = randInt(c.rng, 2, EXPAND[c.d].den);
  const a = pick(c.rng, range(1, b - 1).filter((n) => gcd(n, b) === 1));
  const f = randInt(c.rng, 2, EXPAND[c.d].factor);
  const known = grows ? fracNum(a, b) : fracNum(a * f, b * f);
  const k = grows ? f : 1;
  return x.numerator === null
    ? { form: 'expand', known, numerator: null, denominator: b * k }
    : { form: 'expand', known, numerator: a * k, denominator: null };
}

const CONVERT: Record<Difficulty, number[]> = { beginner: [2, 10], advanced: [2, 4, 5, 10], expert: [2, 4, 5, 10, 20, 25, 50] };

function drawConvert(x: Extract<Exercise, { form: 'convert' }>, c: Ctx): Exercise {
  const d = pick(c.rng, c.d === 'beginner' ? [...CONVERT.beginner, denOf(x.fraction)] : CONVERT[c.d]);
  const n = randInt(c.rng, 1, d - 1);
  const whole = c.d === 'expert' && c.rng() < 0.5 ? randInt(c.rng, 1, 5) : 0;
  return { form: 'convert', fraction: whole ? mixedNum(whole, n, d) : fracNum(n, d) };
}

function draw(x: Exercise, c: Ctx): Exercise {
  switch (x.form) {
    case 'plain': return drawPlain(x.expr, c);
    case 'missing': return drawMissing(x, c);
    case 'expand': return drawExpand(x, c);
    case 'convert': return drawConvert(x, c);
  }
}

// ---- validation and the problem ------------------------------------------------------------------

const looseKey = (k: string) => k.replace(/i\d+/g, 'i');

/** The drawn exercise read back from its text: supported, same shape and answer kind, new to the child. */
function check(x: Exercise, shape: Shape, d: Difficulty, avoid: ReadonlySet<string>): { exercise: Exercise; text: string; answer: Answer } | null {
  const text = exerciseText(x);
  if (text === shape.exampleText || avoid.has(text)) return null;
  const a = analyze(text);
  if (!a.ok || a.shape.answerKind !== shape.answerKind) return null;
  if (d === 'expert' ? looseKey(a.shape.key) !== looseKey(shape.key) : a.shape.key !== shape.key) return null;
  const answer = formatAnswer(shape.answerKind, exerciseAnswer(a.shape.exercise));
  return answer && { exercise: a.shape.exercise, text, answer };
}

/** Up to MAX_ATTEMPTS draws; the first one that passes `check`, else null. */
function drawChecked(shape: Shape, c: Ctx, avoid: ReadonlySet<string>): ReturnType<typeof check> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const found = check(draw(shape.exercise, c), shape, c.d, avoid);
      if (found) return found;
    } catch (e) {
      if (!(e instanceof Redo)) throw e;
    }
  }
  return null;
}

const WIDE_CACHE_MAX = 200;
const wideCache = new Map<string, boolean>();   // `${grade} ${exampleText}` -> beginner draws whole numbers widely

/**
 * True when the beginner ranges give fewer than 5 different problems for this shape and grade. Decided once with its own
 * rng (so a caller's rng is never touched) and the canVary early stop: each draw must be new; 3 empty draws in a row end it.
 */
function beginnerTooFew(shape: Shape, grade: Grade): boolean {
  const key = `${grade} ${shape.exampleText}`;
  const known = wideCache.get(key);
  if (known !== undefined) return known;
  const c: Ctx = { d: 'beginner', cap: GRADE_MAX_INT[grade], rng: createRng(1), largest: null, wide: false };
  const seen = new Set<string>();
  for (let misses = 0; seen.size < 5 && misses < MAX_MISSES;) {
    const found = drawChecked(shape, c, seen);
    if (found) { seen.add(found.text); misses = 0; } else misses++;
  }
  if (wideCache.size >= WIDE_CACHE_MAX) wideCache.clear();
  wideCache.set(key, seen.size < 5);
  return seen.size < 5;
}

export function generateSimilar(shape: Shape, difficulty: Difficulty, grade: Grade, rng: Rng, avoid: ReadonlySet<string>): PrepProblem | null {
  const wide = difficulty === 'beginner' && beginnerTooFew(shape, grade);
  const found = drawChecked(shape, { d: difficulty, cap: GRADE_MAX_INT[grade], rng, largest: null, wide }, avoid);
  if (!found) return null;
  const { exercise, text, answer } = found;
  const mistakes = slips(exercise);
  const choices = buildChoices(answer, mistakes.map((m) => m.value), choiceCount(difficulty), rng);
  const tags: Record<string, SlipId> = {};
  for (const ch of choices) {
    const hit = eq(ch.value, answer.value) ? undefined : mistakes.find((m) => eq(m.value, ch.value));
    if (hit) tags[ch.text] = hit.slip;
  }
  return { text, topic: `prep.${shape.key}`, answer, choices, shapeKey: shape.key, exercise, slips: tags, stubborn: false };
}

/** True when every difficulty yields at least 5 different problems in 400 calls (stops after 3 empty calls in a row). */
export function canVary(shape: Shape, grade: Grade): boolean {
  return DIFFICULTIES.every((d) => {
    const rng = createRng(1);
    const seen = new Set<string>();
    for (let i = 0, misses = 0; i < VARY_CALLS && seen.size < 5 && misses < MAX_MISSES; i++) {
      const p = generateSimilar(shape, d, grade, rng, new Set());
      misses = p ? 0 : misses + 1;
      if (p) seen.add(p.text);
    }
    return seen.size >= 5;
  });
}
