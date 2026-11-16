import { renderCityBonus, renderRoundSummary } from '../../src/ui/roundScreens';
import { Session } from '../../src/game/session';
import { CITY_BONUS } from '../../src/game/scoring';
import { CITIES } from '../../src/weather/cities';
import { createRng } from '../../src/rng';
import type { GameConfig } from '../../src/types';

const cfg: GameConfig = { name: 'נועה', age: 10, grade: 5, difficulty: 'beginner', secondsPerProblem: 30, rounds: 2 };

/** A session at the round summary: the first problem times out, the rest are answered instantly. */
function atSummary(seed = 4) {
  const s = new Session(cfg, createRng(seed), CITIES);
  const n = s.problemsInRound;
  for (let i = 0; i < n; i++) { i === 0 ? s.timeout() : s.choose(s.problem.answer.text, 0); s.advance(); }
  return s;
}
let root: HTMLElement;
beforeEach(() => { vi.useFakeTimers(); root = document.createElement('div'); document.body.append(root); });
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

test('round summary shows correct count, average time with one decimal, points and a continue button', () => {
  const s = atSummary(); const n = s.problemsInRound; const r = s.rounds[0];
  const onContinue = vi.fn();
  renderRoundSummary(root, s, onContinue);
  const text = root.textContent!;
  expect(text).toContain('סיכום סבב 1');
  expect(text).toContain(`${n - 1} מתוך ${n}`);
  expect(text).toContain(`${(r.avgAnswerMs / 1000).toFixed(1)}`);
  expect(text).toContain(String(r.points));
  const btn = [...root.querySelectorAll('button')].find(b => b.textContent === 'המשך')!;
  btn.click(); expect(onContinue).toHaveBeenCalledTimes(1);
});

test('round summary uses the current round', () => {
  const s = atSummary();
  s.advance(); s.answerCity(s.city.id); s.advance();
  const n = s.problemsInRound;
  for (let i = 0; i < n; i++) { s.choose(s.problem.answer.text, 15000); s.advance(); }
  renderRoundSummary(root, s, () => {});
  expect(root.textContent).toContain('סיכום סבב 2'); expect(root.textContent).toContain(`${n} מתוך ${n}`);
});

function atCity(seed = 4) { const s = atSummary(seed); s.advance(); return s; }

test('city bonus asks the question, shows the hint, the skyline and four city buttons', () => {
  const s = atCity();
  renderCityBonus(root, s, () => {});
  expect(root.textContent).toContain('באיזו עיר אנחנו?');
  expect(root.textContent).toContain(s.city.hint);
  expect(root.querySelector('svg')).not.toBeNull();
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('button[data-city]')];
  expect(buttons.map(b => b.dataset.city).sort()).toEqual(s.cityOptions.map(c => c.id).sort());
  expect(buttons).toHaveLength(4);
  expect(buttons.map(b => b.textContent)).toEqual(expect.arrayContaining(s.cityOptions.map(c => c.name)));
});

test('a correct click adds 150, plays success and calls onDone after 1500 ms', () => {
  const s = atCity(); const before = s.totalScore;
  const onDone = vi.fn(); const playSuccess = vi.fn();
  renderCityBonus(root, s, onDone, { playSuccess });
  root.querySelector<HTMLButtonElement>(`button[data-city="${s.city.id}"]`)!.click();
  expect(s.totalScore).toBe(before + CITY_BONUS);
  expect(root.textContent).toContain('נכון! +150'); expect(playSuccess).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1499); expect(onDone).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1); expect(onDone).toHaveBeenCalledTimes(1);
  expect(['roundSummary', 'cityBonus']).not.toContain(s.phase);
});

test('a wrong click adds 0, plays no sound and marks the correct button', () => {
  const s = atCity(); const before = s.totalScore;
  const onDone = vi.fn(); const playSuccess = vi.fn();
  renderCityBonus(root, s, onDone, { playSuccess });
  const wrong = s.cityOptions.find(c => c.id !== s.city.id)!;
  root.querySelector<HTMLButtonElement>(`button[data-city="${wrong.id}"]`)!.click();
  expect(s.totalScore).toBe(before); expect(playSuccess).not.toHaveBeenCalled();
  expect(root.querySelector(`button[data-city="${s.city.id}"]`)!.classList.contains('is-correct')).toBe(true);
  expect(root.querySelector(`button[data-city="${wrong.id}"]`)!.classList.contains('is-wrong')).toBe(true);
  expect(root.textContent).not.toContain('+150');
  vi.advanceTimersByTime(1500); expect(onDone).toHaveBeenCalledTimes(1);
});

test('a second click is ignored once answered', () => {
  const s = atCity(); const onDone = vi.fn();
  renderCityBonus(root, s, onDone);
  const buttons = root.querySelectorAll<HTMLButtonElement>('button[data-city]');
  buttons[0].click(); buttons[1].click(); buttons[2].click();
  vi.advanceTimersByTime(5000);
  expect(onDone).toHaveBeenCalledTimes(1);
  expect([...buttons].every(b => b.disabled)).toBe(true);
});

test('the last round goes to finished after the city question', () => {
  let s = atSummary(); s.advance(); s.answerCity(s.city.id); s.advance();
  const n = s.problemsInRound;
  for (let i = 0; i < n; i++) { s.timeout(); s.advance(); }
  s.advance();
  const onDone = vi.fn();
  renderCityBonus(root, s, onDone);
  root.querySelector<HTMLButtonElement>('button[data-city]')!.click(); vi.advanceTimersByTime(1500);
  expect(s.phase).toBe('finished'); expect(onDone).toHaveBeenCalled();
});
