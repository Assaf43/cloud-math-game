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
  ['(2 + 3', 'syntax'], ['3/0 + 1', 'syntax'], ['▢ + ▢ = 4', 'syntax'], ['2 + ▢', 'syntax'], ['4 ++ 4', 'syntax']])
  ('rejects %s', (input, error) => expect(parseExercise(input)).toEqual({ ok: false, error }));
it('evaluate throws on a negative result and on ÷ 0', () => {
  expect(() => exerciseAnswer(ok('3 − 5'))).toThrow(); expect(() => exerciseAnswer(ok('5 ÷ (2 − 2)'))).toThrow();
});
it('cuts input at MAX_INPUT', () => expect(normalize('1'.repeat(60)).length).toBe(40));
