import { topics as active, parkedTopics } from '../../src/problems/grade5';
import { checkGrade, mergeTables } from './helpers';
import { evalText } from './evalText';
import { createRng } from '../../src/rng';
import { eq, gcd, rat } from '../../src/problems/rational';

const topics = mergeTables(active, parkedTopics);
const all = () => (['beginner', 'advanced', 'expert'] as const).flatMap(d =>
  topics[d].flatMap(gen => Array.from({ length: 300 }, (_, seed) => ({ d, p: gen(createRng(seed)) }))));

test('grade 5 topics satisfy the shared rules', () => checkGrade(topics, evalText));

test('topic ids are g5.* and fraction answers are reduced', () => {
  for (const { p } of all()) {
    expect(p.topic.startsWith('g5.')).toBe(true);
    expect(gcd(p.answer.value.n, p.answer.value.d)).toBe(1);
    if (p.answer.kind === 'fraction') expect(p.answer.value.d).toBeGreaterThan(1);
    expect(p.answer.text.length).toBeLessThanOrEqual(8);
  }
});

test('g5.frac-add wrong list includes numerators added, denominators added', () => {
  let seen = 0;
  for (const { p } of all()) {
    if (p.topic !== 'g5.frac-add') continue;
    const m = p.text.match(/^(?:(\d+) )?(\d+)\/(\d+) \+ (?:(\d+) )?(\d+)\/(\d+)$/)!;
    expect(m).not.toBeNull();
    const n1 = +(m[1] ?? 0) * +m[3] + +m[2], n2 = +(m[4] ?? 0) * +m[6] + +m[5];
    expect(p.wrong.some(w => eq(w, rat(n1 + n2, +m[3] + +m[6])))).toBe(true);
    seen++;
  }
  expect(seen).toBeGreaterThan(0);
});

test('g5.to-decimal has a decimal answer', () => {
  let seen = 0;
  for (const { p } of all()) {
    if (p.topic !== 'g5.to-decimal') continue;
    expect(p.answer.kind).toBe('decimal');
    seen++;
  }
  expect(seen).toBeGreaterThan(0);
});

test('g5.expand fills the missing number correctly', () => {
  let seen = 0;
  for (const { p } of all()) {
    if (p.topic !== 'g5.expand') continue;
    const m = p.text.match(/^(\d+|▢)\/(\d+|▢) = (\d+|▢)\/(\d+|▢)$/)!;
    expect(m).not.toBeNull();
    const v = m.slice(1).map(x => (x === '▢' ? p.answer.value.n : +x));
    expect(v[0] * v[3]).toBe(v[1] * v[2]);
    expect(p.answer.kind).toBe('int');
    seen++;
  }
  expect(seen).toBeGreaterThan(0);
});

test('expand at expert sometimes uses the reduction form', () => {
  expect(all().some(({ d, p }) => d === 'expert' && p.topic === 'g5.expand' && /▢$/.test(p.text))).toBe(true);
});
