import { analyzeLines, packShapes, canSave, MIN_LINES, MAX_LINES, MAX_PACK_NAME, MAX_PACKS_PER_OWNER } from '../../src/prep/pack';

const EXAMPLES = ['48 × 6', '', 'abc', '1 × 1', '52 × 7'];

test('the limits are as agreed', () => {
  expect([MIN_LINES, MAX_LINES, MAX_PACK_NAME, MAX_PACKS_PER_OWNER]).toEqual([3, 5, 30, 20]);
});
test('analyzeLines skips blank lines and reports the reason for unsupported ones', () => {
  const lines = analyzeLines(EXAMPLES, 5);
  expect(lines).toHaveLength(4);
  expect(lines.map(l => l.input)).toEqual(['48 × 6', 'abc', '1 × 1', '52 × 7']);
  expect(lines[0].analysis.ok).toBe(true);
  expect(lines[1].analysis).toEqual({ ok: false, reason: 'letters' });
  expect(lines[2].analysis).toEqual({ ok: false, reason: 'cannot-vary' });
  expect(lines[3].analysis.ok).toBe(true);
});
test('analyzeLines trims the typed text and skips whitespace-only lines', () => {
  const lines = analyzeLines(['   ', '  48 × 6  '], 5);
  expect(lines.map(l => l.input)).toEqual(['48 × 6']);
});
test('packShapes gives one shape per key, first example wins, unsupported lines left out', () => {
  const shapes = packShapes({ examples: EXAMPLES, grade: 5 });
  expect(shapes).toHaveLength(1);
  expect(shapes[0].key).toBe('plain:i2×i1');
  expect(shapes[0].exampleText).toBe('48 × 6');
});
test('canSave needs a name, at least 3 lines and one supported line', () => {
  const lines = analyzeLines(['48 × 6', 'abc', '1 × 1'], 5);
  expect(lines).toHaveLength(3);
  expect(canSave('מבחן', lines)).toBe(true);
  expect(canSave('מבחן', lines.slice(0, 2))).toBe(false);
  const unsupported = analyzeLines(['abc', '1 × 1', 'xyz'], 5);
  expect(unsupported).toHaveLength(3);
  expect(canSave('מבחן', unsupported)).toBe(false);
  expect(canSave('   ', lines)).toBe(false);
});
