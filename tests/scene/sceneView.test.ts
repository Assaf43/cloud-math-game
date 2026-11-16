import { skylineSvg } from '../../src/scene/skylines';
import { SceneView, BUMP_OVERHANG_RATIO } from '../../src/scene/sceneView';
import { readFileSync } from 'node:fs';
import { makeLane, slotLayout } from '../../src/scene/clouds';
import { CITIES } from '../../src/weather/cities';
import { createRng } from '../../src/rng';
import { decimalAnswer, fractionAnswer, intAnswer, rat } from '../../src/problems/rational';

test('every city has a skyline with no text', () => {
  for (const c of CITIES) {
    const svg = skylineSvg(c.id);
    expect(svg).toContain('<svg'); expect(svg).toContain('viewBox="0 0 1000 200"');
    expect(svg).not.toContain('<text'); expect(svg).not.toContain(c.name);
    expect(new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('parsererror')).toBeNull();
  }
});

function setup(count: 4 | 5 | 6 = 4) {
  const root = document.createElement('div'); const v = new SceneView(root);
  const slots = slotLayout(count); const lanes = slots.map(s => makeLane(s, createRng(1)));
  return { root, v, slots, lanes };
}

test('backdrop attributes and answers', () => {
  const { root, v, slots, lanes } = setup();
  v.setBackdrop('sunset', 'rain', 'haifa');
  expect(root.dataset.time).toBe('sunset'); expect(root.dataset.weather).toBe('rain');
  v.setAnswers([intAnswer(1), intAnswer(2), intAnswer(3), intAnswer(4)], slots, lanes); v.render(0);
  expect(root.querySelectorAll('[data-answer]')).toHaveLength(4);
  expect(root.querySelectorAll('.cloud').length).toBeGreaterThanOrEqual(4);
  v.highlight('3'); expect(root.querySelector('[data-answer="3"]')!.classList.contains('is-correct')).toBe(true);
});

test('the backdrop never contains the city name', () => {
  const { root, v } = setup();
  for (const c of CITIES) { v.setBackdrop('noon', 'clear', c.id); expect(root.textContent).not.toContain(c.name); expect(root.innerHTML).toContain('<svg'); }
});

test('answers are positioned in percent from the slot layout', () => {
  const { root, v, slots, lanes } = setup(5);
  v.setAnswers([1, 2, 3, 4, 5].map(intAnswer), slots, lanes); v.render(0);
  const el = root.querySelector<HTMLElement>('[data-answer="2"]')!;
  expect(el.style.left).toBe(`${slots[1].xPct}%`); expect(el.style.top).toBe(`${slots[1].yPct}%`); expect(el.style.width).toBe(`${slots[1].widthPct}%`);
});

test('fractions render stacked, mixed numbers with a whole part, and numbers are left-to-right', () => {
  const { root, v, slots, lanes } = setup();
  v.setAnswers([fractionAnswer(rat(3, 4)), fractionAnswer(rat(3, 2)), decimalAnswer(rat(5, 2)), intAnswer(7)], slots, lanes);
  const frac = root.querySelector('[data-answer="3/4"]')!;
  expect(frac.querySelector('.frac .num')!.textContent).toBe('3'); expect(frac.querySelector('.frac .den')!.textContent).toBe('4');
  const mixed = root.querySelector('[data-answer="1 1/2"]')!;
  expect(mixed.querySelector('.whole')!.textContent).toBe('1'); expect(mixed.querySelector('.frac .den')!.textContent).toBe('2');
  expect(root.querySelector('[data-answer="2.5"] bdi')!.getAttribute('dir')).toBe('ltr');
});

test('render moves clouds over time and only shows clouds that are on screen', () => {
  const { root, v, slots, lanes } = setup();
  v.setAnswers([1, 2, 3, 4].map(intAnswer), slots, lanes);
  v.render(0);
  const before = [...root.querySelectorAll<HTMLElement>('.cloud')].map(c => c.style.left + c.hidden);
  v.render(900);
  const after = [...root.querySelectorAll<HTMLElement>('.cloud')].map(c => c.style.left + c.hidden);
  expect(after).not.toEqual(before);
  expect([...root.querySelectorAll<HTMLElement>('.cloud')].some(c => !c.hidden)).toBe(true);
});

test('clear removes answers and clouds, setAnswers replaces the previous ones', () => {
  const { root, v, slots, lanes } = setup();
  v.setAnswers([1, 2, 3, 4].map(intAnswer), slots, lanes);
  v.setAnswers([5, 6, 7, 8].map(intAnswer), slots, lanes);
  expect(root.querySelectorAll('[data-answer]')).toHaveLength(4);
  expect(root.querySelector('[data-answer="1"]')).toBeNull();
  v.clear();
  expect(root.querySelectorAll('[data-answer]')).toHaveLength(0); expect(root.querySelectorAll('.cloud')).toHaveLength(0);
});

test.each([4, 5, 6] as const)('a cloud (with its bumps) never reaches the answer of the row above, for %i answers', count => {
  const { root, v, slots, lanes } = setup(count);
  v.setAnswers(Array.from({ length: count }, (_, i) => intAnswer(i)), slots, lanes);
  const ys = slots.map(s => s.yPct).sort((a, b) => a - b);
  const gap = Math.min(...ys.slice(1).map((y, i) => y - ys[i]));
  const answerH = parseFloat(root.querySelector<HTMLElement>('[data-answer]')!.style.height);
  const cloudH = parseFloat(root.querySelector<HTMLElement>('.cloud')!.style.height);
  expect(cloudH).toBeGreaterThanOrEqual(answerH);                       // a cloud still covers the whole answer
  expect(cloudH * (1 + BUMP_OVERHANG_RATIO)).toBeLessThanOrEqual(gap + 1e-9);
});

test('the CSS bump overhang matches BUMP_OVERHANG_RATIO', () => {
  const css = readFileSync('src/styles.css', 'utf8');
  const m = css.match(/\.cloud::before\s*\{[^}]*top:\s*-(\d+(?:\.\d+)?)%/);
  expect(m).not.toBeNull();
  expect(+m![1] / 100).toBeLessThanOrEqual(BUMP_OVERHANG_RATIO + 1e-9);
  const after = css.match(/\.cloud::after\s*\{[^}]*top:\s*-(\d+(?:\.\d+)?)%/);
  expect(+after![1] / 100).toBeLessThanOrEqual(BUMP_OVERHANG_RATIO + 1e-9);
});
