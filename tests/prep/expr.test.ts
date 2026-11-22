import { parseExercise, exerciseAnswer, exerciseText, normalize } from '../../src/prep/expr';

const ok = (s: string) => { const r = parseExercise(s); if (!r.ok) throw new Error(r.error); return r.exercise; };
it.each([
  ['48 × 6', '48 × 6', '288'], ['48*6', '48 × 6', '288'], ['126 : 3', '126 ÷ 3', '42'], ['48 x 6 = 288', '48 × 6', '288'],
  ['6 × (2 + 3)', '6 × (2 + 3)', '30'], ['2 + 3 × 4', '2 + 3 × 4', '14'], ['20 - 5 - 3', '20 − 5 − 3', '12'],
  ['3/4 + 1/8', '3/4 + 1/8', '7/8'], ['1 3/4 − 1/2', '1 3/4 − 1/2', '5/4'], ['3.45 + 2.7', '3.45 + 2.7', '123/20'],
  ['▢ × 7 = 56', '▢ × 7 = 56', '8'], ['120 − _ = 45', '120 − ▢ = 45', '75'], ['72 ÷ ▢ = 9', '72 ÷ ▢ = 9', '8'],
  ['2/3 = ▢/12', '2/3 = ▢/12', '8'], ['6/8 = 3/▢', '6/8 = 3/▢', '4'], ['3/4 = ?', '3/4 = ?', '3/4'],
  ['\u200F007 + 5\u200E', '7 + 5', '12'],
])('%s', (input, text, answer) => {
  const x = ok(input); const a = exerciseAnswer(x);
  expect(exerciseText(x)).toBe(text); expect(a.d === 1 ? `${a.n}` : `${a.n}/${a.d}`).toBe(answer);
});
it.each([['', 'empty'], ['   ', 'empty'], ['שלוש ועוד שתיים', 'letters'], ['48', 'syntax'], ['48 × ', 'syntax'],
  ['(2 + 3', 'syntax'], ['3/0 + 1', 'syntax'], ['▢ + ▢ = 4', 'syntax'], ['2 + ▢', 'syntax'], ['4 ++ 4', 'syntax'], ['5 = ?', 'syntax'], ['2.5 = ?', 'syntax']])
  ('rejects %s', (input, error) => expect(parseExercise(input)).toEqual({ ok: false, error }));
// owner decision 2026-11-22: an exercise with an operator and no box may end with "=", "= ?" or "= ▢"; that tail is dropped
it.each([
  ['48 × 6 =', '48 × 6', '288'], ['48 × 6 = ?', '48 × 6', '288'], ['48 × 6 = ▢', '48 × 6', '288'], ['48 × 6 = ___', '48 × 6', '288'],
  ['6 × (2 + 3) =', '6 × (2 + 3)', '30'], ['48×6=', '48 × 6', '288'],
])('accepts the trailing equals sign in %s', (input, text, answer) => {
  const x = ok(input); const a = exerciseAnswer(x);
  expect(x.form).toBe('plain');
  expect(exerciseText(x)).toBe(text); expect(a.d === 1 ? `${a.n}` : `${a.n}/${a.d}`).toBe(answer);
});
it.each([['48 =', 'syntax'], ['▢ × 7 = ▢', 'syntax'], ['2 + ▢ =', 'syntax'], ['48 × 6 = ▢ ▢', 'syntax'], ['48 × 6 = ? 5', 'syntax']])
  ('still rejects %s', (input, error) => expect(parseExercise(input)).toEqual({ ok: false, error }));
it('the missing and expand forms are unchanged by the trailing equals rule', () => {
  expect(ok('▢ × 7 = 56').form).toBe('missing'); expect(ok('120 − ▢ = 45').form).toBe('missing');
  expect(ok('2/3 = ▢/12').form).toBe('expand'); expect(ok('2 3/4 = ?').form).toBe('convert');
});
it('collapses a run of boxes into one', () => expect(normalize('48 × 6 = ___')).toBe('48 × 6 = ▢'));

it('evaluate throws on a negative result and on ÷ 0', () => {
  expect(() => exerciseAnswer(ok('3 − 5'))).toThrow(); expect(() => exerciseAnswer(ok('5 ÷ (2 − 2)'))).toThrow();
});
it('parses a mixed number conversion as a convert exercise', () => {
  const x = ok('2 3/4 = ?');
  expect(x.form === 'convert' && x.fraction.kind).toBe('mixed');
  expect(exerciseText(x)).toBe('2 3/4 = ?');
  expect(exerciseAnswer(x)).toEqual({ n: 11, d: 4 });
});
it('still computes large values that stay within exact integer range', () =>
  expect(exerciseAnswer(ok('99999 × 99999'))).toEqual({ n: 9999800001, d: 1 }));
it('refuses values beyond exact integer range instead of returning a wrong one', () => {
  const big = ok('99999999 × 99999999 + 1 − 99999999 × 99999999');
  expect(() => exerciseAnswer(big)).toThrow('too large');
});
it('cuts input at MAX_INPUT', () => expect(normalize('1'.repeat(60)).length).toBe(40));
