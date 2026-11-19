import { analyze } from '../../src/prep/shape';

export const shape = (s: string) => {
  const a = analyze(s);
  if (!a.ok) throw new Error(a.reason);
  return a.shape;
};
