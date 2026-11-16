import type { TimeOfDay, WeatherState } from '../types';
import { CITIES } from '../weather/cities';
import { SceneView } from '../scene/sceneView';
import { makeLane, slotLayout } from '../scene/clouds';
import { createRng } from '../rng';
import { decimalAnswer, fractionAnswer, intAnswer, rat } from '../problems/rational';

const TIMES: TimeOfDay[] = ['morning', 'noon', 'sunset', 'night'];
const WEATHERS: WeatherState[] = ['clear', 'partly', 'cloudy', 'rain', 'storm', 'haze'];

function select(label: string, options: [string, string][]): HTMLSelectElement {
  const s = document.createElement('select');
  s.setAttribute('aria-label', label);
  for (const [value, text] of options) s.append(new Option(text, value));
  return s;
}

/** `?debug=scene`: look at every time of day x weather x city, with live clouds and sample answers (kept for manual QA). */
export function renderDebugScene(root: HTMLElement): void {
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:8px;padding:8px;flex-wrap:wrap;direction:ltr;background:#fff;position:relative;z-index:10';
  const time = select('time', TIMES.map(t => [t, t]));
  const weather = select('weather', WEATHERS.map(w => [w, w]));
  const city = select('city', CITIES.map(c => [c.id, c.id]));
  const count = select('answers', [['4', '4 answers'], ['5', '5 answers'], ['6', '6 answers']]);
  bar.append(time, weather, city, count);

  const stage = document.createElement('div');
  stage.style.cssText = 'height:calc(100% - 52px)';
  root.replaceChildren(bar, stage);
  root.style.height = '100%';

  const view = new SceneView(stage);
  const rng = createRng(7);
  let t0 = performance.now();
  const apply = () => {
    view.setBackdrop(time.value as TimeOfDay, weather.value as WeatherState, city.value);
    const n = +count.value as 4 | 5 | 6;
    const slots = slotLayout(n);
    view.setAnswers([intAnswer(48), fractionAnswer(rat(3, 4)), fractionAnswer(rat(11, 4)), decimalAnswer(rat(5, 2)), intAnswer(1250), intAnswer(7)].slice(0, n),
      slots, slots.map(s => makeLane(s, rng)));
    t0 = performance.now();
  };
  for (const s of [time, weather, city, count]) s.addEventListener('change', apply);
  apply();
  const frame = () => { view.render(performance.now() - t0); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
}
