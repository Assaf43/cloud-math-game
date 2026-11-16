import { fetchWeather, randomWeather, weatherFromCode } from '../../src/weather/weather';
import { CITIES } from '../../src/weather/cities';
import { createRng } from '../../src/rng';

const ALL = ['clear', 'partly', 'cloudy', 'rain', 'storm', 'haze'];

test.each([[0, 'clear'], [2, 'partly'], [3, 'cloudy'], [45, 'haze'], [61, 'rain'], [73, 'rain'], [81, 'rain'], [95, 'storm'], [1234, null]])(
  'code %i maps to %s', (code, state) => expect(weatherFromCode(code)).toBe(state));

const ok = (body: unknown) => (async () => ({ ok: true, json: async () => body })) as unknown as typeof fetch;

test('uses the API value', async () =>
  expect(await fetchWeather(CITIES[0], createRng(1), ok({ current: { weather_code: 95 } }))).toBe('storm'));

test('requests the Open-Meteo forecast for the city coordinates', async () => {
  let url = '';
  const f = (async (u: string) => { url = u; return { ok: true, json: async () => ({ current: { weather_code: 0 } }) }; }) as unknown as typeof fetch;
  await fetchWeather(CITIES[1], createRng(1), f);
  expect(url).toBe(`https://api.open-meteo.com/v1/forecast?latitude=${CITIES[1].lat}&longitude=${CITIES[1].lon}&current=weather_code`);
});

test.each([
  ['network error', (async () => { throw new Error('offline'); }) as unknown as typeof fetch],
  ['http error', (async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch],
  ['malformed body', ok({ nope: true })],
  ['non-numeric code', ok({ current: { weather_code: 'x' } })],
  ['json that throws', (async () => ({ ok: true, json: async () => { throw new Error('bad json'); } })) as unknown as typeof fetch],
  ['unknown code', ok({ current: { weather_code: 1234 } })],
  ['never resolves', (() => new Promise(() => {})) as unknown as typeof fetch],
])('falls back to a random state on %s', async (_n, f) => {
  expect(ALL).toContain(await fetchWeather(CITIES[0], createRng(1), f, 50));
});

test('a slow response past the timeout falls back instead of waiting', async () => {
  const slow = (() => new Promise(res => setTimeout(() => res({ ok: true, json: async () => ({ current: { weather_code: 95 } }) }), 300))) as unknown as typeof fetch;
  const t0 = Date.now();
  const w = await fetchWeather(CITIES[0], createRng(1), slow, 40);
  expect(Date.now() - t0).toBeLessThan(250);
  expect(ALL).toContain(w);
});

test('randomWeather covers every state and is seeded', () => {
  const rng = createRng(5); const seen = new Set<string>();
  for (let i = 0; i < 300; i++) seen.add(randomWeather(rng));
  expect([...seen].sort()).toEqual([...ALL].sort());
  expect(randomWeather(createRng(2))).toBe(randomWeather(createRng(2)));
});

test('10 cities with unique ids and Hebrew names', () => {
  expect(CITIES).toHaveLength(10);
  expect(new Set(CITIES.map(c => c.id)).size).toBe(10);
  expect(CITIES.every(c => /[֐-׿]/.test(c.name) && c.hint.length > 0)).toBe(true);
});
