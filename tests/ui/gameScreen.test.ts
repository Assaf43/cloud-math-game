import { GameScreen } from '../../src/ui/gameScreen';
import { Session } from '../../src/game/session';
import { CITIES } from '../../src/weather/cities';
import { createRng } from '../../src/rng';
import type { GameConfig, WeatherState } from '../../src/types';

const cfg: GameConfig = { name: 'נועה', age: 10, grade: 5, difficulty: 'beginner', secondsPerProblem: 30, rounds: 2 };

function setup(over: Partial<GameConfig> = {}, seed = 1) {
  const root = document.createElement('div'); document.body.append(root);
  const session = new Session({ ...cfg, ...over }, createRng(seed), CITIES);
  let t = 0;
  const audio = {
    playSuccess: vi.fn(), pauseMusic: vi.fn(), resumeMusic: vi.fn(), start: vi.fn(), muted: false,
    setMuted: vi.fn((m: boolean) => { audio.muted = m; }),
  };
  const onRoundEnd = vi.fn(); const onMuteChange = vi.fn();
  const fetchWeather = vi.fn(async (): Promise<WeatherState> => 'rain');
  const screen = new GameScreen(root, session, {
    audio: audio as never, now: () => t, fetchWeather, onRoundEnd, onMuteChange, rng: createRng(9), roundCardMs: 0,
  });
  const press = (key: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  const typeText = (s: string) => [...s].forEach(press);
  const frame = (ms = 20) => vi.advanceTimersByTime(ms);
  return {
    root, session, audio, onRoundEnd, onMuteChange, fetchWeather, screen, press, typeText, frame,
    setNow: (v: number) => { t = v; }, addNow: (v: number) => { t += v; },
    display: () => root.querySelector('.answer-display')!.textContent,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; vi.restoreAllMocks(); });

test('start fetches the weather for the round city and shows the scene without naming the city', async () => {
  const s = setup(); await s.screen.start();
  expect(s.fetchWeather).toHaveBeenCalledWith(s.session.city);
  const scene = s.root.querySelector<HTMLElement>('.scene')!;
  expect(scene.dataset.weather).toBe('rain'); expect(scene.dataset.city).toBe(s.session.city.id);
  expect(s.root.textContent).not.toContain(s.session.city.name);
  expect(s.root.querySelectorAll('[data-answer]')).toHaveLength(4);
  expect(s.root.querySelector('.problem')!.textContent).toBe(s.session.problem.text);
  s.screen.destroy();
});

test('status bar shows name, round, problem and score', async () => {
  const s = setup(); await s.screen.start();
  const bar = s.root.querySelector('.status')!.textContent!;
  expect(bar).toContain('נועה'); expect(bar).toContain('סבב 1 מתוך 2'); expect(bar).toContain(`תרגיל 1 מתוך ${s.session.problemsInRound}`);
  s.screen.destroy();
});

test('typing the correct answer and Enter plays success and advances after 1500 ms', async () => {
  const s = setup(); await s.screen.start();
  const answer = s.session.problem.answer.text;
  s.typeText(answer); expect(s.display()).toBe(answer);
  s.setNow(6000); s.press('Enter');
  expect(s.audio.playSuccess).toHaveBeenCalledTimes(1);
  expect(s.session.phase).toBe('reveal'); expect(s.session.lastResult).toBe('correct');
  expect(s.root.querySelector('.status')!.textContent).toContain('180');
  s.frame(1400); expect(s.session.phase).toBe('reveal');
  s.frame(100); expect(s.session.phase).toBe('problem'); expect(s.session.problemIndex).toBe(1);
  expect(s.display()).toBe('');
  s.screen.destroy();
});

test('a wrong on-screen choice plays no sound and highlights the correct answer', async () => {
  const s = setup(); await s.screen.start();
  const wrong = s.session.problem.choices.find(c => c.text !== s.session.problem.answer.text)!;
  s.typeText(wrong.text); s.press('Enter');
  expect(s.audio.playSuccess).not.toHaveBeenCalled();
  expect(s.session.lastResult).toBe('wrong');
  const hit = s.root.querySelectorAll<HTMLElement>('.is-correct');
  expect(hit).toHaveLength(1); expect(hit[0].dataset.answer).toBe(s.session.problem.answer.text);
  s.screen.destroy();
});

test('input matching no choice shakes, clears, and the problem stays', async () => {
  const s = setup(); await s.screen.start();
  s.typeText('999999'); s.press('Enter');
  expect(s.session.phase).toBe('problem'); expect(s.display()).toBe('');
  expect(s.root.querySelector('.answer-display')!.classList.contains('shake')).toBe(true);
  s.screen.destroy();
});

test('Enter on an empty display does nothing', async () => {
  const s = setup(); await s.screen.start();
  s.press('Enter'); expect(s.session.phase).toBe('problem');
  s.screen.destroy();
});

test('timeout highlights the answer and advances', async () => {
  const s = setup(); await s.screen.start();
  s.setNow(29999); s.frame(); expect(s.session.phase).toBe('problem');
  s.setNow(30000); s.frame();
  expect(s.session.phase).toBe('reveal'); expect(s.session.lastResult).toBe('timeout');
  expect(s.audio.playSuccess).not.toHaveBeenCalled();
  expect(s.root.querySelector('.is-correct')).not.toBeNull();
  s.frame(1500); expect(s.session.phase).toBe('problem'); expect(s.session.problemIndex).toBe(1);
  s.screen.destroy();
});

test('timer bar shrinks with the time that is left', async () => {
  const s = setup(); await s.screen.start();
  const bar = () => s.root.querySelector<HTMLElement>('.timer-bar')!;
  s.frame(); expect(bar().style.width).toBe('100%');
  s.setNow(15000); s.frame(); expect(bar().style.width).toBe('50%');
  s.screen.destroy();
});

test('input longer than 8 characters is ignored', async () => {
  const s = setup(); await s.screen.start();
  s.typeText('123456789'); expect(s.display()).toBe('12345678');
  s.screen.destroy();
});

test('comma key is shown as a decimal point; backspace deletes; other keys are ignored', async () => {
  const s = setup(); await s.screen.start();
  s.typeText('1,5'); expect(s.display()).toBe('1.5');
  s.press('Backspace'); expect(s.display()).toBe('1.');
  s.press('a'); s.press('-'); s.press('Shift'); expect(s.display()).toBe('1.');
  s.screen.destroy();
});

test('space and slash can be typed for mixed numbers', async () => {
  const s = setup(); await s.screen.start();
  s.typeText('1 1/2'); expect(s.display()).toBe('1 1/2');
  s.screen.destroy();
});

test('Ctrl/Meta shortcuts are not captured', async () => {
  const s = setup(); await s.screen.start();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: '5', ctrlKey: true }));
  expect(s.display()).toBe('');
  s.screen.destroy();
});

test('hiding the document pauses the clock: 60 s hidden does not time out a 30 s problem', async () => {
  const s = setup(); await s.screen.start();
  s.setNow(10000); s.frame();
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
  s.addNow(60000); s.frame(200);
  expect(s.session.phase).toBe('problem');
  expect(s.root.querySelector('.game')!.classList.contains('is-paused')).toBe(true);
  expect(s.audio.pauseMusic).toHaveBeenCalled();
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  document.dispatchEvent(new Event('visibilitychange'));
  s.screen.resume();
  expect(s.audio.resumeMusic).toHaveBeenCalled();
  s.frame(); expect(s.session.phase).toBe('problem');
  expect(s.root.querySelector<HTMLElement>('.timer-bar')!.style.width).toBe('66.67%');
  s.addNow(19999); s.frame(); expect(s.session.phase).toBe('problem');
  s.addNow(1); s.frame(); expect(s.session.phase).toBe('reveal');
  delete (document as unknown as Record<string, unknown>).hidden;
  s.screen.destroy();
});

test('input is ignored while paused; the pause button and overlay work', async () => {
  const s = setup(); await s.screen.start();
  s.root.querySelector<HTMLButtonElement>('.pause-btn')!.click();
  const overlay = s.root.querySelector<HTMLElement>('.pause-overlay')!;
  expect(overlay.hidden).toBe(false); expect(overlay.textContent).toContain('המשחק מושהה');
  s.typeText('5'); expect(s.display()).toBe('');
  overlay.querySelector<HTMLButtonElement>('button')!.click();
  expect(overlay.hidden).toBe(true); s.typeText('5'); expect(s.display()).toBe('5');
  s.screen.destroy();
});

test('pausing during the reveal delays the advance by the time that was left', async () => {
  const s = setup(); await s.screen.start();
  s.typeText(s.session.problem.answer.text); s.press('Enter');
  s.setNow(1000); s.frame(1000);
  s.screen.pause();
  s.addNow(60000); s.frame(5000); expect(s.session.phase).toBe('reveal');
  s.screen.resume(); s.frame(400); expect(s.session.phase).toBe('reveal');
  s.frame(200); expect(s.session.phase).toBe('problem');
  s.screen.destroy();
});

test('the answer display is not an input element and nothing is focused', async () => {
  const s = setup(); await s.screen.start();
  expect(s.root.querySelector('input, textarea')).toBeNull();
  expect(s.root.querySelector('.answer-display')!.hasAttribute('tabindex')).toBe(false);
  expect(document.activeElement === document.body || document.activeElement === null).toBe(true);
  s.screen.destroy();
});

test('onRoundEnd fires after the last problem of the round', async () => {
  const s = setup(); await s.screen.start();
  const n = s.session.problemsInRound;
  for (let i = 0; i < n; i++) {
    expect(s.onRoundEnd).not.toHaveBeenCalled();
    s.typeText(s.session.problem.answer.text); s.press('Enter'); s.frame(1500);
  }
  expect(s.session.phase).toBe('roundSummary'); expect(s.onRoundEnd).toHaveBeenCalledTimes(1);
  s.screen.destroy();
});

test('mute button toggles the audio and reports the change', async () => {
  const s = setup(); await s.screen.start();
  const btn = s.root.querySelector<HTMLButtonElement>('.mute-btn')!;
  btn.click(); expect(s.audio.setMuted).toHaveBeenLastCalledWith(true); expect(s.onMuteChange).toHaveBeenLastCalledWith(true);
  expect(btn.getAttribute('aria-pressed')).toBe('true');
  btn.click(); expect(s.audio.setMuted).toHaveBeenLastCalledWith(false);
  s.screen.destroy();
});

test('player name is rendered as text', async () => {
  const s = setup({ name: '<img src=x onerror=alert(1)>' }); await s.screen.start();
  expect(s.root.querySelector('img')).toBeNull();
  expect(s.root.querySelector('.status')!.textContent).toContain('<img src=x');
  s.screen.destroy();
});

test('touch devices get the keypad and it types; others do not', async () => {
  const mm = (matches: boolean) => vi.stubGlobal('matchMedia', (q: string) => ({ matches: matches && q.includes('coarse'), media: q, addEventListener() {}, removeEventListener() {} }));
  mm(false);
  const a = setup(); await a.screen.start();
  expect(a.root.querySelector('.keypad')).toBeNull(); a.screen.destroy();
  mm(true);
  const b = setup(); await b.screen.start();
  expect(b.root.querySelector('.keypad')).not.toBeNull();
  b.root.querySelector<HTMLButtonElement>('[data-key="7"]')!.click();
  expect(b.display()).toBe('7');
  b.root.querySelector<HTMLButtonElement>('[data-key="backspace"]')!.click();
  expect(b.display()).toBe('');
  b.typeText(b.session.problem.answer.text);
  b.root.querySelector<HTMLButtonElement>('[data-key="enter"]')!.click();
  expect(b.session.lastResult).toBe('correct');
  b.screen.destroy(); vi.unstubAllGlobals();
});

test('after destroy, keys and timers no longer do anything', async () => {
  const s = setup(); await s.screen.start();
  s.screen.destroy();
  s.typeText('5'); s.setNow(99999); s.frame(100);
  expect(s.session.phase).toBe('problem');
});

test('a slow weather response does not start the clock early', async () => {
  const s = setup();
  let resolve!: (w: WeatherState) => void;
  s.fetchWeather.mockImplementationOnce(() => new Promise<WeatherState>(r => { resolve = r; }));
  const started = s.screen.start();
  s.setNow(20000); s.frame(100);
  expect(s.session.phase).toBe('problem');
  resolve('clear'); await started;
  s.frame(); expect(s.root.querySelector<HTMLElement>('.timer-bar')!.style.width).toBe('100%');
  s.screen.destroy();
});
