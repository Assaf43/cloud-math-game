import { startApp } from '../src/app';
import { Storage } from '../src/storage/storage';
import type { WeatherState } from '../src/types';

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
