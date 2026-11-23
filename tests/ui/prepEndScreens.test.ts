import { readFileSync } from 'node:fs';
import { renderPrepReview, renderPrepSummary } from '../../src/ui/prepEndScreens';
import { analyze } from '../../src/prep/shape';
import { generateSimilar } from '../../src/prep/generate';
import type { PrepProblem } from '../../src/prep/generate';
import type { Miss } from '../../src/prep/prepSession';
import type { Explanation } from '../../src/prep/explain';
import { createRng } from '../../src/rng';

const rng = createRng(7);
function problem(example: string): PrepProblem {
  const a = analyze(example);
  if (!a.ok) throw new Error(`not supported: ${example}`);
  return generateSimilar(a.shape, 'beginner', 5, rng, new Set())!;
}
const missOf = (example: string): Miss => {
  const p = problem(example);
  return { problem: p, picked: p.choices.find(c => c.text !== p.answer.text)!.text };
};

function setupReview(items: Miss[], twins: PrepProblem[]) {
  const root = document.createElement('div'); document.body.append(root);
  const explain = vi.fn((m: Miss): Explanation =>
    m.problem === items[0]?.problem ? { steps: ['40 × 6 = 240', '8 × 6 = 48', '240 + 48 = 288'], slip: 'שכחת להוסיף את העשרות' }
      : twins.includes(m.problem) ? { steps: ['twin step 1', 'twin step 2'], slip: null }
        : { steps: ['30 + 40 = 70', '6 + 7 = 13', '70 + 13 = 83'], slip: null });
  const makeTwin = vi.fn((m: Miss) => twins[items.indexOf(m)]);
  const onDone = vi.fn();
  renderPrepReview(root, { items, explain, makeTwin, onDone });
  const cards = () => [...root.querySelectorAll<HTMLElement>('.prep-review-card')];
  const byText = (t: string, scope: ParentNode = root) => [...scope.querySelectorAll('button')].find(b => b.textContent === t)!;
  return { root, explain, makeTwin, onDone, cards, byText };
}
afterEach(() => { document.body.innerHTML = ''; });

test('the review has the title הדרך and one card per item with the exercise, the answer and the steps in order', () => {
  const items = [missOf('48 × 6'), missOf('36 + 47')];
  const { root, cards, explain } = setupReview(items, [problem('48 × 6'), problem('36 + 47')]);
  expect(root.querySelector('h1')!.textContent).toBe('הדרך');
  expect(cards()).toHaveLength(2);
  expect(explain).toHaveBeenCalledWith(items[0]);
  expect(explain).toHaveBeenCalledWith(items[1]);
  const [first, second] = cards();
  expect(first.querySelector('.prep-review-exercise')!.textContent).toBe(items[0].problem.text);
  expect(first.querySelector<HTMLElement>('.prep-review-exercise')!.dir).toBe('ltr');
  expect(first.querySelector('.prep-review-answer')!.textContent).toBe(`התשובה: ${items[0].problem.answer.text}`);
  const steps = (card: HTMLElement) => [...card.querySelectorAll('ol.prep-steps li')].map(li => li.textContent);
  expect(steps(first)).toEqual(['40 × 6 = 240', '8 × 6 = 48', '240 + 48 = 288']);
  expect(steps(second)).toEqual(['30 + 40 = 70', '6 + 7 = 13', '70 + 13 = 83']);
  expect(first.querySelector<HTMLElement>('ol.prep-steps')!.dir).toBe('ltr');
});

test('the slip sentence appears only when explain returns one', () => {
  const { cards } = setupReview([missOf('48 × 6'), missOf('36 + 47')], [problem('48 × 6'), problem('36 + 47')]);
  const [first, second] = cards();
  expect(first.querySelector('.prep-slip')!.textContent).toBe('שכחת להוסיף את העשרות');
  expect(second.querySelector('.prep-slip')).toBeNull();
});

test('ננסה אחד דומה shows a new exercise with plain choice buttons; the right one gives יפה! and the sunlit style', () => {
  const items = [missOf('48 × 6')];
  const twin = problem('48 × 6');
  const { cards, byText, makeTwin } = setupReview(items, [twin]);
  const card = cards()[0];
  byText('ננסה אחד דומה', card).click();
  expect(makeTwin).toHaveBeenCalledWith(items[0]);
  expect(byText('ננסה אחד דומה', card)).toBeUndefined();
  expect(card.querySelector('.prep-twin-exercise')!.textContent).toBe(twin.text);
  const choices = [...card.querySelectorAll<HTMLButtonElement>('button.prep-choice')];
  expect(choices.map(b => b.textContent)).toEqual(twin.choices.map(c => c.text));
  expect(card.querySelector('.cloud')).toBeNull();
  choices.forEach(b => expect(b.type).toBe('button'));
  const right = choices.find(b => b.textContent === twin.answer.text)!;
  right.click();
  expect(card.querySelector('.prep-twin-result')!.textContent).toBe('יפה!');
  expect(right.classList.contains('is-sunlit')).toBe(true);
  choices.filter(b => b !== right).forEach(b => expect(b.disabled).toBe(true));
});

test('another choice on the new exercise shows its steps and its answer, one try only, with no judging words', () => {
  const items = [missOf('36 + 47')];
  const twin = problem('36 + 47');
  const { root, cards, byText, explain } = setupReview(items, [twin]);
  const card = cards()[0];
  byText('ננסה אחד דומה', card).click();
  const choices = [...card.querySelectorAll<HTMLButtonElement>('button.prep-choice')];
  const other = choices.find(b => b.textContent !== twin.answer.text)!;
  other.click();
  expect(explain).toHaveBeenLastCalledWith({ problem: twin, picked: other.textContent });
  expect([...card.querySelectorAll('.prep-twin ol.prep-steps li')].map(li => li.textContent)).toEqual(['twin step 1', 'twin step 2']);
  expect(choices.find(b => b.textContent === twin.answer.text)!.classList.contains('is-sunlit')).toBe(true);
  expect(other.classList.contains('is-sunlit')).toBe(false);
  expect(card.querySelector('.prep-twin-result')!.textContent).not.toBe('יפה!');
  choices.forEach(b => expect(b.disabled).toBe(true));
  choices[0].click();                                          // a second tap does nothing
  expect(explain).toHaveBeenCalledTimes(2);
  for (const node of root.querySelectorAll('*')) {
    expect(node.textContent).not.toContain('טעית');
    expect(node.textContent).not.toContain('לא נכון');
  }
});

test('no element of the review contains טעית or לא נכון', () => {
  const { root, cards, byText } = setupReview([missOf('48 × 6'), missOf('36 + 47')], [problem('48 × 6'), problem('36 + 47')]);
  for (const card of cards()) byText('ננסה אחד דומה', card).click();
  for (const node of root.querySelectorAll('*')) {
    expect(node.textContent).not.toContain('טעית');
    expect(node.textContent).not.toContain('לא נכון');
  }
});

test('המשך calls onDone', () => {
  const { byText, onDone } = setupReview([missOf('48 × 6')], [problem('48 × 6')]);
  byText('המשך').click();
  expect(onDone).toHaveBeenCalledTimes(1);
});

function setupSummary(over: Partial<Parameters<typeof renderPrepSummary>[1]> = {}) {
  const root = document.createElement('div'); document.body.append(root);
  const o = { packName: 'מבחן כפל', stars: 8, asked: 10, solved: 8, perfect: false, saved: true, onAgain: vi.fn(), onBack: vi.fn(), ...over };
  renderPrepSummary(root, o);
  const byText = (t: string) => [...root.querySelectorAll('button')].find(b => b.textContent === t)!;
  return { root, o, byText };
}

test('the summary shows the pack name, the stars and how many were solved, and its two buttons', () => {
  const { root, o, byText } = setupSummary();
  expect(root.querySelector('h1')!.textContent).toBe('מבחן כפל');
  expect(root.textContent).toContain('אספת 8 כוכבים');
  expect(root.textContent).toContain('פתרת 8 מתוך 10');
  expect(root.textContent).not.toContain('תרגול מושלם!');
  expect(root.querySelector('.prep-notice')).toBeNull();
  byText('עוד תרגול').click();
  expect(o.onAgain).toHaveBeenCalledTimes(1);
  byText('חזרה לחבילות').click();
  expect(o.onBack).toHaveBeenCalledTimes(1);
});

test('stars and solved count are shown separately: a returning problem is worth 2 stars', () => {
  const { root } = setupSummary({ stars: 11, asked: 11, solved: 10 });
  expect(root.textContent).toContain('אספת 11 כוכבים');
  expect(root.textContent).toContain('פתרת 10 מתוך 11');
});

test('exactly one star is said in the singular; 0, 2 and 10 keep the plural copy', () => {
  const stat = (stars: number) => { document.body.innerHTML = ''; return setupSummary({ stars }).root.querySelector('.prep-stat')!.textContent; };
  expect(stat(1)).toBe('אספת כוכב אחד');
  expect(stat(0)).toBe('אספת 0 כוכבים');
  expect(stat(2)).toBe('אספת 2 כוכבים');
  expect(stat(10)).toBe('אספת 10 כוכבים');
});

test('a perfect practice adds תרגול מושלם! with the big celebration style', () => {
  const { root } = setupSummary({ stars: 10, solved: 10, perfect: true });
  const line = root.querySelector('.prep-perfect')!;
  expect(line.textContent).toBe('תרגול מושלם!');
});

test('saved: false shows the storage notice', () => {
  const { root } = setupSummary({ saved: false });
  expect(root.querySelector('.prep-notice')!.textContent).toBe('לא ניתן לשמור במכשיר הזה. אפשר לתרגל עכשיו, אבל החבילה לא תישמר.');
});

test('the pack name is shown as plain text', () => {
  const { root } = setupSummary({ packName: '<b>x</b>' });
  expect(root.querySelector('h1')!.textContent).toBe('<b>x</b>');
  expect(root.querySelector('b')).toBeNull();
});

test('the celebration styles exist, and stand still with reduced motion', () => {
  const css = readFileSync('src/styles.css', 'utf8');
  expect(css).toMatch(/\.prep-perfect\s*\{[^}]*animation:/);
  expect(css).toMatch(/\.prep-choice\.is-sunlit\s*\{/);
  const reduced = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/g)].map(m => m[1]).join('\n');
  expect(reduced).toMatch(/\.prep-perfect[^{]*\{[^}]*animation:\s*none/);
});
