import { topics } from '../../src/problems/grade3';
import { checkGrade } from './helpers';
import { evalText } from './evalText';
import { createRng } from '../../src/rng';
import { eq, rat } from '../../src/problems/rational';

test('grade 3 topics satisfy the shared rules', () => checkGrade(topics, evalText));

test('grade 3 answers are integers up to 10000', () => {
  for (const d of ['beginner', 'advanced', 'expert'] as const)
    for (const gen of topics[d])
      for (let seed = 0; seed < 300; seed++) {
        const p = gen(createRng(seed));
        expect(p.answer.kind).toBe('int');
        expect(p.answer.value.n).toBeLessThanOrEqual(10000);
        expect(p.topic.startsWith('g3.')).toBe(true);
      }
});

test('g3.order wrong list contains the precedence-ignoring result', () => {
  for (const d of ['advanced', 'expert'] as const)
    for (const gen of topics[d])
      for (let seed = 0; seed < 300; seed++) {
        const p = gen(createRng(seed));
        if (p.topic !== 'g3.order') continue;
        const a = p.text.match(/^(\d+) \+ (\d+) × (\d+)$/);
        if (a) expect(p.wrong.some(w => eq(w, rat((+a[1] + +a[2]) * +a[3])))).toBe(true);
        const b = p.text.match(/^\((\d+) \+ (\d+)\) × (\d+)$/);
        if (b) expect(p.wrong.some(w => eq(w, rat(+b[1] + +b[2] * +b[3])))).toBe(true);
      }
});

test('each difficulty only uses the topics the plan lists', () => {
  const ids = (d: 'beginner' | 'advanced' | 'expert') => new Set(topics[d].map(g => g(createRng(1)).topic));
  expect(ids('beginner')).not.toContain('g3.order');
  expect(ids('beginner')).not.toContain('g3.div-tens');
  expect(ids('expert')).not.toContain('g3.div-table');
  expect(ids('advanced')).toContain('g3.order');
});
