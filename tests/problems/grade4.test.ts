import { topics as active, parkedTopics } from '../../src/problems/grade4';
import { checkGrade, mergeTables } from './helpers';
import { evalText } from './evalText';
import { createRng } from '../../src/rng';

const topics = mergeTables(active, parkedTopics);

test('grade 4 topics satisfy the shared rules', () => checkGrade(topics, evalText));

test('grade 4 answers are integers and topic ids are g4.*', () => {
  for (const d of ['beginner', 'advanced', 'expert'] as const)
    for (const gen of topics[d])
      for (let seed = 0; seed < 300; seed++) {
        const p = gen(createRng(seed));
        expect(p.answer.kind).toBe('int');
        expect(p.topic.startsWith('g4.')).toBe(true);
      }
});

test('add and sub results stay within the difficulty bound', () => {
  const bound = { beginner: 1000, advanced: 10000, expert: 100000 } as const;
  for (const d of ['beginner', 'advanced', 'expert'] as const)
    for (const gen of topics[d])
      for (let seed = 0; seed < 300; seed++) {
        const p = gen(createRng(seed));
        if (p.topic === 'g4.add' || p.topic === 'g4.sub') expect(p.answer.value.n).toBeLessThanOrEqual(bound[d]);
      }
});

test('g4.fraction-of quantity is a multiple of the denominator', () => {
  let seen = 0;
  for (const d of ['beginner', 'advanced', 'expert'] as const)
    for (const gen of topics[d])
      for (let seed = 0; seed < 300; seed++) {
        const p = gen(createRng(seed));
        if (p.topic !== 'g4.fraction-of') continue;
        const m = p.text.match(/^(\d+)\/(\d+) מתוך (\d+)$/)!;
        expect(m).not.toBeNull();
        expect(+m[3] % +m[2]).toBe(0);
        expect(+m[1]).toBeLessThan(+m[2]);
        expect(p.answer.value.n).toBe((+m[1] * +m[3]) / +m[2]);
        if (d === 'expert') expect(+m[3]).toBeLessThanOrEqual(200);
        if (d === 'beginner') expect(+m[1]).toBe(1);
        seen++;
      }
  expect(seen).toBeGreaterThan(0);
});

test('division is exact with a one-digit divisor', () => {
  for (const d of ['beginner', 'advanced', 'expert'] as const)
    for (const gen of topics[d])
      for (let seed = 0; seed < 300; seed++) {
        const p = gen(createRng(seed));
        if (p.topic !== 'g4.div') continue;
        const m = p.text.match(/^(\d+) ÷ (\d+)$/)!;
        expect(+m[2]).toBeLessThanOrEqual(9);
        expect(+m[1] % +m[2]).toBe(0);
      }
});
