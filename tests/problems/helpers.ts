import type { Difficulty, Rational } from '../../src/types';
import type { TopicGenerator } from '../../src/problems/topic';
import { createRng } from '../../src/rng';
import { eq } from '../../src/problems/rational';

export type Table = Record<Difficulty, TopicGenerator[]>;
/** The active topics plus the parked ones (fractions, decimals): both stay correct and tested. */
export const mergeTables = (a: Table, b: Table): Table => ({
  beginner: [...a.beginner, ...b.beginner], advanced: [...a.advanced, ...b.advanced], expert: [...a.expert, ...b.expert],
});

export function checkGrade(topics: Record<Difficulty, TopicGenerator[]>, evalText?: (t: string) => Rational | null) {
  for (const d of ['beginner', 'advanced', 'expert'] as const) {
    expect(topics[d].length).toBeGreaterThan(0);
    topics[d].forEach((gen, i) => {
      for (let seed = 0; seed < 300; seed++) {
        const p = gen(createRng(seed * 31 + i));
        expect(p.answer.value.n).toBeGreaterThanOrEqual(0);
        if (p.answer.kind === 'decimal') expect(100 % p.answer.value.d).toBe(0);
        expect(p.wrong.every(w => w.n >= 0)).toBe(true);
        if (evalText) { const v = evalText(p.text); if (v) expect(eq(v, p.answer.value)).toBe(true); }
      }
    });
  }
}
