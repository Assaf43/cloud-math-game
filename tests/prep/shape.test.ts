import { describe, expect, it } from 'vitest';
import { analyze, formatAnswer, REJECT_TEXT } from '../../src/prep/shape';
import { shape } from './helpers';

describe('analyze: shapes', () => {
  it.each([
    ['48 × 6', 'plain:i2×i1', 'כפל דו-ספרתי בחד-ספרתי', 'int'], ['345 + 27', 'plain:i3+i2', 'חיבור תלת-ספרתי ודו-ספרתי', 'int'],
    ['6 × (2 + 3)', 'plain:i1×(i1+i1)', 'סדר פעולות עם סוגריים', 'int'], ['2 + 3 × 4', 'plain:i1+i1×i1', 'סדר פעולות', 'int'],
    ['3/4 + 1/8', 'plain:f+f', 'חיבור שברים', 'fraction'], ['1 3/4 − 1/2', 'plain:m−f', 'חיסור מספרים מעורבים', 'fraction'],
    ['3.45 + 2.7', 'plain:d2+d1', 'חיבור עשרוניים', 'decimal'], ['▢ × 7 = 56', 'missing:▢×i', 'מספר חסר בכפל', 'int'],
    ['2/3 = ▢/12', 'expand:num', 'הרחבת שברים', 'int'], ['6/8 = 3/▢', 'expand:den', 'צמצום שברים', 'int'], ['3/4 = ?', 'convert', 'שבר למספר עשרוני', 'decimal'],
    ['120 − ▢ = 45', 'missing:i−▢', 'מספר חסר בחיסור', 'int'], ['12345 ÷ 5', 'plain:i5÷i1', 'חילוק רב-ספרתי בחד-ספרתי', 'int'],
    ['2 3/4 = ?', 'convert', 'שבר למספר עשרוני', 'decimal'], ['7/50 = ?', 'convert', 'שבר למספר עשרוני', 'decimal'],
    ['0.01 + 0.5', 'plain:d2+d1', 'חיבור עשרוניים', 'decimal'], ['5/9 = ▢/54', 'expand:num', 'הרחבת שברים', 'int'],
  ])('%s', (input, key, label, kind) => expect(shape(input)).toMatchObject({ key, label, answerKind: kind }));

  it('same shape for different numbers', () => expect(shape('52 × 7').key).toBe(shape('48 × 6').key));
  it('exampleText is the canonical text', () => expect(shape('48×6').exampleText).toBe('48 × 6'));
});

describe('analyze: rejections', () => {
  it.each([['3 − 5', 'negative'], ['5 ÷ (2 − 2)', 'div-zero'], ['1.234 + 1', 'too-precise'], ['1/3 + 0.5', 'mixed-kinds'],
    ['99999 × 99999', 'too-long'], ['1/7 + 1/11', 'too-long'], ['1+1+1+1+1+1', 'too-many-ops'], ['2 + ▢', 'hole'], ['abc', 'letters'],
    ['', 'empty'], ['2 +', 'syntax'], ['1/3 = ?', 'too-precise'], ['1/2 ÷ 7/50', 'too-long'], ['1/3 + 2/3 + 1/11', 'too-long'],
    ['▢ × 7 = 50', 'not-whole'],
  ])('rejects %s as %s', (input, reason) => expect(analyze(input)).toEqual({ ok: false, reason }));

  it.each(['0 ÷ ▢ = 15', '▢ ÷ 0 = 5'])('rejects %s as div-zero: the division would be by zero', input =>
    expect(analyze(input)).toEqual({ ok: false, reason: 'div-zero' }));
  it('a missing divisor or dividend that is not zero still works', () => {
    expect(analyze('72 ÷ ▢ = 9')).toMatchObject({ ok: true, shape: { answerKind: 'int' } });
    expect(analyze('▢ ÷ 4 = 7')).toMatchObject({ ok: true, shape: { answerKind: 'int' } });
  });

  // owner decision 2026-11-22: a whole-number exercise whose result (or missing number) is not whole is refused
  it.each(['17 ÷ 5', '7 ÷ 2', '(1 + 2) ÷ 2', '▢ × 7 = 50', '2/3 = ▢/10'])('rejects %s as not-whole', input =>
    expect(analyze(input)).toEqual({ ok: false, reason: 'not-whole' }));
  it.each(['12 ÷ 4', '▢ × 7 = 56', '2/3 = ▢/12', '1/2 + 1/4', '7.5 ÷ 2.5', '0.6 × 3', '3/4 = ?'])('%s is still supported', input =>
    expect(analyze(input).ok).toBe(true));
  it('the not-whole copy is exact', () => expect(REJECT_TEXT['not-whole']).toBe('התוצאה לא יוצאת מספר שלם, ואת זה עוד אי אפשר לתרגל.'));

  it('every reason has copy', () => {
    for (const [k, v] of Object.entries(REJECT_TEXT)) if (k !== 'empty') expect(v.length).toBeGreaterThan(5);
    expect(Object.keys(REJECT_TEXT)).toHaveLength(12);
  });
});

describe('formatAnswer', () => {
  it('int only for a whole value', () => {
    expect(formatAnswer('int', { n: 6, d: 1 })).toMatchObject({ kind: 'int', text: '6' });
    expect(formatAnswer('int', { n: 3, d: 2 })).toBeNull();
  });
  it('fraction only for a non-whole value with denominator up to 24', () => {
    expect(formatAnswer('fraction', { n: 3, d: 2 })).toMatchObject({ kind: 'fraction', text: '1 1/2' });
    expect(formatAnswer('fraction', { n: 4, d: 1 })).toBeNull();
    expect(formatAnswer('fraction', { n: 1, d: 25 })).toBeNull();
    expect(formatAnswer('fraction', { n: 1, d: 24 })).not.toBeNull();
  });
  it('decimal up to 2 places, whole allowed', () => {
    expect(formatAnswer('decimal', { n: 3, d: 4 })).toMatchObject({ kind: 'decimal', text: '0.75' });
    expect(formatAnswer('decimal', { n: 4, d: 1 })).toMatchObject({ kind: 'decimal', text: '4' });
    expect(formatAnswer('decimal', { n: 1, d: 3 })).toBeNull();
    expect(formatAnswer('decimal', { n: 1, d: 8 })).toBeNull();
  });
  it('null when the text is longer than 8 characters', () => {
    expect(formatAnswer('int', { n: 123456789, d: 1 })).toBeNull();
    expect(formatAnswer('int', { n: 12345678, d: 1 })).not.toBeNull();
    expect(formatAnswer('decimal', { n: 2469135, d: 2 })).toBeNull();
  });
});
