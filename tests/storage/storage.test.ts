import { Storage, type ScoreEntry } from '../../src/storage/storage';

const KEY = 'cloud-math:v1';
function memory(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; } };
}
const score = (over: Partial<ScoreEntry> = {}): ScoreEntry => ({
  name: 'נועה', grade: 5, difficulty: 'beginner', total: 1000, avg: 150, problems: 8, date: '2026-11-16T10:00:00.000Z', ...over,
});

test('profile and score round trip, across instances', () => {
  const m = memory();
  const a = new Storage(m);
  a.saveProfile({ name: 'נועה', age: 10, grade: 5 });
  a.addScore(score());
  const b = new Storage(m);
  expect(b.profiles()).toEqual([{ name: 'נועה', age: 10, grade: 5 }]);
  expect(b.topScores()).toEqual([score()]);
});
test('saveProfile upserts by name, trims and limits the name to 20 chars', () => {
  const s = new Storage(memory());
  s.saveProfile({ name: '  דן  ', age: 9, grade: 4 });
  s.saveProfile({ name: 'דן', age: 10, grade: 5 });
  expect(s.profiles()).toEqual([{ name: 'דן', age: 10, grade: 5 }]);
  s.saveProfile({ name: 'x'.repeat(30), age: 8, grade: 3 });
  expect(s.profiles()[1].name).toHaveLength(20);
  s.saveProfile({ name: '   ', age: 8, grade: 3 });
  expect(s.profiles()).toHaveLength(2);
});
test('topScores returns at most 10 ordered by avg, then total, then newest', () => {
  const s = new Storage(memory());
  for (let i = 0; i < 12; i++) s.addScore(score({ name: `p${i}`, avg: 100 + i }));
  s.addScore(score({ name: 'tieLowTotal', avg: 111, total: 10 }));
  s.addScore(score({ name: 'tieOld', avg: 111, total: 900, date: '2026-01-01T00:00:00.000Z' }));
  s.addScore(score({ name: 'tieNew', avg: 111, total: 900, date: '2026-06-01T00:00:00.000Z' }));
  const top = s.topScores();
  expect(top).toHaveLength(10);
  expect(top.map(t => t.avg)).toEqual([...top.map(t => t.avg)].sort((a, b) => b - a));
  const tied = top.filter(t => t.avg === 111).map(t => t.name);
  expect(tied.slice(0, 4)).toContain('p11');
  expect(tied.indexOf('tieNew')).toBeLessThan(tied.indexOf('tieOld'));
  expect(tied.indexOf('tieOld')).toBeLessThan(tied.indexOf('tieLowTotal'));
});
test('personalBest is per name + grade + difficulty', () => {
  const s = new Storage(memory());
  s.addScore(score({ avg: 120 })); s.addScore(score({ avg: 160 }));
  s.addScore(score({ difficulty: 'expert', avg: 300 })); s.addScore(score({ name: 'דן', avg: 400 }));
  expect(s.personalBest('נועה', 5, 'beginner')!.avg).toBe(160);
  expect(s.personalBest('נועה', 5, 'expert')!.avg).toBe(300);
  expect(s.personalBest('נועה', 4, 'beginner')).toBeNull();
});
test('addScore reports isPersonalBest', () => {
  const s = new Storage(memory());
  expect(s.addScore(score({ avg: 100 })).isPersonalBest).toBe(true);
  expect(s.addScore(score({ avg: 90 })).isPersonalBest).toBe(false);
  expect(s.addScore(score({ avg: 100 })).isPersonalBest).toBe(false);
  expect(s.addScore(score({ avg: 101 })).isPersonalBest).toBe(true);
  expect(s.addScore(score({ avg: 5, difficulty: 'expert' })).isPersonalBest).toBe(true);
});
test('keeps at most 200 scores and drops the lowest avg', () => {
  const m = memory(); const s = new Storage(m);
  for (let i = 0; i < 205; i++) s.addScore(score({ name: `p${i}`, avg: i }));
  const stored = JSON.parse(m.data[KEY]).scores as ScoreEntry[];
  expect(stored).toHaveLength(200);
  expect(Math.min(...stored.map(x => x.avg))).toBe(5);
});
test('mute flag persists', () => {
  const m = memory();
  expect(new Storage(m).muted()).toBe(false);
  new Storage(m).setMuted(true);
  expect(new Storage(m).muted()).toBe(true);
});
test('corrupt JSON is treated as empty and does not throw', () => {
  for (const bad of ['{not json', 'null', '[]', '{"profiles":5,"scores":"x","muted":"yes"}', '{"profiles":[1,null],"scores":[{}]}']) {
    const s = new Storage(memory({ [KEY]: bad }));
    expect(s.profiles()).toEqual([]); expect(s.topScores()).toEqual([]); expect(s.muted()).toBe(false);
    expect(() => s.saveProfile({ name: 'a', age: 8, grade: 3 })).not.toThrow();
    expect(s.profiles()).toHaveLength(1);
  }
});
test('null backend: reads are empty and writes are no-ops', () => {
  const s = new Storage(null);
  s.saveProfile({ name: 'a', age: 8, grade: 3 }); s.setMuted(true);
  expect(() => s.addScore(score())).not.toThrow();
  expect(s.addScore(score()).isPersonalBest).toBe(false);
  expect(s.profiles()).toEqual([]); expect(s.topScores()).toEqual([]); expect(s.muted()).toBe(false);
  expect(s.personalBest('נועה', 5, 'beginner')).toBeNull();
});
test('a backend whose setItem throws (quota) does not throw', () => {
  const s = new Storage({ getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } });
  expect(() => { s.saveProfile({ name: 'a', age: 8, grade: 3 }); s.addScore(score()); s.setMuted(true); }).not.toThrow();
});
test('a backend whose getItem throws does not throw', () => {
  const s = new Storage({ getItem: () => { throw new Error('denied'); }, setItem: () => {} });
  expect(s.profiles()).toEqual([]);
});
test('default backend is window.localStorage when available', () => {
  localStorage.clear();
  new Storage().setMuted(true);
  expect(JSON.parse(localStorage.getItem(KEY)!).muted).toBe(true);
  localStorage.clear();
});
