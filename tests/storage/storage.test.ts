import { Storage, type ScoreEntry } from '../../src/storage/storage';
import type { Pack } from '../../src/prep/pack';

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
test('a score that could not be saved is not reported as a personal best', () => {
  const s = new Storage({ getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } });
  expect(s.addScore(score()).isPersonalBest).toBe(false);
});

// ---- packs ----
const pack = (over: Partial<Pack> = {}): Pack => ({
  id: 'p1', owner: 'דנה', name: 'מבחן כפל', grade: 5, examples: ['48 × 6', '52 × 7', '3 + 4'],
  createdAt: '2026-11-19T10:00:00.000Z', shapes: {}, lastStars: null, ...over,
});

test('a saved pack is returned for its owner; saving the same id replaces it', () => {
  const s = new Storage(memory());
  expect(s.savePack(pack())).toBe(true);
  expect(s.packs('דנה')).toEqual([pack()]);
  expect(s.savePack(pack({ name: 'חדש' }))).toBe(true);
  expect(s.packs('דנה')).toEqual([pack({ name: 'חדש' })]);
});
test('packs belong to their owner and come back newest first', () => {
  const s = new Storage(memory());
  s.savePack(pack({ id: 'a', createdAt: '2026-11-01T00:00:00.000Z' }));
  s.savePack(pack({ id: 'b', createdAt: '2026-11-03T00:00:00.000Z' }));
  s.savePack(pack({ id: 'c', createdAt: '2026-11-02T00:00:00.000Z' }));
  s.savePack(pack({ id: 'd', owner: 'נועה' }));
  expect(s.packs('דנה').map(p => p.id)).toEqual(['b', 'c', 'a']);
  expect(s.packs('נועה').map(p => p.id)).toEqual(['d']);
  expect(s.packs('  דנה ').map(p => p.id)).toEqual(['b', 'c', 'a']);
});
test('equal timestamps: the later-saved pack comes first', () => {
  const s = new Storage(memory());
  s.savePack(pack({ id: 'a' })); s.savePack(pack({ id: 'b' }));
  expect(s.packs('דנה').map(p => p.id)).toEqual(['b', 'a']);
});
test('deletePack removes the pack; an unknown id does nothing', () => {
  const s = new Storage(memory());
  s.savePack(pack({ id: 'a' })); s.savePack(pack({ id: 'b' }));
  s.deletePack('a');
  expect(s.packs('דנה').map(p => p.id)).toEqual(['b']);
  expect(() => s.deletePack('nope')).not.toThrow();
  expect(s.packs('דנה')).toHaveLength(1);
});
test('a 21st pack for one owner is refused, replacing an existing one is not', () => {
  const s = new Storage(memory());
  for (let i = 0; i < 20; i++) expect(s.savePack(pack({ id: `p${i}` }))).toBe(true);
  expect(s.savePack(pack({ id: 'extra' }))).toBe(false);
  expect(s.packs('דנה')).toHaveLength(20);
  expect(s.savePack(pack({ id: 'p3', name: 'עודכן' }))).toBe(true);
  expect(s.savePack(pack({ id: 'other', owner: 'נועה' }))).toBe(true);
});
test('recordPractice adds up per shape, sets lastMissed and lastStars', () => {
  const s = new Storage(memory());
  s.savePack(pack());
  s.recordPractice('p1', { k: { seen: 3, wrong: 1 } }, 9);
  s.recordPractice('p1', { k: { seen: 3, wrong: 1 } }, 9);
  const p = s.packs('דנה')[0];
  expect(p.shapes.k).toEqual({ seen: 6, wrong: 2, lastMissed: true });
  expect(p.lastStars).toBe(9);
  s.recordPractice('p1', { k: { seen: 2, wrong: 0 } }, 12);
  expect(s.packs('דנה')[0].shapes.k).toEqual({ seen: 8, wrong: 2, lastMissed: false });
  expect(s.packs('דנה')[0].lastStars).toBe(12);
});
test('recordPractice with an unknown id does nothing', () => {
  const m = memory(); const s = new Storage(m);
  s.savePack(pack());
  const before = m.data[KEY];
  s.recordPractice('nope', { k: { seen: 1, wrong: 0 } }, 3);
  expect(m.data[KEY]).toBe(before);
});
test('data written without packs still yields its profiles and scores; a packs write keeps them', () => {
  const old = JSON.stringify({ profiles: [{ name: 'נועה', age: 10, grade: 5 }], scores: [score()], muted: true });
  const m = memory({ [KEY]: old }); const s = new Storage(m);
  expect(s.profiles()).toEqual([{ name: 'נועה', age: 10, grade: 5 }]);
  expect(s.topScores()).toEqual([score()]);
  expect(s.packs('דנה')).toEqual([]);
  expect(s.savePack(pack())).toBe(true);
  const t = new Storage(m);
  expect(t.profiles()).toHaveLength(1); expect(t.topScores()).toEqual([score()]); expect(t.muted()).toBe(true);
  t.addScore(score({ avg: 1 })); t.setMuted(false); t.saveProfile({ name: 'x', age: 8, grade: 3 });
  expect(t.packs('דנה')).toEqual([pack()]);
});
test('malformed pack entries are dropped, the valid one is kept', () => {
  const bad = [
    { ...pack({ id: 'g' }), grade: 7 }, { ...pack({ id: 'e' }), examples: [1] }, { ...pack({ id: 's' }), shapes: { k: { seen: 1 } } },
    { ...pack({ id: 'l' }), lastStars: 'x' }, { ...pack({ id: 'a' }), shapes: [] },
  ];
  const m = memory({ [KEY]: JSON.stringify({ profiles: [], scores: [], muted: false, packs: [{}, 5, null, ...bad, pack()] }) });
  expect(new Storage(m).packs('דנה')).toEqual([pack()]);
  expect(new Storage(memory({ [KEY]: '{"packs":"x"}' })).packs('דנה')).toEqual([]);
});
test('savePack returns false without throwing when nothing can be written', () => {
  const throwing = new Storage({ getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } });
  expect(throwing.savePack(pack())).toBe(false);
  expect(new Storage(null).savePack(pack())).toBe(false);
});
test('savePack cuts the name to 30 and keeps at most 5 trimmed examples, each at most 40 chars', () => {
  const s = new Storage(memory());
  s.savePack(pack({ name: `  ${'ב'.repeat(40)}  `, examples: ['1 + 1', '', '  2 + 2 ', '3 + 3', '4 + 4', '5 + 5', '6 + 6'] }));
  const p = s.packs('דנה')[0];
  expect(p.name).toBe('ב'.repeat(30));
  expect(p.examples).toEqual(['1 + 1', '2 + 2', '3 + 3', '4 + 4', '5 + 5']);
  s.savePack(pack({ id: 'long', examples: ['9'.repeat(60)] }));
  expect(s.packs('דנה').find(x => x.id === 'long')!.examples[0]).toHaveLength(40);
});
test('the pack owner is cleaned like a profile name', () => {
  const s = new Storage(memory());
  s.savePack(pack({ owner: `  ${'x'.repeat(30)}` }));
  expect(s.packs('x'.repeat(20))).toHaveLength(1);
});
