import type { Rational } from '../types';
import { add, div, eq, mul, rat, sub } from '../problems/rational';
import { noBorrowSub, noCarryAdd } from '../problems/errors';
import { evaluate, exerciseAnswer, exerciseText, parseExercise } from './expr';
import type { Exercise, Expr, Num, Op } from './expr';

export type SlipId = 'ignore-brackets' | 'left-to-right' | 'no-carry' | 'no-borrow' | 'frac-add-both' | 'decimal-shift' | 'missing-same-op';

export const SLIP_TEXT: Record<SlipId, string> = {
  'ignore-brackets': 'נראה שהסוגריים נשכחו. קודם פותרים את מה שבתוך הסוגריים.',
  'left-to-right': 'נראה שחישבת משמאל לימין. כפל וחילוק באים לפני חיבור וחיסור.',
  'no-carry': 'נראה שנשכחה ההעברה לעשרות.',
  'no-borrow': 'נראה שבאחד הטורים חוסרה הספרה הקטנה מהגדולה. כשהספרה למעלה קטנה יותר, פורטים עשרת.',
  'frac-add-both': 'נראה שחוברו גם המונים וגם המכנים. קודם מביאים למכנה משותף, ואז מחברים רק את המונים.',
  'decimal-shift': 'נראה שהנקודה העשרונית זזה מקום אחד.',
  'missing-same-op': 'נראה שנעשתה הפעולה שכתובה בתרגיל. כדי למצוא מספר חסר משתמשים בפעולה ההפוכה.',
};

const OPS: Record<Op, (a: Rational, b: Rational) => Rational> = { '+': add, '−': sub, '×': mul, '÷': div };

/** Operands and operators in reading order; a bracketed part (below the top) stays one operand. */
function terms(e: Expr, top: boolean, out: (Rational | Op)[]): void {
  if (e.type === 'bin' && (top || !e.paren)) {
    terms(e.left, false, out);
    out.push(e.op);
    terms(e.right, false, out);
  } else out.push(leftToRight(e));
}

/** Ignores × ÷ before + −: every operator is applied in reading order. */
function leftToRight(e: Expr): Rational {
  if (e.type !== 'bin') return evaluate(e);
  const out: (Rational | Op)[] = [];
  terms(e, true, out);
  let v = out[0] as Rational;
  for (let i = 1; i < out.length; i += 2) v = OPS[out[i] as Op](v, out[i + 1] as Rational);
  return v;
}

/** The exercise read again with every bracket removed. */
function withoutBrackets(x: Exercise): Rational {
  const parsed = parseExercise(exerciseText(x).replace(/[()]/g, ''));
  if (!parsed.ok) throw new Error('unreadable');
  return exerciseAnswer(parsed.exercise);
}

const parts = (n: Num) => n.text.split('/').map(Number);   // a fraction's typed numerator and denominator

/** Numerators and denominators added (or subtracted) separately: 3/4 + 1/8 → 4/12. */
function fracBoth(op: Op, a: Num, b: Num): Rational {
  const [an, ad] = parts(a), [bn, bd] = parts(b);
  const [n, d] = op === '+' ? [an + bn, ad + bd] : [an - bn, ad - bd];
  if (n < 0 || d <= 0) throw new Error('no such value');
  return rat(n, d);
}

/** Values a child would get from a typical mistake on this exercise, in a fixed order. */
export function slips(x: Exercise): { value: Rational; slip: SlipId }[] {
  let answer: Rational;
  try {
    answer = exerciseAnswer(x);
  } catch {
    return [];
  }
  const out: { value: Rational; slip: SlipId }[] = [];
  const note = (slip: SlipId, value: () => Rational) => {
    try {
      const v = value();
      const ok = Number.isSafeInteger(v.n) && Number.isSafeInteger(v.d) && v.n >= 0 && v.d > 0;
      if (ok && !eq(v, answer)) out.push({ value: v, slip });
    } catch {
      // a negative value, a zero denominator or an unreadable text: no such mistake here
    }
  };
  const text = exerciseText(x);
  if (x.form === 'plain') {
    const { op, left, right } = x.expr;
    if (text.includes('(')) note('ignore-brackets', () => withoutBrackets(x));
    note('left-to-right', () => leftToRight(x.expr));
    if (left.type === 'num' && right.type === 'num') {
      const ints = left.kind === 'int' && right.kind === 'int';
      if (ints && op === '+') note('no-carry', () => rat(noCarryAdd(left.value.n, right.value.n)));
      if (ints && op === '−') note('no-borrow', () => rat(noBorrowSub(left.value.n, right.value.n)));
      if (left.kind === 'fraction' && right.kind === 'fraction' && (op === '+' || op === '−')) note('frac-add-both', () => fracBoth(op, left, right));
    }
  }
  const decimalAnswer = answer.d !== 1 && (x.form === 'convert' || text.includes('.'));
  if (decimalAnswer) {
    note('decimal-shift', () => mul(answer, rat(10)));
    note('decimal-shift', () => div(answer, rat(10)));
  }
  if (x.form === 'missing') {
    const written = x.left.left.type === 'hole' ? x.left.right : x.left.left;
    note('missing-same-op', () => OPS[x.left.op](evaluate(written), x.result.value));
  }
  return out;
}
