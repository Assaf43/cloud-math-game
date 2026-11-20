import { startApp } from '../src/app';
import { Storage } from '../src/storage/storage';
import type { WeatherState } from '../src/types';
import { packShapes } from '../src/prep/pack';
import { PrepSession } from '../src/prep/prepSession';
import { evalText } from './problems/evalText';

function memory() {
  const data: Record<string, string> = {};
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; } };
}

let t = 0;
function boot(storage = new Storage(memory())) {
  const root = document.createElement('div'); document.body.append(root);
  const audio = { start: vi.fn(), playSuccess: vi.fn(), pauseMusic: vi.fn(), resumeMusic: vi.fn(), setMuted: vi.fn(), muted: false };
  let seed = 100;
  startApp(root, {
    storage, audio, now: () => t, roundCardMs: 0,
    fetchWeather: vi.fn(async (): Promise<WeatherState> => 'cloudy'), seed: () => seed++,
  });
  return { root, audio, storage };
}
const set = (el: HTMLInputElement | HTMLSelectElement, v: string) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => { vi.useFakeTimers(); t = 0; });
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

/** Lets every problem of the round time out, which is the quickest way through a round. */
async function playRoundByTimeouts(root: HTMLElement) {
  for (let i = 0; i < 12 && !root.querySelector('.summary'); i++) {
    t += 30000; await vi.advanceTimersByTimeAsync(20);
    await vi.advanceTimersByTimeAsync(1500);
  }
}

test('a whole one-round game: setup -> game -> summary -> city -> final -> setup', async () => {
  const { root, audio, storage } = boot();
  expect(root.querySelector('h1')!.textContent).toBe('חשבון בעננים');
  set(root.querySelector<HTMLInputElement>('[name=name]')!, 'נועה');
  set(root.querySelector<HTMLSelectElement>('[name=rounds]')!, '1');
  root.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
  expect(audio.start).toHaveBeenCalledTimes(1);
  await flush();
  expect(root.querySelector('.game')).not.toBeNull();
  expect(root.querySelector('.scene')!.getAttribute('data-weather')).toBe('cloudy');

  await playRoundByTimeouts(root);
  expect(root.querySelector('.summary')!.textContent).toContain('סיכום סבב 1');
  [...root.querySelectorAll('button')].find(b => b.textContent === 'המשך')!.click();

  expect(root.querySelector('.city-bonus')).not.toBeNull();
  root.querySelector<HTMLButtonElement>('button[data-city]')!.click();
  await vi.advanceTimersByTimeAsync(1500);

  expect(root.querySelector('.final')).not.toBeNull();
  expect(audio.pauseMusic).toHaveBeenCalled();
  expect(storage.topScores()).toHaveLength(1);
  expect(storage.profiles()).toEqual([{ name: 'נועה', age: 10, grade: 5 }]);

  [...root.querySelectorAll('button')].find(b => b.textContent === 'שחק שוב')!.click();
  expect(root.querySelector('h1')!.textContent).toBe('חשבון בעננים');
  expect(root.querySelector<HTMLSelectElement>('[name=profile]')!.options).toHaveLength(2);
});

test('with two rounds the second round starts after the city question, with a different city', async () => {
  const { root } = boot();
  set(root.querySelector<HTMLInputElement>('[name=name]')!, 'דן');
  set(root.querySelector<HTMLSelectElement>('[name=rounds]')!, '2');
  root.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
  await flush();
  await playRoundByTimeouts(root);
  [...root.querySelectorAll('button')].find(b => b.textContent === 'המשך')!.click();
  const firstHint = root.querySelector('.city-hint')!.textContent;
  root.querySelector<HTMLButtonElement>('button[data-city]')!.click();
  await vi.advanceTimersByTimeAsync(1500);
  expect(root.querySelector('.game')).not.toBeNull();
  expect(root.querySelector('.status-round')!.textContent).toBe('סבב 2 מתוך 2');
  await playRoundByTimeouts(root);
  [...root.querySelectorAll('button')].find(b => b.textContent === 'המשך')!.click();
  expect(root.querySelector('.city-hint')!.textContent).not.toBe(firstHint);
});

test('the mute choice made in the game is saved on the device', async () => {
  const { root, storage } = boot();
  set(root.querySelector<HTMLInputElement>('[name=name]')!, 'נועה');
  root.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
  await flush();
  root.querySelector<HTMLButtonElement>('.mute-btn')!.click();
  expect(storage.muted()).toBe(true);
});

test('the app works when device storage is unavailable', async () => {
  const { root } = boot(new Storage(null));
  set(root.querySelector<HTMLInputElement>('[name=name]')!, 'נועה');
  set(root.querySelector<HTMLSelectElement>('[name=rounds]')!, '1');
  root.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
  await flush();
  await playRoundByTimeouts(root);
  [...root.querySelectorAll('button')].find(b => b.textContent === 'המשך')!.click();
  root.querySelector<HTMLButtonElement>('button[data-city]')!.click();
  await vi.advanceTimersByTimeAsync(1500);
  expect(root.querySelector('.final')).not.toBeNull();
});

function visibility(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

test('music stops while the tab is hidden on the summary and city screens, and returns afterwards', async () => {
  const { root, audio } = boot();
  set(root.querySelector<HTMLInputElement>('[name=name]')!, 'נועה');
  set(root.querySelector<HTMLSelectElement>('[name=rounds]')!, '1');
  root.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
  await flush();
  await playRoundByTimeouts(root);
  expect(root.querySelector('.summary')).not.toBeNull();
  audio.pauseMusic.mockClear(); audio.resumeMusic.mockClear();
  visibility(true);
  expect(audio.pauseMusic).toHaveBeenCalledTimes(1);
  visibility(false);
  expect(audio.resumeMusic).toHaveBeenCalledTimes(1);
  delete (document as unknown as Record<string, unknown>).hidden;
});

test('no music is started by visibility changes on the setup screen or after the game', async () => {
  const { root, audio } = boot();
  visibility(true); visibility(false);
  expect(audio.resumeMusic).not.toHaveBeenCalled();
  delete (document as unknown as Record<string, unknown>).hidden;
  expect(root.querySelector('h1')).not.toBeNull();
});

test('after the tab was hidden during a problem, music comes back only when the child resumes', async () => {
  const { root, audio } = boot();
  set(root.querySelector<HTMLInputElement>('[name=name]')!, 'נועה');
  root.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
  await flush();
  audio.resumeMusic.mockClear();
  visibility(true); visibility(false);
  expect(audio.resumeMusic).not.toHaveBeenCalled();                  // the pause overlay is up
  root.querySelector<HTMLButtonElement>('.pause-overlay button')!.click();
  expect(audio.resumeMusic).toHaveBeenCalled();
  delete (document as unknown as Record<string, unknown>).hidden;
});

test('a new game can be started from the pause menu without reloading, and the old game is gone', async () => {
  const { root, audio } = boot();
  set(root.querySelector<HTMLInputElement>('[name=name]')!, 'נועה');
  root.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
  await flush();
  root.querySelector<HTMLButtonElement>('.pause-btn')!.click();
  const byText = (t: string) => [...root.querySelectorAll('button')].find(b => b.textContent === t)!;
  byText('משחק חדש').click(); byText('כן, משחק חדש').click();
  expect(root.querySelector('h1')!.textContent).toBe('חשבון בעננים');
  expect(root.querySelector('.game')).toBeNull();
  expect(audio.pauseMusic).toHaveBeenCalled();
  // time passing does not touch the abandoned game, and a fresh game starts normally
  t += 120000; await vi.advanceTimersByTimeAsync(5000);
  expect(root.querySelector('.game')).toBeNull();
  set(root.querySelector<HTMLInputElement>('[name=name]')!, 'דן');
  root.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
  await flush();
  expect(root.querySelector('.status-round')!.textContent).toBe('סבב 1 מתוך 3');
  expect(root.querySelector('.status-name')!.textContent).toBe('דן');
});

test('a new game can be started from the round summary and from the city question', async () => {
  const { root } = boot();
  set(root.querySelector<HTMLInputElement>('[name=name]')!, 'נועה');
  root.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
  await flush(); await playRoundByTimeouts(root);
  const byText = (t: string) => [...root.querySelectorAll('button')].find(b => b.textContent === t)!;
  byText('משחק חדש').click(); byText('כן, משחק חדש').click();
  expect(root.querySelector('h1')).not.toBeNull();
  // again, from the city question
  set(root.querySelector<HTMLInputElement>('[name=name]')!, 'נועה');
  root.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
  await flush(); await playRoundByTimeouts(root);
  byText('המשך').click();
  expect(root.querySelector('.city-bonus')).not.toBeNull();
  byText('משחק חדש').click(); byText('כן, משחק חדש').click();
  expect(root.querySelector('h1')!.textContent).toBe('חשבון בעננים');
  await vi.advanceTimersByTimeAsync(5000);
  expect(root.querySelector('.city-bonus')).toBeNull();
});

// ---- test prep (הכנה למבחן) ----------------------------------------------------------------------

const EXAMPLES = ['48 × 6', '52 × 7', '36 + 47'];
const buttonByText = (root: HTMLElement, text: string) => [...root.querySelectorAll('button')].find(b => b.textContent === text);

function openPacks(root: HTMLElement, name = 'נועה') {
  set(root.querySelector<HTMLInputElement>('[name=name]')!, name);
  buttonByText(root, 'הכנה למבחן')!.click();
}

function fillEditor(root: HTMLElement, packName: string, examples: string[]) {
  set(root.querySelector<HTMLInputElement>('input[name=pack-name]')!, packName);
  const rows = [...root.querySelectorAll<HTMLInputElement>('input.prep-row')];
  examples.forEach((e, i) => set(rows[i], e));
  buttonByText(root, 'שמירה')!.click();
}

/** The right answer of the problem on screen, recomputed from its text (the test packs are whole-number only). */
function rightAnswer(root: HTMLElement): string {
  const v = evalText(root.querySelector('.problem')!.textContent!)!;
  expect(v.d).toBe(1);
  return String(v.n);
}

async function answer(root: HTMLElement, correct: boolean) {
  const right = rightAnswer(root);
  const el = correct ? root.querySelector<HTMLElement>(`[data-answer="${right}"]`)!
    : [...root.querySelectorAll<HTMLElement>('[data-answer]')].find(a => a.dataset.answer !== right)!;
  el.click();
  await vi.advanceTimersByTimeAsync(1500);
}

/** Answers every problem of the practice; `missFirst` answers the first one with another choice. */
async function playPractice(root: HTMLElement, missFirst = false) {
  for (let i = 0; i < 30 && root.querySelector('.game'); i++) await answer(root, !(missFirst && i === 0));
}

async function startPractice(root: HTMLElement) {
  openPacks(root);
  buttonByText(root, 'חבילה חדשה')!.click();
  fillEditor(root, 'מבחן כפל', EXAMPLES);
  buttonByText(root, 'שחק')!.click();
  await flush();
}

test('the prep button on the setup screen opens the pack list, and חזרה returns to setup', () => {
  const { root } = boot();
  openPacks(root);
  expect(root.querySelector('h1')!.textContent).toBe('הכנה למבחן');
  expect(root.querySelector('.prep-packs')).not.toBeNull();
  buttonByText(root, 'חזרה')!.click();
  expect(root.querySelector('h1')!.textContent).toBe('חשבון בעננים');
});

test('creating a pack with 3 valid lines stores it and lists it', () => {
  const { root, storage } = boot();
  openPacks(root);
  buttonByText(root, 'חבילה חדשה')!.click();
  expect(root.querySelector('h1')!.textContent).toBe('חבילה חדשה');
  fillEditor(root, 'מבחן כפל', EXAMPLES);
  const stored = storage.packs('נועה');
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({ owner: 'נועה', name: 'מבחן כפל', grade: 5, examples: EXAMPLES, shapes: {}, lastStars: null });
  expect(stored[0].id).toMatch(/^[0-9a-z]+$/);
  expect(Number.isNaN(Date.parse(stored[0].createdAt))).toBe(false);
  expect(root.querySelector('h1')!.textContent).toBe('הכנה למבחן');
  expect([...root.querySelectorAll('.prep-pack-name')].map(h => h.textContent)).toEqual(['מבחן כפל']);
});

test('ביטול in the editor returns to the pack list without saving', () => {
  const { root, storage } = boot();
  openPacks(root);
  buttonByText(root, 'חבילה חדשה')!.click();
  buttonByText(root, 'ביטול')!.click();
  expect(root.querySelector('.prep-packs')).not.toBeNull();
  expect(storage.packs('נועה')).toEqual([]);
});

test('שחק starts music and a game with a hidden timer', async () => {
  const { root, audio } = boot();
  await startPractice(root);
  expect(audio.start).toHaveBeenCalledTimes(1);
  expect(root.querySelector('.game')).not.toBeNull();
  expect(root.querySelector<HTMLElement>('.timer')!.hidden).toBe(true);
  expect(root.querySelector('.status-round')!.textContent).toBe('מבחן כפל');
  t += 120000; await vi.advanceTimersByTimeAsync(5000);              // no timer: time passing changes nothing
  expect(root.querySelector('.status-problem')!.textContent).toBe('תרגיל 1');
});

test('all problems right: the summary without a review, lastStars 10, and no score entry', async () => {
  const { root, storage, audio } = boot();
  const addScore = vi.spyOn(storage, 'addScore');
  const before = storage.topScores();
  await startPractice(root);
  await playPractice(root);
  expect(root.querySelector('.prep-review')).toBeNull();
  expect(root.querySelector('.prep-result')).not.toBeNull();
  expect(root.textContent).toContain('אספת 10 כוכבים');
  expect(root.textContent).toContain('פתרת 10 מתוך 10');
  expect(root.textContent).toContain('תרגול מושלם!');
  expect(root.querySelector('.prep-notice')).toBeNull();
  expect(audio.pauseMusic).toHaveBeenCalled();
  const pack = storage.packs('נועה')[0];
  expect(pack.lastStars).toBe(10);
  expect(Object.values(pack.shapes).reduce((n, s) => n + s.seen, 0)).toBe(10);
  expect(Object.values(pack.shapes).every(s => s.wrong === 0 && !s.lastMissed)).toBe(true);
  expect(storage.topScores()).toEqual(before);
  expect(addScore).not.toHaveBeenCalled();
});

test('a practice with a miss goes through the review first, then the summary', async () => {
  const { root, storage } = boot();
  const addScore = vi.spyOn(storage, 'addScore');
  await startPractice(root);
  await playPractice(root, true);
  expect(root.querySelector('.prep-review')).not.toBeNull();
  expect(root.querySelector('h1')!.textContent).toBe('הדרך');
  expect(root.querySelectorAll('.prep-review-card')).toHaveLength(1);
  expect(root.querySelectorAll('.prep-review-card ol.prep-steps li').length).toBeGreaterThan(0);
  buttonByText(root, 'ננסה אחד דומה')!.click();
  expect(root.querySelectorAll('.prep-review-card button.prep-choice').length).toBeGreaterThan(3);
  buttonByText(root, 'המשך')!.click();
  expect(root.querySelector('.prep-result')).not.toBeNull();
  expect(root.textContent).toContain('אספת 11 כוכבים');                // 9 + the returning problem's 2
  expect(root.textContent).toContain('פתרת 10 מתוך 11');
  expect(root.textContent).not.toContain('תרגול מושלם!');
  const pack = storage.packs('נועה')[0];
  expect(pack.lastStars).toBe(11);
  expect(Object.values(pack.shapes).reduce((n, s) => n + s.seen, 0)).toBe(11);
  expect(Object.values(pack.shapes).reduce((n, s) => n + s.wrong, 0)).toBe(1);
  expect(storage.topScores()).toEqual([]);
  expect(addScore).not.toHaveBeenCalled();
});

test('עוד תרגול starts a new practice of the same pack; חזרה לחבילות returns to the list with the stars', async () => {
  const { root, audio } = boot();
  await startPractice(root);
  await playPractice(root);
  buttonByText(root, 'עוד תרגול')!.click();
  await flush();
  expect(audio.start).toHaveBeenCalledTimes(2);
  expect(root.querySelector('.game')).not.toBeNull();
  expect(root.querySelector('.status-round')!.textContent).toBe('מבחן כפל');
  expect(root.querySelector('.status-problem')!.textContent).toBe('תרגיל 1');
  expect(root.querySelector('.status-score')!.textContent).toBe('⭐ 0');
  await playPractice(root);
  buttonByText(root, 'חזרה לחבילות')!.click();
  expect(root.querySelector('.prep-packs')).not.toBeNull();
  expect(root.querySelector('.prep-pack-stars')!.textContent).toBe('⭐ 10');
});

test('pause -> משחק חדש mid-practice returns to setup and leaves the pack untouched', async () => {
  const { root, storage, audio } = boot();
  await startPractice(root);
  await answer(root, false); await answer(root, true); await answer(root, true);
  root.querySelector<HTMLButtonElement>('.pause-btn')!.click();
  buttonByText(root, 'משחק חדש')!.click(); buttonByText(root, 'כן, משחק חדש')!.click();
  expect(root.querySelector('h1')!.textContent).toBe('חשבון בעננים');
  expect(root.querySelector('.game')).toBeNull();
  expect(audio.pauseMusic).toHaveBeenCalled();
  t += 120000; await vi.advanceTimersByTimeAsync(5000);
  const pack = storage.packs('נועה')[0];
  expect(pack.shapes).toEqual({});
  expect(pack.lastStars).toBeNull();
  expect(storage.topScores()).toEqual([]);
});

test('when the device cannot store the pack, a practice starts at once and the summary shows the notice', async () => {
  const storage = new Storage({ getItem: () => null, setItem: () => { throw new Error('quota'); } });
  const record = vi.spyOn(storage, 'recordPractice');
  const { root, audio } = boot(storage);
  openPacks(root);
  buttonByText(root, 'חבילה חדשה')!.click();
  fillEditor(root, 'מבחן כפל', EXAMPLES);
  expect(audio.start).toHaveBeenCalledTimes(1);
  await flush();
  expect(root.querySelector('.game')).not.toBeNull();
  await playPractice(root);
  expect(root.querySelector('.prep-notice')!.textContent).toBe('לא ניתן לשמור במכשיר הזה. אפשר לתרגל עכשיו, אבל החבילה לא תישמר.');
  expect(record).not.toHaveBeenCalled();
  buttonByText(root, 'עוד תרגול')!.click();                            // the unsaved pack can be practised again
  await flush();
  expect(root.querySelector('.game')).not.toBeNull();
  await playPractice(root);
  expect(root.querySelector('.prep-notice')).not.toBeNull();
  expect(record).not.toHaveBeenCalled();
  buttonByText(root, 'חזרה לחבילות')!.click();
  expect(root.querySelector('.prep-packs')).not.toBeNull();
});

test('when no practice can be made from the pack, שחק stays on the pack list: no blank game, no music, nothing recorded', async () => {
  const { root, audio, storage } = boot();
  openPacks(root);
  buttonByText(root, 'חבילה חדשה')!.click();
  fillEditor(root, 'מבחן כפל', EXAMPLES);
  const record = vi.spyOn(storage, 'recordPractice');
  // forces the real constructor path "no first problem": every draw comes back empty
  const generate = vi.spyOn(PrepSession.prototype as unknown as { generate: () => null }, 'generate').mockReturnValue(null);
  buttonByText(root, 'שחק')!.click();
  await flush();
  expect(generate).toHaveBeenCalled();
  expect(root.querySelector('.game')).toBeNull();
  expect(root.querySelector('.prep-packs')).not.toBeNull();
  expect(audio.start).not.toHaveBeenCalled();
  t += 120000; await vi.advanceTimersByTimeAsync(5000);
  expect(audio.resumeMusic).not.toHaveBeenCalled();
  document.dispatchEvent(new Event('visibilitychange'));               // the music flag was never set
  expect(audio.resumeMusic).not.toHaveBeenCalled();
  expect(record).not.toHaveBeenCalled();
  expect(storage.packs('נועה')[0]).toMatchObject({ shapes: {}, lastStars: null });
  generate.mockRestore();
});

test('editing a pack keeps its id, date, owner, grade and stars, and the stats of the kinds still in it', () => {
  const storage = new Storage(memory());
  const [mul, add] = packShapes({ examples: ['48 × 6', '36 + 47'], grade: 4 }).map(s => s.key);
  storage.savePack({
    id: 'old1', owner: 'נועה', name: 'ישנה', grade: 4, examples: ['48 × 6', '52 × 7', '36 + 47'], createdAt: '2026-11-01T08:00:00.000Z',
    shapes: { [mul]: { seen: 6, wrong: 2, lastMissed: true }, [add]: { seen: 4, wrong: 0, lastMissed: false } }, lastStars: 7,
  });
  const { root } = boot(storage);
  openPacks(root);                                                     // the player is in grade 5, the pack keeps grade 4
  buttonByText(root, 'עריכה')!.click();
  expect(root.querySelector('h1')!.textContent).toBe('עריכת חבילה');
  fillEditor(root, 'חדשה', ['48 × 6', '52 × 7', '61 × 3']);
  const [pack] = storage.packs('נועה');
  expect(pack).toEqual({
    id: 'old1', owner: 'נועה', name: 'חדשה', grade: 4, examples: ['48 × 6', '52 × 7', '61 × 3'], createdAt: '2026-11-01T08:00:00.000Z',
    shapes: { [mul]: { seen: 6, wrong: 2, lastMissed: true } }, lastStars: 7,
  });
  expect(root.querySelector('.prep-packs')).not.toBeNull();
});

test('deleting a pack removes it from the device and from the list', () => {
  const { root, storage } = boot();
  openPacks(root);
  buttonByText(root, 'חבילה חדשה')!.click();
  fillEditor(root, 'מבחן כפל', EXAMPLES);
  buttonByText(root, 'מחיקה')!.click(); buttonByText(root, 'כן, למחוק')!.click();
  expect(storage.packs('נועה')).toEqual([]);
  expect(root.querySelector('.prep-pack')).toBeNull();
  expect(root.querySelector('.prep-packs')).not.toBeNull();
});
