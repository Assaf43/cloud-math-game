import { PrepSession, BASE_PROBLEMS } from '../../src/prep/prepSession';
import type { PrepConfig } from '../../src/prep/prepSession';
import { packShapes } from '../../src/prep/pack';
import type { Pack } from '../../src/prep/pack';
import { CITIES } from '../../src/weather/cities';
import { createRng } from '../../src/rng';
import type { Difficulty } from '../../src/types';

const makePack = (examples: string[], shapes: Pack['shapes'] = {}): Pack => ({
  id: 'p1', owner: 'noa', name: 'מבחן בחשבון', grade: 5, examples, createdAt: '2026-11-19', shapes, lastStars: null,
});
const make = (examples: string[], seed: number, difficulty: Difficulty = 'beginner', shapes: Pack['shapes'] = {}) =>
  new PrepSession({ name: 'נועה', grade: 5, difficulty, pack: makePack(examples, shapes) }, createRng(seed), CITIES[0]);
const EXAMPLES = ['48 × 6', '6 × (2 + 3)', '3/4 + 1/8'];

type S = PrepSession;
const keyOf = (s: S) => (s.problem as unknown as { shapeKey: string }).shapeKey;
const answerRight = (s: S) => { s.choose(s.problem.answer.text, 0); s.advance(); };
const answerWrong = (s: S) => { s.choose(s.problem.choices.find(c => c.text !== s.problem.answer.text)!.text, 0); s.advance(); };

/** Plays to the end; `wrongAt` lists the 1-based positions (in shown order) answered wrong. */
function play(s: S, wrongAt: number[] = []): { texts: string[]; stubborn: boolean[]; keys: string[] } {
  const out = { texts: [] as string[], stubborn: [] as boolean[], keys: [] as string[] };
  let n = 0;
  while (s.phase === 'problem') {
    n++;
    out.texts.push(s.problem.text); out.stubborn.push(s.stubborn); out.keys.push(keyOf(s));
    if (wrongAt.includes(n)) answerWrong(s); else answerRight(s);
    if (n > 40) throw new Error('practice does not end');
  }
  return out;
}

test('all correct: 10 problems, 10 stars, no misses, finished', () => {
  const s = make(EXAMPLES, 1);
  const r = play(s);
  expect(r.texts).toHaveLength(BASE_PROBLEMS);
  expect(s.stars).toBe(10); expect(s.misses).toEqual([]); expect(s.phase).toBe('finished'); expect(s.asked).toBe(10);
  expect(Object.values(s.results).reduce((a, v) => a + v.seen, 0)).toBe(10);
  expect(Object.values(s.results).every(v => v.wrong === 0)).toBe(true);
});

test('wrong on problem 1 brings a stubborn twin as problem 4; right on it is worth 2 stars', () => {
  const s = make(EXAMPLES, 2);
  const r = play(s, [1]);
  expect(r.stubborn[3]).toBe(true);
  expect(r.keys[3]).toBe(r.keys[0]);
  expect(r.texts[3]).not.toBe(r.texts[0]);
  expect(r.stubborn.filter(Boolean)).toHaveLength(1);
  expect(s.asked).toBe(11);
  expect(s.stars).toBe(9 + 2);
  expect(s.misses).toHaveLength(1);
  expect(s.misses[0].problem.text).toBe(r.texts[0]);
  expect(s.results[r.keys[0]].wrong).toBe(1);
});

test('wrong on problem 10 adds an 11th stubborn problem; wrong on a twin queues nothing', () => {
  const s = make(EXAMPLES, 3);
  const r = play(s, [10, 11]);
  expect(r.texts).toHaveLength(11);
  expect(r.stubborn[10]).toBe(true);
  expect(s.asked).toBe(11);
  expect(s.misses).toHaveLength(2);
  expect(s.phase).toBe('finished');
});

test('status strings and intro title', () => {
  const s = make(EXAMPLES, 4);
  expect(s.status()).toEqual({ round: 'מבחן בחשבון', problem: 'תרגיל 1', score: '⭐ 0' });
  expect(s.introTitle).toBe('מבחן בחשבון');
  expect(s.timeLimitMs).toBeNull(); expect(s.celebrates).toBe(true); expect(s.playerName).toBe('נועה');
  expect(s.city).toBe(CITIES[0]); expect(s.stubborn).toBe(false);
  answerRight(s);
  expect(s.status()).toEqual({ round: 'מבחן בחשבון', problem: 'תרגיל 2', score: '⭐ 1' });
});

test('no text appears twice in one practice (200 seeds, advanced)', () => {
  for (let seed = 0; seed < 200; seed++) {
    const r = play(make(EXAMPLES, seed, 'advanced'), [1, 3, 6]);
    expect(new Set(r.texts).size).toBe(r.texts.length);
  }
});

test('a pack whose only example is 4 × 4 still completes a beginner practice with no consecutive repeat', () => {
  for (let seed = 0; seed < 50; seed++) {
    const s = make(['4 × 4'], seed);
    const r = play(s, [2]);
    expect(s.phase).toBe('finished');
    expect(r.texts.length).toBeGreaterThanOrEqual(BASE_PROBLEMS);
    for (let i = 1; i < r.texts.length; i++) expect(r.texts[i]).not.toBe(r.texts[i - 1]);
  }
});

test('a shape missed last time is drawn about twice as often (3 shapes, 300 seeds)', () => {
  const keys = packShapes(makePack(EXAMPLES)).map(sh => sh.key);
  const shapes = { [keys[0]]: { seen: 4, wrong: 2, lastMissed: true } };
  let hit = 0, all = 0;
  for (let seed = 0; seed < 300; seed++) {
    const s = make(EXAMPLES, seed, 'beginner', shapes);
    for (let n = 0; n < BASE_PROBLEMS; n++) {
      all++;
      if (keyOf(s) === keys[0]) hit++;
      answerRight(s);
    }
  }
  expect(hit / all).toBeGreaterThan(0.45); expect(hit / all).toBeLessThan(0.55);
});

describe('reviewItems', () => {
  test('groups by shape, largest group first, one item per group', () => {
    const s = make(['48 × 6', '345 + 27'], 6);
    const internal = s as unknown as { _misses: { problem: { shapeKey: string; text: string }; picked: string }[] };
    const mk = (k: string, t: string) => ({ problem: { shapeKey: k, text: t }, picked: 'x' });
    internal._misses.push(mk('a', '1'), mk('b', '2'), mk('b', '3'), mk('a', '4'), mk('b', '5'));
    expect(s.reviewItems().map(i => i.problem.text)).toEqual(['2', '1']);
  });
  test('4 real misses over 2 shapes give 2 items', () => {
    const s = make(['48 × 6', '345 + 27'], 6);
    const wrongPerKey: Record<string, number> = {};
    while (s.phase === 'problem') {
      const k = keyOf(s);
      const total = Object.values(wrongPerKey).reduce((a, b) => a + b, 0);
      if (total < 4 && (wrongPerKey[k] ?? 0) < 3) { wrongPerKey[k] = (wrongPerKey[k] ?? 0) + 1; answerWrong(s); } else answerRight(s);
    }
    expect(s.misses.length).toBeGreaterThanOrEqual(4);
    const items = s.reviewItems();
    expect(items).toHaveLength(Object.keys(wrongPerKey).length);
    expect(new Set(items.map(i => i.problem.shapeKey)).size).toBe(items.length);
  });
  test('5 distinct missed shapes give 3 items', () => {
    const s = make(['48 × 6', '345 + 27', '83 − 35', '126 ÷ 3', '6 × (2 + 3)'], 7);
    const seen = new Set<string>();
    while (s.phase === 'problem') {
      const k = keyOf(s);
      if (!seen.has(k)) { seen.add(k); answerWrong(s); } else answerRight(s);
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
    expect(s.reviewItems()).toHaveLength(3);
  });
});

test('makeTwin gives a new text of the same shape, not stubborn', () => {
  const s = make(EXAMPLES, 8);
  const shown = s.problem.text, key = keyOf(s);
  answerWrong(s);
  const twin = s.makeTwin(s.misses[0]);
  expect(twin.shapeKey).toBe(key); expect(twin.text).not.toBe(shown); expect(twin.stubborn).toBe(false);
});

test('invalid text keeps the attempt; timeout throws; guards; unsupported pack throws', () => {
  const s = make(EXAMPLES, 9);
  expect(s.choose('nonsense', 0)).toBe('invalid'); expect(s.phase).toBe('problem');
  expect(() => s.timeout()).toThrow();
  expect(() => s.advance()).toThrow();
  s.choose(s.problem.answer.text, 0);
  expect(() => s.choose('x', 0)).toThrow();
  expect(() => make(['abc', 'x y', '??'], 1)).toThrow();
});

test.each(['beginner', 'advanced', 'expert'] as const)('%s: a shape that is hard to hit (1.25 × 8) never starts finished and always reaches 10 problems (300 seeds)', d => {
  expect(packShapes(makePack(['1.25 × 8']))).toHaveLength(1);
  for (let seed = 0; seed < 300; seed++) {
    const s = make(['1.25 × 8'], seed, d);
    expect(s.phase, `${d} seed ${seed}`).toBe('problem');
    expect(play(s).texts, `${d} seed ${seed}`).toHaveLength(BASE_PROBLEMS);
  }
}, 60000);

test('a pack that cannot produce a first problem makes the constructor throw', () => {
  // with an rng stuck at 0 every beginner 48 × 6 draw is 24 × 3, which the child typed as well
  const pack = makePack(['48 × 6', '24 × 3']);
  expect(packShapes(pack)).toHaveLength(1);
  expect(() => new PrepSession({ name: 'נועה', grade: 5, difficulty: 'beginner', pack }, () => 0, CITIES[0])).toThrow();
});

test('the problem number is the one on screen: unchanged during the reveal, last one equals the practice length', () => {
  const s = make(EXAMPLES, 3);
  const num = () => s.status().problem;
  expect(num()).toBe('תרגיל 1');
  let n = 0;
  for (;;) {
    n++;
    const before = num();
    expect(before).toBe(`תרגיל ${n}`);
    s.choose(n === 10 ? s.problem.choices.find(c => c.text !== s.problem.answer.text)!.text : s.problem.answer.text, 0);
    expect(num()).toBe(before);                                       // during the reveal
    s.advance();
    if (s.phase === 'finished') break;
    expect(num()).not.toBe(before);
  }
  expect(n).toBe(11);
  expect(num()).toBe('תרגיל 11');
});

test('typed examples never come back, not only the first of each kind (500 seeds, advanced)', () => {
  const typed = ['48 × 6', '52 × 7', '63 × 4'];
  for (let seed = 0; seed < 500; seed++) {
    const s = make(typed, seed, 'advanced');
    const r = play(s, [1, 4]);
    for (const t of r.texts) expect(typed, `seed ${seed}`).not.toContain(t);
    for (const m of s.misses) expect(typed).not.toContain(s.makeTwin(m).text);
  }
});

test('config is exposed', () => {
  const cfg: PrepConfig = { name: 'נועה', grade: 5, difficulty: 'beginner', pack: makePack(EXAMPLES) };
  expect(new PrepSession(cfg, createRng(1), CITIES[0]).config).toBe(cfg);
});
