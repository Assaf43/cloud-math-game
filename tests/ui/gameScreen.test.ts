import { readFileSync } from 'node:fs';
import { GameScreen } from '../../src/ui/gameScreen';
import { Session } from '../../src/game/session';
import { CITIES } from '../../src/weather/cities';
import { createRng } from '../../src/rng';
import type { GameConfig, WeatherState } from '../../src/types';
import { PrepSession } from '../../src/prep/prepSession';
import type { Pack } from '../../src/prep/pack';

const cfg: GameConfig = { name: 'נועה', age: 10, grade: 5, difficulty: 'beginner', secondsPerProblem: 30, rounds: 2 };

function setup(over: Partial<GameConfig> = {}, seed = 1, onNewGame?: () => void) {
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
    audio: audio as never, now: () => t, fetchWeather, onRoundEnd, onMuteChange, onNewGame, rng: createRng(9), roundCardMs: 0,
  });
  const frame = (ms = 20) => vi.advanceTimersByTime(ms);
  const answerEl = (text: string) => root.querySelector<HTMLElement>(`[data-answer="${text}"]`)!;
  const tap = (text: string) => answerEl(text).click();
  const tapRight = () => tap(session.problem.answer.text);
  const wrongChoice = () => session.problem.choices.find(c => c.text !== session.problem.answer.text)!.text;
  return {
    root, session, audio, onRoundEnd, onMuteChange, fetchWeather, screen, frame, answerEl, tap, tapRight, wrongChoice,
    setNow: (v: number) => { t = v; }, addNow: (v: number) => { t += v; },
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

test('there is no typing: no input, no keypad, no answer display', async () => {
  const s = setup(); await s.screen.start();
  expect(s.root.querySelector('input, textarea, .keypad, .answer-display')).toBeNull();
  expect(document.activeElement === document.body || document.activeElement === null).toBe(true);
  s.screen.destroy();
});

test('answers are real buttons, so they work with a mouse, a finger and the keyboard', async () => {
  const s = setup(); await s.screen.start();
  const els = [...s.root.querySelectorAll('[data-answer]')];
  expect(els.every(e => e instanceof HTMLButtonElement && e.type === 'button')).toBe(true);
  s.screen.destroy();
});

test('status bar shows name, round, problem and score', async () => {
  const s = setup(); await s.screen.start();
  const bar = s.root.querySelector('.status')!.textContent!;
  expect(bar).toContain('נועה'); expect(bar).toContain('סבב 1 מתוך 2'); expect(bar).toContain(`תרגיל 1 מתוך ${s.session.problemsInRound}`);
  s.screen.destroy();
});

test('mute and pause cannot leave the status bar: the buttons keep their size and the texts give way (CSS)', async () => {
  const s = setup(); await s.screen.start();
  const status = s.root.querySelector('.status')!;
  // round and problem are one unit, so an upright phone can give them a row of their own
  expect([...status.children].map(c => c.className)).toEqual(['status-name', 'status-progress', 'status-score', 'mute-btn', 'pause-btn']);
  expect([...status.querySelector('.status-progress')!.children].map(c => c.className)).toEqual(['status-round', 'status-problem']);
  s.screen.destroy();
  const css = readFileSync('src/styles.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const portraitAt = css.search(/@media \(orientation:\s*portrait\)/);
  expect(portraitAt).toBeGreaterThan(0);
  const base = css.slice(0, portraitAt);
  const portrait = css.slice(portraitAt).match(/@media \(orientation:\s*portrait\)\s*\{((?:[^{}]*\{[^{}]*\})+)\s*\}/)?.[1] ?? '';
  // at every size: buttons never shrink; the texts can, in a fixed order
  expect(css).toMatch(/\.status button\s*\{[^}]*flex:\s*none/);
  const nameShrink = Number(base.match(/\.status-name\s*\{[^}]*flex:\s*0\s+(\d+)\s+auto/)?.[1]);
  const textShrink = Number(base.match(/\.status-round, \.status-problem\s*\{[^}]*flex:\s*0\s+(\d+)\s+auto/)?.[1]);
  expect(textShrink).toBeGreaterThan(0);
  expect(nameShrink).toBeGreaterThanOrEqual(textShrink * 1e6);
  const roundShrink = Number(base.match(/\.status-round\s*\{[^}]*flex-shrink:\s*(\d+)/)?.[1]);
  expect(roundShrink).toBeGreaterThanOrEqual(textShrink * 1e4); expect(nameShrink).toBeGreaterThanOrEqual(roundShrink * 1e4);   // name, then round, then problem
  expect(base).toMatch(/\.status-round, \.status-problem\s*\{[^}]*min-width:\s*0[^}]*overflow:\s*hidden[^}]*text-overflow:\s*ellipsis/);
  expect(base).toMatch(/\.status-progress\s*\{[^}]*display:\s*contents/);                   // wide screens: one flat row, as before
  expect(base).toMatch(/\.status\s*\{[^}]*flex-wrap:\s*nowrap/);
  // upright screens: two rows, and no width breakpoint that has to match a particular phone
  expect(css).not.toMatch(/@media[^{]*width[^{]*\{[^{}]*\.status/);
  expect(portrait).toMatch(/\.status\s*\{[^}]*flex-wrap:\s*wrap/);
  expect(portrait).toMatch(/\.status-name\s*\{[^}]*flex:\s*1\s+1\s+0/);
  expect(portrait).toMatch(/\.status-progress\s*\{[^}]*display:\s*flex[^}]*order:\s*1[^}]*flex:\s*0\s+0\s+100%/);
});

test('tapping the correct answer plays success, scores by speed and advances after 1500 ms', async () => {
  const s = setup(); await s.screen.start();
  s.setNow(6000); s.tapRight();
  expect(s.audio.playSuccess).toHaveBeenCalledTimes(1);
  expect(s.session.phase).toBe('reveal'); expect(s.session.lastResult).toBe('correct');
  expect(s.root.querySelector('.status')!.textContent).toContain('180');
  expect(s.root.querySelector('.is-correct')).not.toBeNull();
  s.frame(1400); expect(s.session.phase).toBe('reveal');
  s.frame(100); expect(s.session.phase).toBe('problem'); expect(s.session.problemIndex).toBe(1);
  s.screen.destroy();
});

test('tapping a wrong answer plays no sound, marks it and highlights the correct one', async () => {
  const s = setup(); await s.screen.start();
  const wrong = s.wrongChoice();
  s.tap(wrong);
  expect(s.audio.playSuccess).not.toHaveBeenCalled();
  expect(s.session.lastResult).toBe('wrong'); expect(s.session.totalScore).toBe(0);
  expect(s.answerEl(wrong).classList.contains('is-wrong')).toBe(true);
  const hit = s.root.querySelectorAll<HTMLElement>('.is-correct');
  expect(hit).toHaveLength(1); expect(hit[0].dataset.answer).toBe(s.session.problem.answer.text);
  s.screen.destroy();
});

test('one attempt only: a second tap during the reveal does nothing', async () => {
  const s = setup(); await s.screen.start();
  s.tap(s.wrongChoice());
  const before = s.session.totalScore;
  s.tapRight();
  expect(s.session.lastResult).toBe('wrong'); expect(s.session.totalScore).toBe(before);
  expect(s.audio.playSuccess).not.toHaveBeenCalled();
  s.frame(1500); expect(s.session.problemIndex).toBe(1);
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

test('taps are ignored while paused; the pause button and overlay work and "המשך" takes focus', async () => {
  const s = setup(); await s.screen.start();
  s.root.querySelector<HTMLButtonElement>('.pause-btn')!.click();
  const overlay = s.root.querySelector<HTMLElement>('.pause-overlay')!;
  expect(overlay.hidden).toBe(false); expect(overlay.textContent).toContain('המשחק מושהה');
  expect(document.activeElement).toBe(overlay.querySelector('button'));
  s.tapRight(); expect(s.session.phase).toBe('problem');
  overlay.querySelector<HTMLButtonElement>('button')!.click();
  expect(overlay.hidden).toBe(true);
  expect(document.activeElement === document.body).toBe(true);
  s.tapRight(); expect(s.session.phase).toBe('reveal');
  s.screen.destroy();
});

test('pausing during the reveal delays the advance by the time that was left', async () => {
  const s = setup(); await s.screen.start();
  s.tapRight();
  s.setNow(1000); s.frame(1000);
  s.screen.pause();
  s.addNow(60000); s.frame(5000); expect(s.session.phase).toBe('reveal');
  s.screen.resume(); s.frame(400); expect(s.session.phase).toBe('reveal');
  s.frame(200); expect(s.session.phase).toBe('problem');
  s.screen.destroy();
});

test('onRoundEnd fires after the last problem of the round', async () => {
  const s = setup(); await s.screen.start();
  const n = s.session.problemsInRound;
  for (let i = 0; i < n; i++) {
    expect(s.onRoundEnd).not.toHaveBeenCalled();
    s.tapRight(); s.frame(1500);
  }
  expect(s.session.phase).toBe('roundSummary'); expect(s.onRoundEnd).toHaveBeenCalledTimes(1);
  s.screen.destroy();
});

test('mute button toggles the audio, reports the change and hands focus back', async () => {
  const s = setup(); await s.screen.start();
  const btn = s.root.querySelector<HTMLButtonElement>('.mute-btn')!;
  btn.focus(); btn.click();
  expect(s.audio.setMuted).toHaveBeenLastCalledWith(true); expect(s.onMuteChange).toHaveBeenLastCalledWith(true);
  expect(btn.getAttribute('aria-pressed')).toBe('true');
  expect(document.activeElement === document.body).toBe(true);
  btn.click(); expect(s.audio.setMuted).toHaveBeenLastCalledWith(false);
  s.screen.destroy();
});

test('player name is rendered as text', async () => {
  const s = setup({ name: '<img src=x onerror=alert(1)>' }); await s.screen.start();
  expect(s.root.querySelector('img')).toBeNull();
  expect(s.root.querySelector('.status')!.textContent).toContain('<img src=x');
  s.screen.destroy();
});

test('after destroy, taps and timers no longer do anything', async () => {
  const s = setup(); await s.screen.start();
  const tapped = s.answerEl(s.session.problem.answer.text);
  s.screen.destroy();
  tapped.click(); s.setNow(99999); s.frame(100);
  expect(s.session.phase).toBe('problem');
});

test('a slow weather response does not start the clock early and there is nothing to tap yet', async () => {
  const s = setup();
  let resolve!: (w: WeatherState) => void;
  s.fetchWeather.mockImplementationOnce(() => new Promise<WeatherState>(r => { resolve = r; }));
  const started = s.screen.start();
  s.setNow(20000); s.frame(100);
  expect(s.session.phase).toBe('problem');
  expect(s.root.querySelectorAll('[data-answer]')).toHaveLength(0);
  resolve('clear'); await started;
  s.frame(); expect(s.root.querySelector<HTMLElement>('.timer-bar')!.style.width).toBe('100%');
  s.screen.destroy();
});

test('hidden before the first problem starts: the problem begins paused and the clock does not run', async () => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  const s = setup();
  let resolve!: (w: WeatherState) => void;
  s.fetchWeather.mockImplementationOnce(() => new Promise<WeatherState>(r => { resolve = r; }));
  const started = s.screen.start();
  s.addNow(5000); resolve('clear'); await started;
  expect(s.root.querySelector('.game')!.classList.contains('is-paused')).toBe(true);
  expect(s.audio.pauseMusic).toHaveBeenCalled();
  s.addNow(60000); s.frame(100);
  expect(s.session.phase).toBe('problem');
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  s.screen.resume(); s.frame();
  expect(s.session.phase).toBe('problem');
  expect(s.root.querySelector<HTMLElement>('.timer-bar')!.style.width).toBe('100%');
  delete (document as unknown as Record<string, unknown>).hidden;
  s.screen.destroy();
});

test('the next problem shows fresh, untapped answers', async () => {
  const s = setup(); await s.screen.start();
  s.tap(s.wrongChoice()); s.frame(1500);
  expect(s.root.querySelectorAll('.is-wrong, .is-correct')).toHaveLength(0);
  expect(s.root.querySelector('.problem')!.textContent).toBe(s.session.problem.text);
  s.screen.destroy();
});

test('the pause menu offers a new game, with a confirmation, and cancelling keeps the game', async () => {
  const onNewGame = vi.fn();
  const s = setup({}, 1, onNewGame); await s.screen.start();
  s.screen.pause();
  const overlay = s.root.querySelector<HTMLElement>('.pause-overlay')!;
  const byText = (t: string) => [...overlay.querySelectorAll('button')].find(b => b.textContent === t)!;
  expect(byText('המשך')).toBeDefined();
  byText('משחק חדש').click();
  expect(overlay.textContent).toContain('להתחיל משחק חדש?');
  byText('חזרה').click();
  expect(onNewGame).not.toHaveBeenCalled();
  byText('המשך').click();
  expect(s.session.phase).toBe('problem'); s.tapRight(); expect(s.session.phase).toBe('reveal');
  s.screen.destroy();
});

test('a regular game shows the timer and plays no celebration on a correct answer', async () => {
  const s = setup(); await s.screen.start();
  expect(s.root.querySelector<HTMLElement>('.timer')!.hidden).toBe(false);
  s.tapRight();
  expect(s.root.querySelector('.is-celebrating, .is-celebrating-big, .is-sunlit, .is-stubborn')).toBeNull();
  s.screen.destroy();
});

// ---- test practice (PrepSession) -----------------------------------------------
const prepPack = (): Pack => ({
  id: 'p1', owner: 'noa', name: 'מבחן בחשבון', grade: 5, examples: ['48 × 6', '6 × (2 + 3)', '3/4 + 1/8'],
  createdAt: '2026-11-19', shapes: {}, lastStars: null,
});

function setupPrep(seed = 2, packName = 'מבחן בחשבון') {
  const root = document.createElement('div'); document.body.append(root);
  const flow = new PrepSession({ name: 'נועה', grade: 5, difficulty: 'beginner', pack: { ...prepPack(), name: packName } }, createRng(seed), CITIES[0]);
  let t = 0;
  const audio = {
    playSuccess: vi.fn(), pauseMusic: vi.fn(), resumeMusic: vi.fn(), start: vi.fn(), muted: false,
    setMuted: vi.fn((m: boolean) => { audio.muted = m; }),
  };
  const onRoundEnd = vi.fn();
  const screen = new GameScreen(root, flow, {
    audio: audio as never, now: () => t, fetchWeather: async () => 'clear', onRoundEnd, rng: createRng(9), roundCardMs: 0,
  });
  const frame = (ms = 20) => vi.advanceTimersByTime(ms);
  const scene = () => root.querySelector<HTMLElement>('.scene')!;
  const answerEl = (text: string) => root.querySelector<HTMLElement>(`[data-answer="${text}"]`)!;
  const tapRight = () => answerEl(flow.problem.answer.text).click();
  const wrongChoice = () => flow.problem.choices.find(c => c.text !== flow.problem.answer.text)!.text;
  return { root, flow, audio, onRoundEnd, screen, frame, scene, answerEl, tapRight, wrongChoice, addNow: (v: number) => { t += v; } };
}

test('practice: the timer is hidden and ten minutes pass without a timeout', async () => {
  const s = setupPrep(); await s.screen.start();
  expect(s.root.querySelector<HTMLElement>('.timer')!.hidden).toBe(true);
  for (let i = 0; i < 60; i++) { s.addNow(10000); s.frame(10000); }
  expect(s.flow.phase).toBe('problem');
  s.screen.destroy();
});

test('only a timer-free practice marks the game root, so a long pack name can shrink without touching the regular bar', async () => {
  const p = setupPrep(2, 'המבחן הגדול בחשבון של כיתה ה׳'); await p.screen.start();
  expect(p.root.querySelector('.game')!.classList.contains('no-timer')).toBe(true);
  p.screen.destroy();
  const s = setup(); await s.screen.start();
  expect(s.root.querySelector('.game')!.className).toBe('game');
  s.screen.destroy();
});

test('a long pack name shrinks in a timer-free game, and the bar buttons never shrink', () => {
  const css = readFileSync('src/styles.css', 'utf8');
  const rule = css.match(/\.game\.no-timer \.status-round\s*\{([^}]*)\}/);
  expect(rule).not.toBeNull();
  expect(rule![1]).toMatch(/min-width:\s*0/);
  expect(rule![1]).toMatch(/overflow:\s*hidden/);
  expect(rule![1]).toMatch(/text-overflow:\s*ellipsis/);
  const selectors = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]*\.status-round[^{}]*)\{/g)].map(m => m[1].trim());
  // Since the status bar fix the regular game's round label gives way too (name, then round, then problem), so the
  // practice rule is no longer the only one; it stays so a 30-character pack name shrinks whatever that order becomes.
  expect(selectors).toContain('.game.no-timer .status-round');
  expect(css).toMatch(/\.status button\s*\{[^}]*flex:\s*none/);
});

test('practice: the right answer celebrates and lights that answer, with the success chime', async () => {
  const s = setupPrep(); await s.screen.start();
  const right = s.flow.problem.answer.text;
  s.tapRight();
  expect(s.scene().classList.contains('is-celebrating')).toBe(true);
  expect(s.scene().classList.contains('is-celebrating-big')).toBe(false);
  expect(s.answerEl(right).classList.contains('is-sunlit')).toBe(true);
  expect(s.root.querySelectorAll('.is-sunlit')).toHaveLength(1);
  expect(s.audio.playSuccess).toHaveBeenCalledTimes(1);
  s.frame(1500);
  expect(s.scene().classList.contains('is-celebrating')).toBe(false);
  expect(s.root.querySelector('.is-sunlit')).toBeNull();
  s.screen.destroy();
});

test('practice: a returning problem has stubborn clouds and a big celebration when solved', async () => {
  const s = setupPrep(); await s.screen.start();
  expect(s.scene().classList.contains('is-stubborn')).toBe(false);
  s.answerEl(s.wrongChoice()).click(); s.frame(1500);              // a miss on problem 1 brings its twin back later
  let n = 0;
  while (!s.flow.stubborn) {
    expect(s.scene().classList.contains('is-stubborn')).toBe(false);
    s.tapRight(); s.frame(1500);
    if (++n > 10) throw new Error('no returning problem');
  }
  expect(s.scene().classList.contains('is-stubborn')).toBe(true);
  s.tapRight();
  expect(s.scene().classList.contains('is-celebrating')).toBe(true);
  expect(s.scene().classList.contains('is-celebrating-big')).toBe(true);
  s.frame(1500);
  expect(s.scene().classList.contains('is-stubborn')).toBe(false);
  expect(s.scene().classList.contains('is-celebrating-big')).toBe(false);
  s.screen.destroy();
});

test('practice: a wrong answer celebrates nothing and plays no sound', async () => {
  const s = setupPrep(); await s.screen.start();
  const wrong = s.wrongChoice();
  s.answerEl(wrong).click();
  expect(s.flow.phase).toBe('reveal');
  expect(s.scene().classList.contains('is-celebrating')).toBe(false);
  expect(s.root.querySelector('.is-sunlit')).toBeNull();
  expect(s.audio.playSuccess).not.toHaveBeenCalled();
  expect(s.answerEl(wrong).classList.contains('is-wrong')).toBe(true);
  expect(s.root.textContent).not.toMatch(/טעית|לא נכון/);
  s.screen.destroy();
});

test('practice: the status bar shows the pack name and the stars, as text', async () => {
  const s = setupPrep(); await s.screen.start();
  const bar = () => s.root.querySelector('.status')!.textContent!;
  expect(bar()).toContain('נועה'); expect(bar()).toContain('מבחן בחשבון'); expect(bar()).toContain('⭐ 0');
  s.tapRight(); expect(bar()).toContain('⭐ 1');
  s.screen.destroy();
  const x = setupPrep(2, '<img src=x onerror=alert(1)>'); await x.screen.start();
  expect(x.root.querySelector('img')).toBeNull();
  expect(x.root.querySelector('.status')!.textContent).toContain('<img src=x');
  x.screen.destroy();
});

test('practice: the intro card shows the pack name', async () => {
  const root = document.createElement('div'); document.body.append(root);
  const flow = new PrepSession({ name: 'נועה', grade: 5, difficulty: 'beginner', pack: prepPack() }, createRng(2), CITIES[0]);
  const screen = new GameScreen(root, flow, {
    audio: { playSuccess: vi.fn(), pauseMusic: vi.fn(), resumeMusic: vi.fn(), setMuted: vi.fn(), muted: false },
    now: () => 0, fetchWeather: async () => 'clear', onRoundEnd: vi.fn(), rng: createRng(9), roundCardMs: 1000,
  });
  const started = screen.start();
  await vi.advanceTimersByTimeAsync(500);
  const card = root.querySelector<HTMLElement>('.round-card')!;
  expect(card.hidden).toBe(false); expect(card.textContent).toBe('מבחן בחשבון');
  await vi.advanceTimersByTimeAsync(600); await started;
  expect(card.hidden).toBe(true);
  screen.destroy();
});

test('practice: pause and resume work, and onRoundEnd fires once after the last problem', async () => {
  const s = setupPrep(); await s.screen.start();
  s.root.querySelector<HTMLButtonElement>('.pause-btn')!.click();
  const overlay = s.root.querySelector<HTMLElement>('.pause-overlay')!;
  expect(overlay.hidden).toBe(false); expect(s.screen.isPaused).toBe(true);
  s.tapRight(); expect(s.flow.phase).toBe('problem');
  s.addNow(600000); s.frame(1000);
  overlay.querySelector<HTMLButtonElement>('button')!.click();
  expect(overlay.hidden).toBe(true); expect(s.screen.isPaused).toBe(false);
  s.tapRight(); s.screen.pause(); s.frame(5000); expect(s.flow.phase).toBe('reveal');
  s.screen.resume(); s.frame(1500);
  let n = 1;
  while (s.flow.phase === 'problem') {
    expect(s.onRoundEnd).not.toHaveBeenCalled();
    s.tapRight(); s.frame(1500);
    if (++n > 40) throw new Error('practice does not end');
  }
  expect(n).toBe(10);
  expect(s.flow.phase).toBe('finished'); expect(s.onRoundEnd).toHaveBeenCalledTimes(1);
  s.frame(5000); expect(s.onRoundEnd).toHaveBeenCalledTimes(1);
  s.screen.destroy();
});

test('confirming a new game from the pause menu reports it once', async () => {
  const onNewGame = vi.fn();
  const s = setup({}, 1, onNewGame); await s.screen.start();
  s.screen.pause();
  const overlay = s.root.querySelector<HTMLElement>('.pause-overlay')!;
  [...overlay.querySelectorAll('button')].find(b => b.textContent === 'משחק חדש')!.click();
  [...overlay.querySelectorAll('button')].find(b => b.textContent === 'כן, משחק חדש')!.click();
  expect(onNewGame).toHaveBeenCalledTimes(1);
  s.screen.destroy();
});
