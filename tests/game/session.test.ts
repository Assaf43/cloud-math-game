import { CITY_BONUS } from '../../src/game/scoring';
import { Session } from '../../src/game/session';
import { CITIES } from '../../src/weather/cities';
import { createRng } from '../../src/rng';
import type { GameConfig } from '../../src/types';

const cfg: GameConfig = { name: 'נועה', age: 10, grade: 5, difficulty: 'beginner', secondsPerProblem: 30, rounds: 2 };

test('round has 7 to 10 problems and city options include the city', () => {
  for (let seed = 0; seed < 100; seed++) {
    const s = new Session(cfg, createRng(seed), CITIES);
    expect(s.problemsInRound).toBeGreaterThanOrEqual(7); expect(s.problemsInRound).toBeLessThanOrEqual(10);
    expect(s.cityOptions).toHaveLength(4); expect(s.cityOptions).toContain(s.city);
    expect(new Set(s.cityOptions.map(c => c.id)).size).toBe(4);
  }
});
test('cities never repeat within a game', () => {
  for (let seed = 0; seed < 50; seed++) {
    const s = new Session({ ...cfg, rounds: 5 }, createRng(seed), CITIES);
    const seen: string[] = [];
    for (let r = 0; r < 5; r++) {
      seen.push(s.city.id);
      for (let i = s.problemsInRound; i > 0; i--) { s.timeout(); s.advance(); }
      s.advance(); s.answerCity(s.city.id); s.advance();
    }
    expect(new Set(seen).size).toBe(5);
    expect(s.phase).toBe('finished');
  }
});
test('correct answer scores and moves to reveal', () => {
  const s = new Session(cfg, createRng(1), CITIES);
  expect(s.choose(s.problem.answer.text, 15000)).toBe('correct');
  expect(s.phase).toBe('reveal'); expect(s.totalScore).toBe(150); expect(s.lastResult).toBe('correct');
});
test('tapping a wrong on-screen choice uses the attempt and scores 0', () => {
  const s = new Session(cfg, createRng(1), CITIES);
  const wrong = s.problem.choices.find(c => c.text !== s.problem.answer.text)!;
  expect(s.choose(wrong.text, 1000)).toBe('wrong'); expect(s.phase).toBe('reveal'); expect(s.totalScore).toBe(0);
  expect(s.lastResult).toBe('wrong');
});
test('tapping something that is not an answer on screen is invalid and keeps the attempt', () => {
  const s = new Session(cfg, createRng(1), CITIES);
  expect(s.choose('999999', 1000)).toBe('invalid'); expect(s.choose('', 1000)).toBe('invalid');
  expect(s.phase).toBe('problem'); expect(s.lastResult).toBeNull(); expect(s.totalScore).toBe(0);
});
test('every on-screen choice can be tapped; only the right one scores', () => {
  for (let seed = 0; seed < 30; seed++) {
    const probe = new Session(cfg, createRng(seed), CITIES);
    for (const c of probe.problem.choices) {
      const s = new Session(cfg, createRng(seed), CITIES);
      const right = c.text === s.problem.answer.text;
      expect(s.choose(c.text, 3000)).toBe(right ? 'correct' : 'wrong');
      expect(s.totalScore).toBe(right ? 190 : 0);
    }
  }
});
test('full game walk-through reaches finished with correct totals', () => {
  const s = new Session(cfg, createRng(7), CITIES);
  for (let r = 0; r < 2; r++) {
    const n = s.problemsInRound;
    for (let i = 0; i < n; i++) { i === 0 ? s.timeout() : s.choose(s.problem.answer.text, 0); s.advance(); }
    expect(s.phase).toBe('roundSummary');
    expect(s.rounds[r]).toMatchObject({ correct: n - 1, total: n, points: (n - 1) * 200, cityCorrect: null });
    expect(s.rounds[r].avgAnswerMs).toBe(Math.round(30000 / n));
    s.advance(); expect(s.phase).toBe('cityBonus');
    expect(s.answerCity(s.city.id)).toBe(true); s.advance();
  }
  expect(s.phase).toBe('finished');
  const mathPoints = s.rounds.reduce((a, r) => a + r.points, 0);
  expect(s.totalScore).toBe(mathPoints + 2 * CITY_BONUS);
  expect(s.rounds.every(r => r.cityCorrect === true)).toBe(true);
  const problems = s.rounds.reduce((a, r) => a + r.total, 0);
  expect(s.avgPointsPerProblem).toBe(Math.round(mathPoints / problems));
});
test('a wrong city gives no bonus and the correct one cannot be answered twice', () => {
  const s = new Session(cfg, createRng(3), CITIES);
  for (let i = s.problemsInRound; i > 0; i--) { s.timeout(); s.advance(); }
  s.advance();
  const wrong = s.cityOptions.find(c => c.id !== s.city.id)!;
  expect(s.answerCity(wrong.id)).toBe(false);
  expect(s.totalScore).toBe(0); expect(s.rounds[0].cityCorrect).toBe(false);
  expect(() => s.answerCity(s.city.id)).toThrow();
});
test('illegal calls throw', () => {
  const s = new Session(cfg, createRng(1), CITIES);
  expect(() => s.advance()).toThrow(); expect(() => s.answerCity('haifa')).toThrow();
  s.timeout();
  expect(() => s.timeout()).toThrow(); expect(() => s.choose('1', 0)).toThrow();
});
test('advance from the city bonus needs an answer first', () => {
  const s = new Session(cfg, createRng(1), CITIES);
  for (let i = s.problemsInRound; i > 0; i--) { s.timeout(); s.advance(); }
  s.advance();
  expect(() => s.advance()).toThrow();
});

test('Session satisfies the GameFlow getters', () => {
  const s = new Session({ ...cfg, rounds: 3 }, createRng(1), CITIES);
  expect(s.playerName).toBe('נועה'); expect(s.timeLimitMs).toBe(30000);
  expect(s.introTitle).toBe('סבב 1'); expect(s.celebrates).toBe(false); expect(s.stubborn).toBe(false);
  expect(s.status()).toEqual({ round: 'סבב 1 מתוך 3', problem: `תרגיל 1 מתוך ${s.problemsInRound}`, score: 'ניקוד: 0' });
});
