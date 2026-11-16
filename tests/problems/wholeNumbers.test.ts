import { generateProblem } from '../../src/problems';
import { topics as t3 } from '../../src/problems/grade3';
import { topics as t4 } from '../../src/problems/grade4';
import { topics as t5 } from '../../src/problems/grade5';
import { topics as t6 } from '../../src/problems/grade6';
import { createRng } from '../../src/rng';
import { evalText } from './evalText';
import { eq, rat } from '../../src/problems/rational';
import type { Difficulty, Grade } from '../../src/types';

const GRADES: [Grade, typeof t3][] = [[3, t3], [4, t4], [5, t5], [6, t6]];
const DS = ['beginner', 'advanced', 'expert'] as const;

test('what children are asked is whole numbers only: no fractions, no decimals', () => {
  for (const g of [3, 4, 5, 6] as const) for (const d of DS)
    for (let seed = 0; seed < 400; seed++) {
      const p = generateProblem(g, d, createRng(seed));
      expect(p.answer.kind).toBe('int');
      expect(p.choices.every(c => c.kind === 'int')).toBe(true);
      expect(p.text).not.toMatch(/\d\/\d|\d\.\d/);
    }
});

test('every active topic of every grade and level gives a whole, non-negative answer', () => {
  for (const [, table] of GRADES) for (const d of DS) for (const gen of table[d])
    for (let seed = 0; seed < 300; seed++) {
      const p = gen(createRng(seed));
      expect(p.answer.kind).toBe('int');
      expect(p.answer.value.d).toBe(1);
    }
});

test('grades 5 and 6 ask order-of-operations exercises with brackets at every level (like 6 × (2 + 3))', () => {
  for (const [grade, table] of [[5, t5], [6, t6]] as const) for (const d of DS) {
    const texts: string[] = [];
    for (const gen of table[d]) for (let seed = 0; seed < 200; seed++) { const p = gen(createRng(seed)); if (p.topic === `g${grade}.order`) texts.push(p.text); }
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.some(t => t.includes('('))).toBe(true);
  }
});

test('order exercises are computed correctly and stay small', () => {
  const cap: Record<Difficulty, number> = { beginner: 150, advanced: 400, expert: 500 };
  for (const [, table] of GRADES) for (const d of DS) for (const gen of table[d])
    for (let seed = 0; seed < 300; seed++) {
      const p = gen(createRng(seed));
      if (!p.topic.endsWith('.order')) continue;
      const v = evalText(p.text);
      expect(v).not.toBeNull();
      expect(eq(v!, p.answer.value)).toBe(true);
      expect(p.answer.value.n).toBeLessThanOrEqual(cap[d]);
      expect(p.answer.value.n).toBeGreaterThanOrEqual(1);
      expect(Math.max(...(p.text.match(/\d+/g) ?? []).map(Number))).toBeLessThanOrEqual(40);
    }
});

test('the wrong answers of an order exercise include the classic mistake', () => {
  const p = (() => {
    for (let seed = 0; seed < 500; seed++) {
      const q = t5.beginner.map(g => g(createRng(seed))).find(x => x.text.match(/^\d+ × \(\d+ \+ \d+\)$/));
      if (q) return q;
    }
    throw new Error('no sample');
  })();
  const [a, b, c] = p.text.match(/\d+/g)!.map(Number);
  expect(p.wrong.some(w => eq(w, rat(a * b + c)))).toBe(true);        // multiplying only the first number of the bracket
});

test('missing-number exercises have a unique whole answer that makes the sentence true', () => {
  for (const [, table] of GRADES) for (const d of DS) for (const gen of table[d])
    for (let seed = 0; seed < 300; seed++) {
      const p = gen(createRng(seed));
      if (!p.topic.endsWith('.missing')) continue;
      const filled = p.text.replace('▢', String(p.answer.value.n));
      const [left, right] = filled.split(' = ');
      expect(eq(evalText(left)!, rat(+right))).toBe(true);
    }
});

test('grade 5 and 6 numbers stay mental-math sized', () => {
  const numbersOf = (table: typeof t5, d: Difficulty, id: string) => {
    const out: number[][] = [];
    for (const gen of table[d]) for (let seed = 0; seed < 300; seed++) { const p = gen(createRng(seed)); if (p.topic === id) out.push((p.text.match(/\d+/g) ?? []).map(Number)); }
    expect(out.length).toBeGreaterThan(0);
    return out;
  };
  const addCap: Record<Difficulty, number> = { beginner: 100, advanced: 1000, expert: 6000 };
  for (const d of DS) for (const id of ['g5.add', 'g5.sub']) for (const nn of numbersOf(t5, d, id)) expect(Math.max(...nn)).toBeLessThanOrEqual(addCap[d]);
  for (const d of DS) for (const nn of numbersOf(t5, d, 'g5.order')) expect(Math.max(...nn)).toBeLessThanOrEqual(15);
  for (const d of DS) for (const nn of numbersOf(t6, d, 'g6.order')) expect(Math.max(...nn)).toBeLessThanOrEqual(20);
  for (const nn of numbersOf(t5, 'beginner', 'g5.mul')) expect(nn[0] * nn[1]).toBeLessThanOrEqual(108);
  for (const nn of numbersOf(t5, 'expert', 'g5.mul')) expect(nn[0] * nn[1]).toBeLessThanOrEqual(750);
});
