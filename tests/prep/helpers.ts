import { analyze } from '../../src/prep/shape';

export const shape = (s: string) => {
  const a = analyze(s);
  if (!a.ok) throw new Error(a.reason);
  return a.shape;
};

/** Typical test-prep examples, one per supported shape family. */
export const EXAMPLES = ['48 × 6', '345 + 27', '83 − 35', '126 ÷ 3', '6 × (2 + 3)', '2 + 3 × 4', '(12 + 8) ÷ 4', '3/8 + 2/8', '3/4 + 1/8',
  '1 3/4 − 1/2', '2/3 × 3/4', '3.45 + 2.7', '4.5 − 1.2', '0.6 × 3', '▢ × 7 = 56', '120 − ▢ = 45', '2/3 = ▢/12', '6/8 = 3/▢', '3/4 = ?'];
