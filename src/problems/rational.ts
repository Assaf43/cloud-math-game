import type { Answer, Rational } from '../types';

export function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Reduced non-negative rational. Throws on zero denominator or a negative value. */
export function rat(n: number, d = 1): Rational {
  if (d === 0) throw new Error('zero denominator');
  if (d < 0) { n = -n; d = -d; }
  if (n < 0) throw new Error('negative value');
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}

export const add = (a: Rational, b: Rational): Rational => rat(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Rational, b: Rational): Rational => rat(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Rational, b: Rational): Rational => rat(a.n * b.n, a.d * b.d);
export const div = (a: Rational, b: Rational): Rational => rat(a.n * b.d, a.d * b.n);
export const eq = (a: Rational, b: Rational): boolean => a.n === b.n && a.d === b.d;

export function intAnswer(n: number): Answer {
  return { value: rat(n), kind: 'int', text: String(n) };
}

/** Whole numbers become `int`; otherwise `3/4` or mixed `1 1/2`. */
export function fractionAnswer(r: Rational): Answer {
  if (r.d === 1) return intAnswer(r.n);
  const whole = Math.floor(r.n / r.d);
  const rem = r.n - whole * r.d;
  const text = whole > 0 ? `${whole} ${rem}/${r.d}` : `${rem}/${r.d}`;
  return { value: r, kind: 'fraction', text };
}

/** Throws unless the value has at most 2 decimal places. */
export function decimalAnswer(r: Rational): Answer {
  if (100 % r.d !== 0) throw new Error('not representable with 2 decimal places');
  const hundredths = r.n * (100 / r.d);
  const whole = Math.floor(hundredths / 100);
  const frac = String(hundredths % 100).padStart(2, '0').replace(/0+$/, '');
  return { value: r, kind: 'decimal', text: frac ? `${whole}.${frac}` : String(whole) };
}
