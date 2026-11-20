import type { Answer, TimeOfDay, WeatherState } from '../types';
import { cloudLefts, type Lane, type Slot } from './clouds';
import { skylineSvg } from './skylines';

const MAX_ROW_HEIGHT_PCT = 8.8;

/** Answer pill and cloud body share one height, capped so that neighbouring rows never touch. */
function rowHeightPct(slots: Slot[]): number {
  const ys = slots.map(s => s.yPct).sort((a, b) => a - b);
  const gap = Math.min(...ys.slice(1).map((y, i) => y - ys[i]), Infinity);
  return Math.min(MAX_ROW_HEIGHT_PCT, gap - 0.4);
}

/**
 * Cumulus puffs for a cloud, drawn BEHIND the answers: they are decoration only and may rise above the cloud body
 * without ever hiding another answer. The cloud body (in front) is what covers an answer.
 */
const PUFF_SHAPES: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>> = [
  [[14, 34, 9], [28, 26, 13], [46, 18, 15], [64, 22, 13], [80, 29, 11], [90, 35, 8], [50, 34, 14]],
  [[12, 35, 8], [24, 29, 11], [38, 22, 12], [55, 14, 13], [70, 22, 13], [84, 29, 11], [60, 34, 14]],
  [[16, 33, 10], [34, 24, 14], [52, 26, 12], [66, 16, 12], [82, 27, 12], [92, 35, 7], [44, 34, 13]],
];
const puffSvg = (variant: number): string => {
  const circles = PUFF_SHAPES[variant % PUFF_SHAPES.length].map(([cx, cy, r]) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" style="fill:var(--cloud-mid)"/>` +
    `<circle cx="${cx - r * 0.12}" cy="${cy - r * 0.18}" r="${r * 0.82}" style="fill:var(--cloud)"/>`).join('');
  return `<svg viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden="true" focusable="false">${circles}</svg>`;
};

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
  private readonly puffsLayer = el('div', 'scene-layer scene-puffs');
  private readonly answersLayer = el('div', 'scene-layer scene-answers');
  private readonly cloudsLayer = el('div', 'scene-layer scene-clouds');
  private lanes: Lane[] = [];
  private cloudEls: HTMLElement[][] = [];
  private puffEls: HTMLElement[][] = [];

  /** Called with the text of the answer the player taps (mouse click or finger). */
  onPick: ((answerText: string) => void) | null = null;
  private readonly root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    root.classList.add('scene');
    const weather = el('div', 'scene-weather');
    weather.append(el('div', 'scene-sun'), el('div', 'scene-veil'), el('div', 'scene-rain'), el('div', 'scene-flash'));
    root.replaceChildren(weather, this.skyline, this.puffsLayer, this.answersLayer, this.cloudsLayer);
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
    const rowHeight = +rowHeightPct(slots).toFixed(3);
    this.root.style.setProperty('--row-cap', String(rowHeight));     // CSS keeps pills and clouds within one row
    choices.forEach((choice, i) => {
      const slot = slots[i];
      const a = el('button', 'answer');
      a.type = 'button';
      a.addEventListener('click', () => this.onPick?.(choice.text));
      a.dataset.answer = choice.text;
      a.style.left = `${slot.xPct}%`;
      a.style.top = `${slot.yPct}%`;
      a.style.width = `${slot.widthPct}%`;
      a.append(answerContent(choice));
      this.answersLayer.append(a);

      const lane = lanes[i];
      const perLane = Math.ceil((100 + lane.cloudWidthPct) / (lane.cloudWidthPct + lane.gapPct)) + 1;
      const row: HTMLElement[] = [];
      const puffRow: HTMLElement[] = [];
      for (let k = 0; k < perLane; k++) {
        const place = (node: HTMLElement) => {
          node.style.top = `${slot.yPct}%`;
          node.style.width = `${lane.cloudWidthPct}%`;
          node.hidden = true;
        };
        const c = el('div', 'cloud');
        place(c);
        const puff = el('div', 'cloud-puff');
        puff.innerHTML = puffSvg(i + k);                       // static markup from this code base
        place(puff);
        row.push(c); puffRow.push(puff);
        this.cloudsLayer.append(c);
        this.puffsLayer.append(puff);
      }
      this.puffEls.push(puffRow);
      this.cloudEls.push(row);
    });
  }

  render(tMs: number): void {
    this.lanes.forEach((lane, i) => {
      const lefts = cloudLefts(lane, tMs);
      this.cloudEls[i].forEach((c, k) => {
        const p = this.puffEls[i][k];
        if (k < lefts.length) {
          c.hidden = false; p.hidden = false;
          c.style.left = `${lefts[k]}%`; p.style.left = `${lefts[k]}%`;
        } else { c.hidden = true; p.hidden = true; }
      });
    });
  }

  /** Marks the answer the player tapped when it was wrong. */
  markWrong(answerText: string): void {
    for (const a of this.answersLayer.querySelectorAll<HTMLElement>('[data-answer]'))
      if (a.dataset.answer === answerText) a.classList.add('is-wrong');
  }

  /** Marks the correct answer; it is drawn above the clouds so it is readable. */
  highlight(answerText: string): void {
    for (const a of this.answersLayer.querySelectorAll<HTMLElement>('[data-answer]'))
      if (a.dataset.answer === answerText) a.classList.add('is-correct');
  }

  /** Practice only: the clouds part and a sun ray lights the right answer; `big` adds a burst of stars (a returning problem). */
  celebrate(answerText: string, big: boolean): void {
    this.root.classList.add('is-celebrating');
    this.root.classList.toggle('is-celebrating-big', big);
    for (const a of this.answersLayer.querySelectorAll<HTMLElement>('[data-answer]'))
      if (a.dataset.answer === answerText) a.classList.add('is-sunlit');
  }

  /** Practice only: darker clouds while a returning problem is open. */
  setStubborn(on: boolean): void {
    this.root.classList.toggle('is-stubborn', on);
  }

  clear(): void {
    this.root.classList.remove('is-celebrating', 'is-celebrating-big');
    this.answersLayer.replaceChildren();
    this.cloudsLayer.replaceChildren();
    this.puffsLayer.replaceChildren();
    this.lanes = [];
    this.cloudEls = [];
    this.puffEls = [];
  }
}
