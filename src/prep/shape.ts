import type { Answer, AnswerKind, Rational } from '../types';
import { gcd, intAnswer, fractionAnswer, decimalAnswer } from '../problems/rational';
import { exerciseAnswer, exerciseText, parseExercise, normalize } from './expr';
import type { Bin, Exercise, Expr, Num, Op, ParseError } from './expr';

export type RejectReason = ParseError | 'negative' | 'div-zero' | 'too-precise' | 'too-long' | 'hole' | 'mixed-kinds' | 'too-many-ops' | 'cannot-vary';
export interface Shape { key: string; label: string; exercise: Exercise; answerKind: AnswerKind; exampleText: string }
export type Analysis = { ok: true; shape: Shape } | { ok: false; reason: RejectReason };

export const REJECT_TEXT: Record<RejectReason, string> = {
  empty: '',
  letters: 'אפשר להקליד רק מספרים וסימני חשבון.',
  syntax: 'לא הצלחתי לקרוא את התרגיל. כדאי לבדוק סוגריים וסימנים.',
  negative: 'התוצאה יוצאת מתחת לאפס, ואת זה עוד אי אפשר לתרגל.',
  'div-zero': 'יש כאן חילוק באפס.',
  'too-precise': 'אפשר עד שתי ספרות אחרי הנקודה.',
  'too-long': 'התוצאה ארוכה מדי למסך.',
  hole: 'אפשר מספר חסר אחד, בתרגיל עם פעולה אחת.',
  'mixed-kinds': 'שברים ועשרוניים באותו תרגיל עוד אי אפשר לתרגל.',
  'too-many-ops': 'התרגיל ארוך מדי. אפשר עד ארבע פעולות.',
  'cannot-vary': 'לא הצלחתי לייצר תרגילים דומים לזה.',
};

const MAX_OPS = 4;
const MAX_DENOMINATOR = 24;
const MAX_ANSWER_TEXT = 8;

/** Null when the value cannot be shown as `kind` within the global limits. */
export function formatAnswer(kind: AnswerKind, value: Rational): Answer | null {
  let answer: Answer;
  if (kind === 'int') {
    if (value.d !== 1) return null;
    answer = intAnswer(value.n);
  } else if (kind === 'fraction') {
    if (value.d === 1 || value.d > MAX_DENOMINATOR) return null;
    answer = fractionAnswer(value);
  } else {
    if (100 % value.d !== 0) return null;
    answer = decimalAnswer(value);
  }
  return answer.text.length > MAX_ANSWER_TEXT ? null : answer;
}

function operands(e: Expr): Num[] {
  if (e.type === 'num') return [e];
  return e.type === 'bin' ? [...operands(e.left), ...operands(e.right)] : [];
}

const bins = (e: Expr): Bin[] => e.type === 'bin' ? [e, ...bins(e.left), ...bins(e.right)] : [];

const exerciseNums = (x: Exercise): Num[] => {
  switch (x.form) {
    case 'plain': return operands(x.expr);
    case 'missing': return operands(x.left);
    case 'expand': return [x.known];
    case 'convert': return [x.fraction];
  }
};

const lcm = (a: number, b: number) => a / gcd(a, b) * b;

const OP_NAME: Record<Op, string> = { '+': 'חיבור', '−': 'חיסור', '×': 'כפל', '÷': 'חילוק' };
const DIGIT_WORD = ['', 'חד-ספרתי', 'דו-ספרתי', 'תלת-ספרתי', 'רב-ספרתי'];
const digitWord = (n: Num) => DIGIT_WORD[Math.min(n.text.length, 4)];

function plainLabel(expr: Bin): string {
  if (bins(expr).length > 1) return bins(expr).some((b) => b.paren) ? 'סדר פעולות עם סוגריים' : 'סדר פעולות';
  const [a, b] = operands(expr);
  const kinds = [a.kind, b.kind];
  let what: string;
  if (kinds.includes('mixed')) what = 'מספרים מעורבים';
  else if (kinds.includes('fraction')) what = 'שברים';
  else if (kinds.includes('decimal')) what = 'עשרוניים';
  else what = `${digitWord(a)} ${expr.op === '×' || expr.op === '÷' ? 'ב' : 'ו'}${digitWord(b)}`;
  return `${OP_NAME[expr.op]} ${what}`;
}

const SHORT: Record<Num['kind'], string> = { int: 'i', fraction: 'f', mixed: 'm', decimal: 'd' };

function keyOf(e: Expr, withDigits: boolean): string {
  if (e.type === 'hole') return '▢';
  if (e.type === 'num') {
    if (e.kind === 'int') return withDigits ? `i${e.text.length}` : 'i';
    return e.kind === 'decimal' ? `d${e.places}` : SHORT[e.kind];
  }
  const s = `${keyOf(e.left, withDigits)}${e.op}${keyOf(e.right, withDigits)}`;
  return e.paren ? `(${s})` : s;
}

/** Form + number kinds + operators + parentheses; the actual numbers do not matter. */
function describe(x: Exercise): { key: string; label: string } {
  switch (x.form) {
    case 'plain': return { key: `plain:${keyOf(x.expr, true)}`, label: plainLabel(x.expr) };
    case 'missing': return { key: `missing:${keyOf(x.left, false)}`, label: `מספר חסר ב${OP_NAME[x.left.op]}` };
    case 'convert': return { key: 'convert', label: 'שבר למספר עשרוני' };
    case 'expand': {
      // the hole is the larger part when the known fraction is being expanded
      const [kn, kd] = x.known.text.split('/').map(Number);   // value is reduced, the text is what was typed
      const grows = x.numerator === null ? x.denominator! >= kd : x.numerator >= kn;
      return { key: `expand:${x.numerator === null ? 'num' : 'den'}`, label: grows ? 'הרחבת שברים' : 'צמצום שברים' };
    }
  }
}

const reject = (reason: RejectReason): Analysis => ({ ok: false, reason });
const EVAL_ERRORS: Record<string, RejectReason> = { 'negative value': 'negative', 'zero denominator': 'div-zero', 'too large': 'too-long' };

/** Checks one typed exercise against the practice limits; never returns 'cannot-vary'. */
export function analyze(input: string): Analysis {
  const parsed = parseExercise(input);
  if (!parsed.ok) return reject(parsed.error === 'syntax' && normalize(input).includes('▢') ? 'hole' : parsed.error);
  const x = parsed.exercise;
  if (x.form === 'plain' && bins(x.expr).length > MAX_OPS) return reject('too-many-ops');
  const nums = exerciseNums(x);
  const has = (k: Num['kind']) => nums.some((n) => n.kind === k);
  const rational = has('fraction') || has('mixed');
  if (x.form === 'plain' && rational && has('decimal')) return reject('mixed-kinds');
  if (nums.some((n) => n.places > 2)) return reject('too-precise');

  let value: Rational;
  try {
    value = exerciseAnswer(x);
  } catch (e) {
    const reason = e instanceof Error ? EVAL_ERRORS[e.message] : undefined;
    if (!reason) throw e;
    return reject(reason);
  }
  const answerKind: AnswerKind = value.d === 1 ? 'int' : has('decimal') || x.form === 'convert' ? 'decimal' : 'fraction';
  if (answerKind === 'decimal' && 100 % value.d !== 0) return reject('too-precise');
  if (x.form === 'plain' && rational && nums.reduce((l, n) => lcm(l, n.value.d), 1) > MAX_DENOMINATOR) return reject('too-long');
  if (!formatAnswer(answerKind, value)) return reject('too-long');
  return { ok: true, shape: { ...describe(x), exercise: x, answerKind, exampleText: exerciseText(x) } };
}
