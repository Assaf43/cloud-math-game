import type { Answer, TimeOfDay, WeatherState } from '../types';
import { cloudLefts, type Lane, type Slot } from './clouds';
import { skylineSvg } from './skylines';

const ANSWER_HEIGHT_PCT = 8.8;
const CLOUD_HEIGHT_PCT = 9;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Answer content: numbers are always left-to-right, fractions are stacked, mixed numbers have a whole part. */
function answerContent(a: Answer): HTMLElement {
  const bdi = el('bdi');
  bdi.dir = 'ltr';
  const m = a.text.match(/^(?:(\d+) )?(\d+)\/(\d+)$/);
  if (!m) { bdi.textContent = a.text; return bdi; }
  if (m[1]) bdi.append(el('span', 'whole', m[1]));
  const frac = el('span', 'frac');
  frac.append(el('span', 'num', m[2]), el('span', 'den', m[3]));
  bdi.append(frac);
  return bdi;
}

/**
 * Background (time of day, weather, city skyline), the answers and the clouds that drift over them.
 * Everything is positioned in percent of the scene, so it follows the scene's size.
 * Weather and time only restyle the picture (through data attributes and CSS); they never touch cloud motion.
 */
export class SceneView {
  private readonly skyline = el('div', 'scene-skyline');
  private readonly answersLayer = el('div', 'scene-layer scene-answers');
  private readonly cloudsLayer = el('div', 'scene-layer scene-clouds');
  private lanes: Lane[] = [];
  private cloudEls: HTMLElement[][] = [];

  private readonly root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    root.classList.add('scene');
    const weather = el('div', 'scene-weather');
    weather.append(el('div', 'scene-sun'), el('div', 'scene-veil'), el('div', 'scene-rain'), el('div', 'scene-flash'));
    root.replaceChildren(weather, this.skyline, this.answersLayer, this.cloudsLayer);
  }

  setBackdrop(time: TimeOfDay, weather: WeatherState, cityId: string): void {
    this.root.dataset.time = time;
    this.root.dataset.weather = weather;
    this.root.dataset.city = cityId;
    this.skyline.innerHTML = skylineSvg(cityId);      // static markup from this code base, never player text
  }

  setAnswers(choices: Answer[], slots: Slot[], lanes: Lane[]): void {
    this.clear();
    this.lanes = lanes;
    choices.forEach((choice, i) => {
      const slot = slots[i];
      const a = el('div', 'answer');
      a.dataset.answer = choice.text;
      a.style.left = `${slot.xPct}%`;
      a.style.top = `${slot.yPct}%`;
      a.style.width = `${slot.widthPct}%`;
      a.style.height = `${ANSWER_HEIGHT_PCT}%`;
      a.append(answerContent(choice));
      this.answersLayer.append(a);

      const lane = lanes[i];
      const perLane = Math.ceil((100 + lane.cloudWidthPct) / (lane.cloudWidthPct + lane.gapPct)) + 1;
      const row: HTMLElement[] = [];
      for (let k = 0; k < perLane; k++) {
        const c = el('div', 'cloud');
        c.style.top = `${slot.yPct}%`;
        c.style.height = `${CLOUD_HEIGHT_PCT}%`;
        c.style.width = `${lane.cloudWidthPct}%`;
        c.hidden = true;
        row.push(c);
        this.cloudsLayer.append(c);
      }
      this.cloudEls.push(row);
    });
  }

  render(tMs: number): void {
    this.lanes.forEach((lane, i) => {
      const lefts = cloudLefts(lane, tMs);
      this.cloudEls[i].forEach((c, k) => {
        if (k < lefts.length) { c.hidden = false; c.style.left = `${lefts[k]}%`; } else c.hidden = true;
      });
    });
  }

  /** Marks the correct answer; it is drawn above the clouds so it is readable. */
  highlight(answerText: string): void {
    for (const a of this.answersLayer.querySelectorAll<HTMLElement>('[data-answer]'))
      if (a.dataset.answer === answerText) a.classList.add('is-correct');
  }

  clear(): void {
    this.answersLayer.replaceChildren();
    this.cloudsLayer.replaceChildren();
    this.lanes = [];
    this.cloudEls = [];
  }
}
