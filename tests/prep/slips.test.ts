import { expect, it } from 'vitest';
import { generateSimilar } from '../../src/prep/generate';
import { slips } from '../../src/prep/slips';
import { createRng } from '../../src/rng';
import { shape } from './helpers';

it.each([['6 × (2 + 3)', 'ignore-brackets', '15'], ['2 + 3 × 4', 'left-to-right', '20'], ['48 + 37', 'no-carry', '75'], ['83 − 35', 'no-borrow', '52'],
  ['3/4 + 1/8', 'frac-add-both', '1/3'], ['3.45 + 2.7', 'decimal-shift', '123/2'], ['▢ + 38 = 91', 'missing-same-op', '129']])
  ('%s has slip %s = %s', (input, slip, value) => {
    const hit = slips(shape(input).exercise).find(x => x.slip === slip)!; expect(hit.value.d === 1 ? `${hit.value.n}` : `${hit.value.n}/${hit.value.d}`).toBe(value);
  });
it('tags the wrong choice a slip produced', () => {
  const p = generateSimilar(shape('6 × (2 + 3)'), 'beginner', 5, createRng(2), new Set())!;
  expect(Object.values(p.slips)).toContain('ignore-brackets');
});
