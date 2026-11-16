import type { City, Rng, WeatherState } from '../types';
import { pick } from '../rng';

const STATES: readonly WeatherState[] = ['clear', 'partly', 'cloudy', 'rain', 'storm', 'haze'];

/** WMO weather interpretation code -> background state, or null when the code is not one we map. */
export function weatherFromCode(code: number): WeatherState | null {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'haze';
  if ((code >= 51 && code <= 67) || (code >= 71 && code <= 77) || (code >= 80 && code <= 86)) return 'rain';
  if (code >= 95 && code <= 99) return 'storm';
  return null;
}

export function randomWeather(rng: Rng): WeatherState {
  return pick(rng, STATES);
}

/**
 * Current weather for the city from Open-Meteo (no key, nothing about the player is sent).
 * Never rejects: any failure, malformed answer or a response slower than `timeoutMs` yields a random state.
 */
export async function fetchWeather(
  city: City,
  rng: Rng,
  fetchFn: typeof fetch | undefined = globalThis.fetch,
  timeoutMs = 3000,
): Promise<WeatherState> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<null>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(null); }, timeoutMs); });
  const request = (async (): Promise<WeatherState | null> => {
    try {
      if (!fetchFn) return null;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=weather_code`;
      const res = await fetchFn(url, { signal: controller.signal });
      if (!res.ok) return null;
      const body: unknown = await res.json();
      const code = (body as { current?: { weather_code?: unknown } } | null)?.current?.weather_code;
      return typeof code === 'number' ? weatherFromCode(code) : null;
    } catch {
      return null;
    }
  })();
  try {
    return (await Promise.race([request, timedOut])) ?? randomWeather(rng);
  } finally {
    clearTimeout(timer);
  }
}
