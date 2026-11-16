import { renderFinal } from '../../src/ui/finalScreen';
import { Session } from '../../src/game/session';
import { Storage } from '../../src/storage/storage';
import { CITIES } from '../../src/weather/cities';
import { createRng } from '../../src/rng';
import type { GameConfig } from '../../src/types';

const cfg: GameConfig = { name: 'נועה', age: 10, grade: 5, difficulty: 'beginner', secondsPerProblem: 30, rounds: 2 };
function memory() {
  const data: Record<string, string> = {};
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; } };
}
function finished(config: GameConfig = cfg, seed = 6) {
  const s = new Session(config, createRng(seed), CITIES);
  for (let r = 0; r < config.rounds; r++) {
    const n = s.problemsInRound;
    for (let i = 0; i < n; i++) { i === 0 ? s.timeout() : s.choose(s.problem.answer.text, 3000); s.advance(); }
    s.advance(); s.answerCity(s.city.id); s.advance();
  }
  return s;
}
let root: HTMLElement;
beforeEach(() => { root = document.createElement('div'); document.body.append(root); });
afterEach(() => { document.body.innerHTML = ''; });

test('shows total, average per problem and a row per round', () => {
  const s = finished(); const storage = new Storage(memory());
  renderFinal(root, s, storage, () => {});
  const text = root.textContent!;
  expect(text).toContain(String(s.totalScore)); expect(text).toContain(String(s.avgPointsPerProblem));
  expect(root.querySelectorAll('.rounds-table tbody tr')).toHaveLength(2);
  expect(text).toContain('Weather data by Open-Meteo.com');
  const link = root.querySelector<HTMLAnchorElement>('a[href="https://open-meteo.com/"]')!;
  expect(link.textContent).toBe('Weather data by Open-Meteo.com'); expect(link.rel).toContain('noopener');
});

test('addScore is called exactly once per game, even when rendered twice', () => {
  const s = finished(); const storage = new Storage(memory());
  const spy = vi.spyOn(storage, 'addScore');
  renderFinal(root, s, storage, () => {}); renderFinal(root, s, storage, () => {});
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy.mock.calls[0][0]).toMatchObject({ name: 'נועה', grade: 5, difficulty: 'beginner', total: s.totalScore, avg: s.avgPointsPerProblem });
  expect(storage.topScores()).toHaveLength(1);
  expect(root.textContent).toContain('שיא אישי חדש!');           // still shown on the second render
});

test('personal-best banner appears only when reported', () => {
  const storage = new Storage(memory());
  renderFinal(root, finished(cfg, 6), storage, () => {});
  expect(root.textContent).toContain('שיא אישי חדש!');
  storage.addScore({ name: 'נועה', grade: 5, difficulty: 'beginner', total: 99999, avg: 9999, problems: 8, date: '2020-01-01T00:00:00.000Z' });
  renderFinal(root, finished(cfg, 7), storage, () => {});
  expect(root.textContent).not.toContain('שיא אישי חדש!');
});

test('leaderboard has at most 10 rows and marks the current game', () => {
  const storage = new Storage(memory());
  for (let i = 0; i < 15; i++) storage.addScore({ name: `p${i}`, grade: 4, difficulty: 'advanced', total: 100, avg: 10 + i, problems: 8, date: '2026-01-01T00:00:00.000Z' });
  const s = finished();
  renderFinal(root, s, storage, () => {});
  const rows = root.querySelectorAll('.leaderboard tbody tr');
  expect(rows.length).toBeLessThanOrEqual(10);
  const mine = root.querySelectorAll('.leaderboard tr.is-current');
  expect(mine.length).toBeLessThanOrEqual(1);
  if (s.avgPointsPerProblem > 10) { expect(mine).toHaveLength(1); expect(mine[0].textContent).toContain('נועה'); }
});

test('the current game is marked when it makes the top 10', () => {
  const storage = new Storage(memory());
  const s = finished();
  renderFinal(root, s, storage, () => {});
  const mine = root.querySelectorAll('.leaderboard tr.is-current');
  expect(mine).toHaveLength(1);
});

test('player names render as text', () => {
  const storage = new Storage(memory());
  const s = finished({ ...cfg, name: '<img src=x onerror=alert(1)>' });
  renderFinal(root, s, storage, () => {});
  expect(root.querySelector('img')).toBeNull();
  expect(root.querySelector('.leaderboard')!.textContent).toContain('<img src=x');
});

test('with an unavailable storage the screen renders, with an empty leaderboard and no personal best', () => {
  const s = finished();
  expect(() => renderFinal(root, s, new Storage(null), () => {})).not.toThrow();
  expect(root.querySelectorAll('.leaderboard tbody tr')).toHaveLength(0);
  expect(root.textContent).not.toContain('שיא אישי חדש!');
  expect(root.textContent).toContain(String(s.totalScore));
});

test('play again button calls back', () => {
  const onPlayAgain = vi.fn();
  renderFinal(root, finished(), new Storage(memory()), onPlayAgain);
  [...root.querySelectorAll('button')].find(b => b.textContent === 'שחק שוב')!.click();
  expect(onPlayAgain).toHaveBeenCalledTimes(1);
});
