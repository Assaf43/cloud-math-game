import type { Answer, Difficulty, Rational, Rng } from '../types';
import { shuffle } from '../rng';
import { decimalAnswer, eq, fractionAnswer, intAnswer, rat } from './rational';

export function choiceCount(d: Difficulty): 4 | 5 | 6 {
  return d === 'beginner' ? 4 : d === 'advanced' ? 5 : 6;
}

/** Formats a value in the same kind as the answer, or null if it cannot be shown that way. */
function format(kind: Answer['kind'], r: Rational): Answer | null {
  if (r.n < 0 || r.d <= 0) return null;
  if (kind === 'int') return r.d === 1 ? intAnswer(r.n) : null;
  if (kind === 'decimal') return 100 % r.d === 0 ? decimalAnswer(r) : null;
  return fractionAnswer(r);
}

function tryRat(n: number, d = 1): Rational | null {
  return n < 0 || d <= 0 || !Number.isFinite(n) || !Number.isFinite(d) ? null : rat(n, d);
}

/** Generic near-misses of the answer's own kind, then ever-wider offsets so it never runs dry. */
function* nearMisses(answer: Answer): Generator<Rational> {
  const { n, d } = answer.value;
  const out = (r: Rational | null): Rational[] => (r ? [r] : []);
  if (answer.kind === 'int') {
    for (const k of [1, -1, 2, -2, 10, -10]) yield* out(tryRat(n + k));
    const digits = String(n);
    if (digits.length >= 2) {
      const swapped = digits.slice(0, -2) + digits.slice(-1) + digits.slice(-2, -1);
      yield* out(tryRat(parseInt(swapped, 10)));
    }
    for (let k = 3; k < 1000; k++) { yield* out(tryRat(n + k)); yield* out(tryRat(n - k)); }
  } else if (answer.kind === 'decimal') {
    const h = (n * 100) / d;                               // value in hundredths
    for (const k of [10, -10, 1, -1]) yield* out(tryRat(h + k, 100));
    yield* out(tryRat(h * 10, 100));
    if (h % 10 === 0) yield* out(tryRat(h / 10, 100));
    for (let k = 2; k < 1000; k++) { yield* out(tryRat(h + 10 * k, 100)); yield* out(tryRat(h - 10 * k, 100)); }
  } else {
    yield* out(tryRat(n + 1, d)); yield* out(tryRat(n - 1, d));
    yield* out(tryRat(n, d + 1)); yield* out(tryRat(n, d - 1));
    if (n > 0) yield* out(tryRat(d, n));
    for (let k = 2; k < 1000; k++) { yield* out(tryRat(n + k, d)); yield* out(tryRat(n, d + k)); }
  }
}

export function buildChoices(answer: Answer, wrongCandidates: Rational[], count: number, rng: Rng): Answer[] {
  const wrongs: Answer[] = [];
  const taken = (r: Rational) => eq(r, answer.value) || wrongs.some(w => eq(w.value, r));
  const tryAdd = (r: Rational) => {
    if (wrongs.length >= count - 1 || r.n < 0 || taken(r)) return;
    const a = format(answer.kind, r);
    if (a) wrongs.push(a);
  };
  for (const r of wrongCandidates) tryAdd(r);
  if (wrongs.length < count - 1) {
    for (const r of nearMisses(answer)) {
      tryAdd(r);
      if (wrongs.length >= count - 1) break;
    }
  }
  return shuffle(rng, [answer, ...wrongs]);
}
