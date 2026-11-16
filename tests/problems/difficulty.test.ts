import { topics as t3 } from '../../src/problems/grade3';
import { topics as t4 } from '../../src/problems/grade4';
import { topics as t5 } from '../../src/problems/grade5';
import { topics as t6 } from '../../src/problems/grade6';
import type { TopicTable } from '../../src/problems/topic';
import { createRng } from '../../src/rng';
import { gcd } from '../../src/problems/rational';
import { evalText } from './evalText';
import type { Difficulty } from '../../src/types';

/**
 * Children answer in their heads, in 30 seconds, by tapping one of a few answers: numbers must stay friendly.
 * These caps keep every grade within that (the national grade 5 and 6 tests use paper for big multiplications;
 * the game does not).
 */
function sample(table: TopicTable, d: Difficulty, topic: string): string[] {
  const out: string[] = [];
  for (const gen of table[d])
    for (let seed = 0; seed < 400; seed++) {
      const p = gen(createRng(seed));
      if (p.topic === topic) out.push(p.text);
    }
  expect(out.length).toBeGreaterThan(0);
  return out;
}
const nums = (text: string) => (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
const asNums = (texts: string[]) => texts.map(nums);
const DS = ['beginner', 'advanced', 'expert'] as const;

describe('grade 3', () => {
  test('addition and subtraction grow gently: within 100, then 1,000, then 5,000', () => {
    const cap = { beginner: 100, advanced: 1000, expert: 5000 } as const;
    for (const d of DS) for (const topic of ['g3.add', 'g3.sub'])
      for (const [a, b] of asNums(sample(t3, d, topic))) { expect(a).toBeLessThanOrEqual(cap[d]); expect(b).toBeLessThanOrEqual(cap[d]); }
    for (const [a, b] of asNums(sample(t3, 'beginner', 'g3.add'))) expect(a + b).toBeLessThanOrEqual(100);
  });
});

describe('grade 4', () => {
  test('add/sub: up to 1,000; then 10,000 in tens; then 100,000 in hundreds', () => {
    const cap = { beginner: 1000, advanced: 10000, expert: 100000 } as const, unit = { beginner: 1, advanced: 10, expert: 100 } as const;
    for (const d of DS) for (const topic of ['g4.add', 'g4.sub'])
      for (const [a, b] of asNums(sample(t4, d, topic))) {
        expect(a).toBeLessThanOrEqual(cap[d]); expect(a % unit[d]).toBe(0); expect(b % unit[d]).toBe(0);
      }
  });
  test('multiplication is one friendly factor at beginner/advanced and small two-digit factors at expert', () => {
    for (const [a, b] of asNums(sample(t4, 'beginner', 'g4.mul'))) { expect(Math.min(a, b)).toBeLessThanOrEqual(9); expect(Math.max(a, b)).toBeLessThanOrEqual(25); }
    for (const [a, b] of asNums(sample(t4, 'advanced', 'g4.mul'))) { expect(Math.min(a, b)).toBeLessThanOrEqual(9); expect(a * b).toBeLessThanOrEqual(9000); }
    for (const [a, b] of asNums(sample(t4, 'expert', 'g4.mul'))) { expect(a).toBeLessThanOrEqual(40); expect(b).toBeLessThanOrEqual(25); }
  });
  test('division stays within three digits and small divisors at advanced', () => {
    for (const d of ['advanced', 'expert'] as const)
      for (const [dividend, divisor] of asNums(sample(t4, d, 'g4.div'))) { expect(dividend).toBeLessThanOrEqual(999); if (d === 'advanced') expect(divisor).toBeLessThanOrEqual(5); }
  });
  test('fractions of a quantity use small denominators and quantities', () => {
    const maxDen = { beginner: 5, advanced: 6, expert: 10 } as const;
    for (const d of DS) for (const [, den, q] of asNums(sample(t4, d, 'g4.fraction-of'))) { expect(den).toBeLessThanOrEqual(maxDen[d]); expect(q).toBeLessThanOrEqual(120); }
  });
  test('order of operations keeps the numbers small', () => {
    for (const d of DS) for (const nn of asNums(sample(t4, d, 'g4.order'))) expect(Math.max(...nn)).toBeLessThanOrEqual(50);
  });
});

describe('grade 5', () => {
  test('multiplication: one digit, then friendly two-digit, then two-digit by two-digit, never bigger', () => {
    for (const [a, b] of asNums(sample(t5, 'beginner', 'g5.mul'))) { expect(Math.min(a, b)).toBeLessThanOrEqual(9); expect(Math.max(a, b)).toBeLessThanOrEqual(40); }
    for (const [a, b] of asNums(sample(t5, 'advanced', 'g5.mul'))) { expect(a).toBeLessThanOrEqual(35); expect(b === 20 || b === 30 || b === 40 || (b >= 11 && b <= 19)).toBe(true); }
    for (const [a, b] of asNums(sample(t5, 'expert', 'g5.mul'))) { expect(a).toBeLessThanOrEqual(49); expect(b).toBeLessThanOrEqual(29); expect(a * b).toBeLessThanOrEqual(1500); }
  });
  test('division: no big divisors and no big dividends', () => {
    for (const d of DS) for (const [dividend, divisor] of asNums(sample(t5, d, 'g5.div'))) {
      expect(dividend).toBeLessThanOrEqual(1350);
      expect(divisor).toBeLessThanOrEqual(d === 'beginner' ? 90 : 35);
    }
    for (const [, divisor] of asNums(sample(t5, 'advanced', 'g5.div'))) expect([12, 15, 16, 18, 20, 25, 30]).toContain(divisor);
  });
  test('beginner fractions: same denominator, the answer is a proper fraction that needs no simplifying and no mixed number', () => {
    for (const topic of ['g5.frac-add', 'g5.frac-sub'])
      for (const text of sample(t5, 'beginner', topic)) {
        const [d1, d2] = [...text.matchAll(/\/(\d+)/g)].map(m => +m[1]);
        expect(d1).toBe(d2);
        const r = evalText(text)!;
        expect(r.n).toBeGreaterThan(0);
        expect(r.n).toBeLessThan(r.d);          // below 1: no mixed number
        expect(r.d).toBe(d1);                   // already in lowest terms over the same denominator
        expect(d1).toBeGreaterThanOrEqual(3);
      }
  });
  test('advanced fractions: the answer stays below 1 (no mixed numbers)', () => {
    for (const topic of ['g5.frac-add', 'g5.frac-sub'])
      for (const text of sample(t5, 'advanced', topic)) { const r = evalText(text)!; expect(r.n).toBeLessThan(r.d); }
  });
  test('fraction sums at expert have a common denominator of at most 24 and whole parts of at most 2', () => {
    for (const topic of ['g5.frac-add', 'g5.frac-sub'])
      for (const text of sample(t5, 'expert', topic)) {
        const dens = [...text.matchAll(/\/(\d+)/g)].map(m => +m[1]);
        const lcm = dens.reduce((a, b) => (a * b) / gcd(a, b));
        expect(lcm).toBeLessThanOrEqual(24);
        for (const m of text.matchAll(/(?:^|[+−] )(\d+) \d+\/\d+/g)) expect(+m[1]).toBeLessThanOrEqual(2);
      }
  });
  test('decimals: tenths below 10, then tenths with hundredths below 10, then hundredths below 20', () => {
    const cap = { beginner: 10, advanced: 10, expert: 20 } as const;
    for (const d of DS) for (const topic of ['g5.dec-add', 'g5.dec-sub'])
      for (const [a, b] of asNums(sample(t5, d, topic))) { expect(a).toBeLessThan(cap[d]); expect(b).toBeLessThan(cap[d]); }
    for (const text of sample(t5, 'advanced', 'g5.dec-add')) {
      const places = [...text.matchAll(/\d+\.(\d+)/g)].map(m => m[1].length);
      expect(places.sort()).toEqual([1, 2]);
    }
  });
  test('fraction to decimal never mixes a whole part with twentieths or twenty-fifths', () => {
    for (const text of sample(t5, 'expert', 'g5.to-decimal')) expect(text).not.toMatch(/\d+ \d+\/(20|25)/);
  });
  test('expand: numbers stay small', () => {
    for (const d of DS) for (const text of sample(t5, d, 'g5.expand')) for (const n of nums(text)) expect(n).toBeLessThanOrEqual(36);
  });
});

describe('grade 6', () => {
  test('beginner fractions give whole numbers or proper fractions, never mixed numbers', () => {
    for (const text of sample(t6, 'beginner', 'g6.frac-mul')) { const r = evalText(text)!; expect(r.d).toBe(1); }
    for (const text of sample(t6, 'beginner', 'g6.frac-div')) { const r = evalText(text)!; expect(r.d === 1 || r.n < r.d).toBe(true); }
  });
  test('fractions use denominators of at most 6 (at most 5 at expert) and whole parts of at most 2', () => {
    for (const topic of ['g6.frac-mul', 'g6.frac-div'])
      for (const d of ['advanced', 'expert'] as const)
        for (const text of sample(t6, d, topic)) {
          const dens = [...text.matchAll(/\/(\d+)/g)].map(m => +m[1]);
          expect(Math.max(...dens)).toBeLessThanOrEqual(d === 'expert' ? 5 : 6);
          for (const m of text.matchAll(/(?:^|[×÷] )(\d+) \d+\/\d+/g)) expect(+m[1]).toBeLessThanOrEqual(2);
        }
  });
  test('decimal multiplication by decimals is a small tenths number times a single tenth', () => {
    for (const text of sample(t6, 'expert', 'g6.dec-mul')) {
      const [a, b] = nums(text);
      expect(a).toBeLessThanOrEqual(6); expect(b).toBeLessThan(1);
    }
  });
  test('percent problems use quantities of at most 200', () => {
    for (const d of DS) for (const text of sample(t6, d, 'g6.percent')) for (const n of nums(text)) expect(n).toBeLessThanOrEqual(200);
  });
  test('ratio: parts of at most 7 and a multiplier of at most 10', () => {
    for (const d of DS) for (const text of sample(t6, d, 'g6.ratio')) {
      const [total, a, b] = nums(text);
      expect(Math.max(a, b)).toBeLessThanOrEqual(d === 'beginner' ? 5 : 7);
      expect(total / (a + b)).toBeLessThanOrEqual(10);
    }
  });
});
