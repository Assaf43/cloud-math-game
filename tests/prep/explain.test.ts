import { describe, expect, it } from 'vitest';
import { explain } from '../../src/prep/explain';
import { generateSimilar } from '../../src/prep/generate';
import type { PrepProblem } from '../../src/prep/generate';
import { exerciseAnswer } from '../../src/prep/expr';
import { formatAnswer } from '../../src/prep/shape';
import { SLIP_TEXT } from '../../src/prep/slips';
import { eq } from '../../src/problems/rational';
import { createRng } from '../../src/rng';
import { evalText } from '../problems/evalText';
import { EXAMPLES, shape } from './helpers';

const P = (text: string): PrepProblem => {                       // a PrepProblem for exactly this text
  const s = shape(text); const a = formatAnswer(s.answerKind, exerciseAnswer(s.exercise))!;
  return { text, topic: 'prep.' + s.key, answer: a, choices: [a], shapeKey: s.key, exercise: s.exercise, slips: { '15': 'ignore-brackets' }, stubborn: false };
};

describe('explain', () => {
  it.each([
    ['12 × 7', ['10 × 7 = 70', '2 × 7 = 14', '70 + 14 = 84']], ['48 + 37', ['40 + 30 = 70', '8 + 7 = 15', '70 + 15 = 85']],
    ['83 − 35', ['83 − 30 = 53', '53 − 5 = 48']], ['126 ÷ 3', ['3 × 42 = 126', '126 ÷ 3 = 42']], ['6 × 7', ['6 × 7 = 42']],
    ['6 × (2 + 3)', ['2 + 3 = 5', '6 × 5 = 30']], ['2 + 3 × 4', ['3 × 4 = 12', '2 + 12 = 14']],
    ['3/8 + 2/8', ['3 + 2 = 5', '3/8 + 2/8 = 5/8']], ['3/4 + 1/8', ['מכנה משותף: 8', '3/4 = 6/8', '6/8 + 1/8 = 7/8']],
    ['3/4 + 3/4', ['3 + 3 = 6', '3/4 + 3/4 = 6/4', '6/4 = 1 1/2']], ['3.45 + 2.7', ['2.7 = 2.70', '3.45 + 2.70 = 6.15']],
    ['▢ × 7 = 56', ['56 ÷ 7 = 8', 'בדיקה: 8 × 7 = 56']], ['120 − ▢ = 45', ['120 − 45 = 75', 'בדיקה: 120 − 75 = 45']],
    ['2/3 = ▢/12', ['12 ÷ 3 = 4', '2 × 4 = 8', '2/3 = 8/12']], ['3/4 = ?', ['3/4 = 75/100', '75/100 = 0.75']], ['2/3 × 3/4', ['2/3 × 3/4 = 1/2']],
  ])('%s', (text, steps) => expect(explain(P(text), null).steps).toEqual(steps));

  it('names the slip only for a tagged wrong answer', () => {
    expect(explain(P('6 × (2 + 3)'), '15').slip).toBe(SLIP_TEXT['ignore-brackets']);
    expect(explain(P('6 × (2 + 3)'), '31').slip).toBeNull(); expect(explain(P('6 × (2 + 3)'), null).slip).toBeNull();
  });

  const cleanSide = (step: string) => step.replace(/^(בדיקה|מכנה משותף): /, '');
  describe.each(EXAMPLES)('generated from %s', (example) => {
    const s = shape(example);
    it.each(['beginner', 'advanced', 'expert'] as const)('%s: 1–5 steps, every equality true, last step ends with the answer', (d) => {
      for (let seed = 0; seed < 200; seed++) {
        const p = generateSimilar(s, d, 5, createRng(seed), new Set())!;
        const { steps } = explain(p, null);
        const where = `${p.text} [${d} #${seed}]: ${steps.join(' | ')}`;
        expect(steps.length >= 1 && steps.length <= 5, where).toBe(true);
        for (const step of steps) {
          const sides = cleanSide(step).split('=');
          if (sides.length < 2) continue;
          const values = sides.map((x) => evalText(x.trim()));
          expect(values.every((v) => v !== null && eq(v, values[0]!)), where).toBe(true);
        }
        const last = steps[steps.length - 1];
        const ok = p.exercise.form === 'missing' || p.exercise.form === 'expand' ? last.includes(p.answer.text) : last.endsWith(p.answer.text);
        expect(ok, where).toBe(true);
        expect(steps.join(' '), where).not.toMatch(/טעית|טעות|לא נכון|שגוי/);
        expect(steps.every((x) => !/(^| )0 [+−×÷] |[+−×÷] 0 =/.test(x)), where).toBe(true);   // no step with a zero part
      }
    });
  });

  it('never uses judging words', () => {
    for (const t of Object.values(SLIP_TEXT)) expect(t).not.toMatch(/טעית|טעות|לא נכון|שגוי/);
  });
});
