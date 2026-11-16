import { generateProblem } from '../../src/problems';
import { choiceCount } from '../../src/problems/choices';
import { eq, parseInput } from '../../src/problems/rational';
import { createRng } from '../../src/rng';

test.each([3, 4, 5, 6] as const)('grade %i produces valid problems at every difficulty', grade => {
  for (const d of ['beginner', 'advanced', 'expert'] as const)
    for (let seed = 0; seed < 300; seed++) {
      const p = generateProblem(grade, d, createRng(seed));
      expect(p.choices).toHaveLength(choiceCount(d));
      expect(p.choices.filter(c => eq(c.value, p.answer.value))).toHaveLength(1);
      expect(new Set(p.choices.map(c => c.text)).size).toBe(p.choices.length);
      expect(parseInput(p.answer.text)).not.toBeNull();   // every answer can be typed
      expect(p.answer.text.length).toBeLessThanOrEqual(8);
      // every choice on screen can be typed and parses back to its own value
      for (const c of p.choices) {
        expect(c.text.length).toBeLessThanOrEqual(8);
        expect(eq(parseInput(c.text)!.value, c.value)).toBe(true);
      }
      expect(typeof p.strictKind).toBe('boolean');
    }
});

test('same seed gives the same problem', () => {
  const a = generateProblem(5, 'expert', createRng(9)), b = generateProblem(5, 'expert', createRng(9));
  expect(a).toEqual(b);
});
