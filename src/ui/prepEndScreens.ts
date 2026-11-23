import type { Miss } from '../prep/prepSession';
import type { Explanation } from '../prep/explain';
import type { PrepProblem } from '../prep/generate';
import { eq } from '../problems/rational';

const STORAGE_NOTICE = 'לא ניתן לשמור במכשיר הזה. אפשר לתרגל עכשיו, אבל החבילה לא תישמר.';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text: string, className: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', className, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/** Exercise text and steps read left to right inside the right-to-left page. */
function ltr<T extends HTMLElement>(node: T): T {
  node.dir = 'ltr';
  return node;
}

function stepList(steps: readonly string[]): HTMLOListElement {
  const list = ltr(el('ol', 'prep-steps'));
  list.append(...steps.map(s => el('li', undefined, s)));
  return list;
}

/** "The way" for up to three missed problems; each card offers one similar problem to try, without a score. */
export function renderPrepReview(root: HTMLElement, o: { items: Miss[]; explain(m: Miss): Explanation;
  makeTwin(m: Miss): PrepProblem; onDone(): void }): void {
  const main = el('main', 'prep prep-review');
  const panel = el('div', 'prep-panel');
  for (const m of o.items) panel.append(reviewCard(m, o));
  panel.append(button('המשך', 'primary', o.onDone));
  main.append(el('h1', undefined, 'הדרך'), panel);
  root.replaceChildren(main);
}

function reviewCard(m: Miss, o: { explain(m: Miss): Explanation; makeTwin(m: Miss): PrepProblem }): HTMLElement {
  const card = el('section', 'prep-review-card');
  const { steps, slip } = o.explain(m);
  const answer = el('p', 'prep-review-answer', 'התשובה: ');
  answer.append(ltr(el('bdi', undefined, m.problem.answer.text)));
  card.append(ltr(el('p', 'prep-review-exercise', m.problem.text)), answer, stepList(steps));
  if (slip !== null) card.append(el('p', 'prep-slip', slip));

  const twinBox = el('div', 'prep-twin');
  twinBox.append(button('ננסה אחד דומה', 'secondary', () => showTwin(twinBox, o.makeTwin(m), o.explain)));
  card.append(twinBox);
  return card;
}

/** One try: the right choice is praised and sunlit; any other choice shows the way and the answer, never a "wrong". */
function showTwin(box: HTMLElement, twin: PrepProblem, explain: (m: Miss) => Explanation): void {
  const result = el('p', 'prep-twin-result');
  result.setAttribute('aria-live', 'polite');
  const choices = el('div', 'prep-twin-choices');
  const buttons = twin.choices.map(c => {
    const b = ltr(button(c.text, 'prep-choice', () => {
      if (buttons.some(x => x.disabled)) return;
      buttons.forEach(x => { x.disabled = true; });
      const right = buttons[twin.choices.findIndex(x => eq(x.value, twin.answer.value))];
      right.classList.add('is-sunlit');
      if (b === right) result.textContent = 'יפה!';
      else box.append(stepList(explain({ problem: twin, picked: c.text }).steps));
    }));
    return b;
  });
  choices.append(...buttons);
  box.replaceChildren(ltr(el('p', 'prep-twin-exercise', twin.text)), choices, result);
  buttons[0]?.focus();
}

export function renderPrepSummary(root: HTMLElement, o: { packName: string; stars: number; asked: number; solved: number;
  perfect: boolean; saved: boolean; onAgain(): void; onBack(): void }): void {
  const main = el('main', 'prep prep-result');
  const panel = el('div', 'prep-panel');
  if (o.perfect) panel.append(el('p', 'prep-perfect', 'תרגול מושלם!'));
  panel.append(el('p', 'prep-stat', o.stars === 1 ? 'אספת כוכב אחד' : `אספת ${o.stars} כוכבים`), el('p', 'prep-stat', `פתרת ${o.solved} מתוך ${o.asked}`));
  if (!o.saved) panel.append(el('p', 'prep-notice', STORAGE_NOTICE));
  const actions = el('div', 'prep-actions');
  actions.append(button('עוד תרגול', 'primary', o.onAgain), button('חזרה לחבילות', 'secondary', o.onBack));
  panel.append(actions);
  main.append(el('h1', undefined, o.packName), panel);       // the pack name is player text: textContent
  root.replaceChildren(main);
}
