import { topics as active, parkedTopics } from '../../src/problems/grade6';
import { checkGrade, mergeTables } from './helpers';
import { evalText } from './evalText';
import { createRng } from '../../src/rng';
import { gcd } from '../../src/problems/rational';

const topics = mergeTables(active, parkedTopics);
const all = () => (['beginner', 'advanced', 'expert'] as const).flatMap(d =>
  topics[d].flatMap(gen => Array.from({ length: 300 }, (_, seed) => ({ d, p: gen(createRng(seed)) }))));

test('grade 6 topics satisfy the shared rules', () => checkGrade(topics, evalText));

test('topic ids are g6.*, answers reduced and typeable in 8 characters', () => {
  for (const { p } of all()) {
    expect(p.topic.startsWith('g6.')).toBe(true);
    expect(gcd(p.answer.value.n, p.answer.value.d)).toBe(1);
    expect(p.answer.text.length).toBeLessThanOrEqual(8);
  }
});

test('every grade 6 topic appears at every difficulty it should', () => {
  const ids = (d: 'beginner' | 'advanced' | 'expert') => new Set(all().filter(x => x.d === d).map(x => x.p.topic));
  for (const d of ['beginner', 'advanced', 'expert'] as const)
    for (const t of ['g6.frac-mul', 'g6.frac-div', 'g6.dec-mul', 'g6.dec-div', 'g6.percent', 'g6.ratio'])
      expect(ids(d)).toContain(t);
});

test('percent problems have whole answers and are consistent', () => {
  let forward = 0, reverse = 0;
  for (const { d, p } of all()) {
    if (p.topic !== 'g6.percent') continue;
    expect(p.answer.kind).toBe('int');
    const f = p.text.match(/^(\d+)% מתוך (\d+)$/);
    if (f) { expect((+f[1] * +f[2]) % 100).toBe(0); expect(p.answer.value.n).toBe((+f[1] * +f[2]) / 100); forward++; }
    const r = p.text.match(/^(\d+)% מהמספר הם (\d+)\. מה המספר\?$/);
    if (r) { expect(p.answer.value.n * +r[1]).toBe(+r[2] * 100); expect(d).toBe('expert'); reverse++; }
    expect(f || r).toBeTruthy();
    if (d === 'beginner') expect([10, 25, 50]).toContain(+(f ?? [])[1]);
  }
  expect(forward).toBeGreaterThan(0);
  expect(reverse).toBeGreaterThan(0);
});

test('ratio problems split the total correctly', () => {
  let seen = 0;
  for (const { d, p } of all()) {
    if (p.topic !== 'g6.ratio') continue;
    const m = p.text.match(/^חלקו (\d+) ביחס (\d+):(\d+)\. מה החלק (הגדול|הקטן)\?$/)!;
    expect(m).not.toBeNull();
    const [total, a, b] = [+m[1], +m[2], +m[3]];
    expect(total % (a + b)).toBe(0);
    const part = (m[4] === 'הגדול' ? Math.max(a, b) : Math.min(a, b)) * (total / (a + b));
    expect(p.answer.value.n).toBe(part);
    if (d === 'beginner') expect(a).toBe(1);
    if (d !== 'expert') expect(m[4]).toBe('הגדול');
    seen++;
  }
  expect(seen).toBeGreaterThan(0);
});

test('decimal points: x10 and x100 and /10, /100 stay within 2 decimal places', () => {
  for (const { p } of all()) {
    if (p.topic === 'g6.dec-mul' || p.topic === 'g6.dec-div') expect(100 % p.answer.value.d).toBe(0);
  }
});
