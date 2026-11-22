import type { Rational } from '../types';
import { rat, add, sub, mul, div } from '../problems/rational';

export type Op = '+' | '−' | '×' | '÷';
export type NumKind = 'int' | 'fraction' | 'mixed' | 'decimal';
export interface Num { type: 'num'; kind: NumKind; value: Rational; text: string; places: number }  // places: digits after the point, else 0
export interface Hole { type: 'hole' }
export interface Bin { type: 'bin'; op: Op; left: Expr; right: Expr; paren: boolean }
export type Expr = Num | Hole | Bin;
export type Exercise =
  | { form: 'plain'; expr: Bin }
  | { form: 'missing'; left: Bin; result: Num }                       // exactly one Hole, a direct operand of `left`; both other numbers are ints
  | { form: 'expand'; known: Num; numerator: number | null; denominator: number | null }   // "2/3 = ▢/12": the null one is the hole
  | { form: 'convert'; fraction: Num };                               // "3/4 = ?"
export type ParseError = 'empty' | 'letters' | 'syntax';
export const MAX_INPUT = 40;

const BIDI = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
const ALT: Record<string, string> = { '*': '×', x: '×', X: '×', ':': '÷', '-': '−', '–': '−', '□': '▢', _: '▢' };

/** Cleans what a child typed: no bidi marks, game symbols, one ▢ for a run of them ("___"), single spaces, at most MAX_INPUT chars. */
export function normalize(input: string): string {
  return input.replace(BIDI, '').replace(/[*xX:\-–□_]/g, (c) => ALT[c]).replace(/▢+/g, '▢')
    .trim().replace(/\s+/g, ' ').slice(0, MAX_INPUT);
}

type Sym = '(' | ')' | '=' | '/' | '?' | '▢';
type Token = Num | { type: 'op'; op: Op } | { type: 'sym'; sym: Sym };
class ParseFail extends Error {}
const fail = (): never => { throw new ParseFail(); };

function safeInt(digits: string): number {
  const v = Number(digits);
  return Number.isSafeInteger(v) ? v : fail();
}

function num(kind: NumKind, value: Rational, text: string, places = 0): Num {
  return { type: 'num', kind, value, text, places };
}

/** Longest form first: mixed, fraction, decimal, int. A zero denominator is a syntax error. */
function lexNumber(s: string, i: number): [Num, number] {
  const rest = s.slice(i);
  let m = /^(\d+) (\d+)\/(\d+)/.exec(rest);
  if (m) {
    const [w, n, d] = [safeInt(m[1]), safeInt(m[2]), safeInt(m[3])];
    if (d === 0 || !Number.isSafeInteger(w * d + n)) fail();
    return [num('mixed', rat(w * d + n, d), `${w} ${n}/${d}`), i + m[0].length];
  }
  m = /^(\d+)\/(\d+)/.exec(rest);
  if (m) {
    const [n, d] = [safeInt(m[1]), safeInt(m[2])];
    if (d === 0) fail();
    return [num('fraction', rat(n, d), `${n}/${d}`), i + m[0].length];
  }
  m = /^(\d+)\.(\d+)/.exec(rest);
  if (m) {
    const places = m[2].length;
    if (!Number.isSafeInteger(10 ** places)) fail();
    return [num('decimal', rat(safeInt(m[1] + m[2]), 10 ** places), `${safeInt(m[1])}.${m[2]}`, places), i + m[0].length];
  }
  m = /^\d+/.exec(rest)!;
  const v = safeInt(m[0]);
  return [num('int', rat(v), String(v)), i + m[0].length];
}

function lex(s: string): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c === ' ') i++;
    else if (/\d/.test(c)) { const [t, next] = lexNumber(s, i); out.push(t); i = next; }
    else if ('+−×÷'.includes(c)) { out.push({ type: 'op', op: c as Op }); i++; }
    else if ('()=/?▢'.includes(c)) { out.push({ type: 'sym', sym: c as Sym }); i++; }
    else fail();
  }
  return out;
}

const isSym = (t: Token | undefined, sym: Sym) => t?.type === 'sym' && t.sym === sym;
const isNum = (t: Token | undefined): t is Num => t?.type === 'num';
type Pos = { i: number };

/** expr := term (('+'|'−') term)*;  term := primary (('×'|'÷') primary)*  — left-associative. */
function parseExpr(t: Token[], pos: Pos): Expr {
  return chain(t, pos, ['+', '−'], () => chain(t, pos, ['×', '÷'], () => primary(t, pos)));
}

function chain(t: Token[], pos: Pos, ops: string[], next: () => Expr): Expr {
  let left = next();
  for (let tok = t[pos.i]; tok?.type === 'op' && ops.includes(tok.op); tok = t[pos.i]) {
    pos.i++;
    left = { type: 'bin', op: tok.op, left, right: next(), paren: false };
  }
  return left;
}

function primary(t: Token[], pos: Pos): Expr {
  const tok = t[pos.i++];
  if (isNum(tok)) return tok;
  if (isSym(tok, '▢')) return { type: 'hole' };
  if (!isSym(tok, '(')) return fail();
  const inner = parseExpr(t, pos);
  if (!isSym(t[pos.i++], ')')) fail();
  return inner.type === 'bin' ? { ...inner, paren: true } : inner;
}

const holes = (e: Expr): number => e.type === 'hole' ? 1 : e.type === 'bin' ? holes(e.left) + holes(e.right) : 0;

/** `known = ▢/12` or `known = 3/▢`: the hole is null. */
function expandParts(t: Token[]): { numerator: number | null; denominator: number | null } | null {
  if (t.length !== 5 || !isSym(t[1], '=') || !isSym(t[3], '/')) return null;
  const [a, b] = [t[2], t[4]];
  if (isSym(a, '▢') && isNum(b) && b.kind === 'int') return { numerator: null, denominator: b.value.n };
  if (isNum(a) && a.kind === 'int' && isSym(b, '▢')) return { numerator: a.value.n, denominator: null };
  return null;
}

function parseTokens(t: Token[]): Exercise {
  const first = t[0];
  if (isNum(first) && (first.kind === 'fraction' || first.kind === 'mixed')
    && t.length === 3 && isSym(t[1], '=') && isSym(t[2], '?')) return { form: 'convert', fraction: first };
  if (isNum(first) && first.kind === 'fraction') {
    const parts = expandParts(t);
    if (parts) {
      if (parts.denominator === 0) fail();
      return { form: 'expand', known: first, ...parts };
    }
  }
  const pos: Pos = { i: 0 };
  const expr = parseExpr(t, pos);
  let result: Num | null = null;
  if (isSym(t[pos.i], '=')) {
    const r = t[pos.i + 1];
    if (isNum(r)) {
      result = r;
      pos.i += 2;
    } else if (r === undefined || isSym(r, '?') || isSym(r, '▢')) {   // "48 × 6 =", "= ?", "= ▢": dropped like "= 288"
      if (expr.type !== 'bin' || holes(expr) > 0) return fail();
      pos.i += r === undefined ? 1 : 2;
    } else return fail();
  }
  if (pos.i !== t.length || expr.type !== 'bin') return fail();
  const h = holes(expr);
  if (h === 0) return { form: 'plain', expr };
  const ints = [expr.left, expr.right].every((e) => e.type === 'hole' || (e.type === 'num' && e.kind === 'int'));
  if (h !== 1 || !ints || !result || result.kind !== 'int') return fail();
  return { form: 'missing', left: { ...expr, paren: false }, result };
}

export function parseExercise(input: string): { ok: true; exercise: Exercise } | { ok: false; error: ParseError } {
  const s = normalize(input);
  if (!s) return { ok: false, error: 'empty' };
  if (/[A-Za-z֐-׿]/.test(s)) return { ok: false, error: 'letters' };
  try {
    return { ok: true, exercise: parseTokens(lex(s)) };
  } catch (e) {
    if (e instanceof ParseFail) return { ok: false, error: 'syntax' };
    throw e;
  }
}

const OPS: Record<Op, (a: Rational, b: Rational) => Rational> = { '+': add, '−': sub, '×': mul, '÷': div };

/** rational.ts works in plain doubles: refuse any operation whose intermediate products leave exact integer range. */
function apply(op: Op, a: Rational, b: Rational): Rational {
  const cross = [a.n * b.d, b.n * a.d, a.d * b.d, a.n * b.n];
  if (![...cross, cross[0] + cross[1]].every(Number.isSafeInteger)) throw new Error('too large');
  return OPS[op](a, b);
}

/** Throws on a Hole, a negative intermediate value, or ÷ 0 (sub and div do the throwing). */
export function evaluate(e: Expr): Rational {
  if (e.type === 'num') return e.value;
  if (e.type === 'hole') throw new Error('hole has no value');
  return apply(e.op, evaluate(e.left), evaluate(e.right));
}

function render(e: Expr): string {
  if (e.type === 'num') return e.text;
  if (e.type === 'hole') return '▢';
  const s = `${render(e.left)} ${e.op} ${render(e.right)}`;
  return e.paren ? `(${s})` : s;
}

export function exerciseText(x: Exercise): string {
  switch (x.form) {
    case 'plain': return render(x.expr);
    case 'missing': return `${render(x.left)} = ${x.result.text}`;
    case 'expand': return `${x.known.text} = ${x.numerator ?? '▢'}/${x.denominator ?? '▢'}`;
    case 'convert': return `${x.fraction.text} = ?`;
  }
}

/** The value of the hole: invert the operation around it. */
function solveMissing(left: Bin, result: Rational): Rational {
  const holeLeft = left.left.type === 'hole';
  const other = evaluate(holeLeft ? left.right : left.left);
  switch (left.op) {
    case '+': return apply('−', result, other);
    case '×': return apply('÷', result, other);
    case '−': return holeLeft ? apply('+', result, other) : apply('−', other, result);
    case '÷': {                                       // the divisor (written or solved) is never 0
      const hole = holeLeft ? apply('×', result, other) : apply('÷', other, result);
      if ((holeLeft ? other : hole).n === 0) throw new Error('zero denominator');
      return hole;
    }
  }
}

export function exerciseAnswer(x: Exercise): Rational {
  switch (x.form) {
    case 'plain': return evaluate(x.expr);
    case 'missing': return solveMissing(x.left, x.result.value);
    case 'convert': return x.fraction.value;
    case 'expand': return x.numerator === null
      ? apply('×', x.known.value, rat(x.denominator!))   // ▢/den = known
      : apply('÷', rat(x.numerator), x.known.value);     // num/▢ = known
  }
}
