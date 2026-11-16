import type { Rational } from '../../src/types';
import { add, div, mul, rat, sub } from '../../src/problems/rational';

const TOKEN = /\s*(\d+ \d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|[+−×÷()])/y;

function numberToken(t: string): Rational {
  let m = t.match(/^(\d+) (\d+)\/(\d+)$/);
  if (m) return rat(+m[1] * +m[3] + +m[2], +m[3]);
  m = t.match(/^(\d+)\/(\d+)$/);
  if (m) return rat(+m[1], +m[2]);
  m = t.match(/^(\d+)\.(\d+)$/);
  if (m) return rat(+(m[1] + m[2]), 10 ** m[2].length);
  return rat(+t);
}

/** Evaluates texts made only of numbers, fractions, + − × ÷ and parentheses. Returns null for anything else. */
export function evalText(text: string): Rational | null {
  if (/[^\d\s+−×÷()./]/.test(text)) return null;
  const tokens: string[] = [];
  TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while (TOKEN.lastIndex < text.length && (m = TOKEN.exec(text))) tokens.push(m[1]);
  let pos = 0;
  const expr = (): Rational => {
    let v = term();
    while (tokens[pos] === '+' || tokens[pos] === '−') { const op = tokens[pos++]; const r = term(); v = op === '+' ? add(v, r) : sub(v, r); }
    return v;
  };
  const term = (): Rational => {
    let v = atom();
    while (tokens[pos] === '×' || tokens[pos] === '÷') { const op = tokens[pos++]; const r = atom(); v = op === '×' ? mul(v, r) : div(v, r); }
    return v;
  };
  const atom = (): Rational => {
    const t = tokens[pos++];
    if (t === '(') { const v = expr(); pos++; return v; }
    return numberToken(t);
  };
  return expr();
}
