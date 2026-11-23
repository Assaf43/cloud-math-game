import { renderPrepEdit } from '../../src/ui/prepEditScreen';
import { REJECT_TEXT } from '../../src/prep/shape';
import type { Pack } from '../../src/prep/pack';

const pack = (over: Partial<Pack> = {}): Pack => ({
  id: 'p1', owner: 'דנה', name: 'מבחן כפל', grade: 5, examples: ['48 × 6', '52 × 7', '3 + 4'],
  createdAt: '2026-11-19T10:00:00.000Z', shapes: {}, lastStars: null, ...over,
});

function setup(p?: Pack) {
  const root = document.createElement('div'); document.body.append(root);
  const onSave = vi.fn<(name: string, examples: string[]) => void>();
  const onCancel = vi.fn();
  renderPrepEdit(root, { grade: 5, pack: p, onSave, onCancel });
  const name = root.querySelector<HTMLInputElement>('input[name=pack-name]')!;
  const rows = [...root.querySelectorAll<HTMLInputElement>('input.prep-row')];
  const status = (i: number) => document.getElementById(rows[i].getAttribute('aria-describedby')!)!.textContent;
  const type = (el: HTMLInputElement, v: string) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const button = (t: string) => [...root.querySelectorAll('button')].find(b => b.textContent === t)!;
  const key = (k: string) => [...root.querySelectorAll<HTMLButtonElement>('.keypad button')].find(b => b.textContent === k)!.click();
  const samples = () => [...root.querySelectorAll<HTMLElement>('.prep-samples li')].map(li => li.textContent);
  return { root, name, rows, status, type, button, key, samples, onSave, onCancel };
}
afterEach(() => { document.body.innerHTML = ''; });

test('a name field and five exercise rows, set up for the on-screen keypad', () => {
  const { name, rows, root } = setup();
  expect(name.maxLength).toBe(30);
  expect(name.placeholder).toBe('למשל: מבחן כפל יום שלישי');
  expect(rows).toHaveLength(5);
  rows.forEach((r, i) => {
    expect(r.type).toBe('text');
    expect(r.dir).toBe('ltr');
    expect(r.inputMode).toBe('none');
    expect(r.maxLength).toBe(40);
    expect(r.autocomplete).toBe('off');
    expect(r.getAttribute('autocapitalize')).toBe('off');
    expect(r.spellcheck).toBe(false);
    expect(r.getAttribute('aria-label')).toBe(`תרגיל ${i + 1}`);
  });
  expect(root.querySelectorAll('.keypad button')).toHaveLength(23);
});

test('a supported exercise shows ✓ and its label; unsupported ones show the reason; empty rows show nothing', () => {
  const { rows, status, type } = setup();
  type(rows[0], '48 × 6');
  expect(status(0)).toBe('✓ כפל דו-ספרתי בחד-ספרתי');
  type(rows[1], 'abc');
  expect(status(1)).toBe(REJECT_TEXT.letters);
  type(rows[2], '1 × 1');
  expect(status(2)).toBe(REJECT_TEXT['cannot-vary']);
  expect(status(3)).toBe('');
  type(rows[0], '');
  expect(status(0)).toBe('');
});

test('a whole-number exercise with a non-whole result shows the not-whole reason', () => {
  const { rows, status, type } = setup();
  type(rows[0], '17 ÷ 5');
  expect(status(0)).toBe('התוצאה לא יוצאת מספר שלם, ואת זה עוד אי אפשר לתרגל.');
});

test('the rejection text is neutral: no error wording', () => {
  const { rows, status, type, root } = setup();
  type(rows[0], 'abc');
  const s = document.getElementById(rows[0].getAttribute('aria-describedby')!)!;
  expect(s.className).not.toMatch(/error|wrong|bad/);
  expect(status(0)).not.toMatch(/שגיאה|טעית|לא נכון/);
  expect(root.textContent).not.toMatch(/שגיאה|טעית|לא נכון/);
});

test('keypad keys land in the focused row at the caret, and ⌫ removes one character', () => {
  const { rows, key, status } = setup();
  rows[1].focus();
  for (const k of ['4', '8', '␣', '×', '␣', '6']) key(k);
  expect(rows[1].value).toBe('48 × 6');
  expect(rows[0].value).toBe('');
  expect(document.activeElement).toBe(rows[1]);
  expect(status(1)).toBe('✓ כפל דו-ספרתי בחד-ספרתי');
  key('⌫');
  expect(rows[1].value).toBe('48 × ');
  rows[1].setSelectionRange(1, 1);
  key('5');
  expect(rows[1].value).toBe('458 × ');
  expect(rows[1].selectionStart).toBe(2);
  rows[1].setSelectionRange(0, 3);
  key('⌫');
  expect(rows[1].value).toBe(' × ');
  rows[1].setSelectionRange(0, 0);
  key('⌫');
  expect(rows[1].value).toBe(' × ');
});

test('without a focused row the keypad types into the first row, and a row never passes 40 characters', () => {
  const { rows, key, type } = setup();
  key('7');
  expect(rows[0].value).toBe('7');
  const long = '1'.repeat(40);
  type(rows[2], long);
  rows[2].focus();
  rows[2].setSelectionRange(40, 40);
  key('2');
  expect(rows[2].value).toBe(long);
});

test('save needs a name and 3 lines with one supported; below 3 lines a hint shows', () => {
  const { name, rows, type, button, root, onSave } = setup();
  const save = button('שמירה');
  type(name, 'מבחן');
  type(rows[0], '48 × 6'); type(rows[1], 'abc');
  expect(save.disabled).toBe(true);
  expect(root.textContent).toContain('צריך לפחות 3 תרגילים');
  type(rows[2], '1 × 1');
  expect(save.disabled).toBe(false);
  expect(root.textContent).not.toContain('צריך לפחות 3 תרגילים');
  type(name, '   ');
  expect(save.disabled).toBe(true);
  save.click();
  expect(onSave).not.toHaveBeenCalled();
});

test('a save that is not possible yet always says why, right above the buttons', () => {
  const { name, rows, type, button, root } = setup();
  const hint = () => root.querySelector<HTMLElement>('.prep-hint')!;
  expect(hint().textContent).toBe('צריך לפחות 3 תרגילים');                      // an empty editor
  type(rows[0], '48 × 6'); type(rows[1], '345 + 27'); type(rows[2], '3/4 + 1/8');
  expect(button('שמירה').disabled).toBe(true);                                   // three good lines, but no name
  expect(hint().hidden).toBe(false);
  expect(hint().textContent).toBe('צריך לתת שם לחבילה, בשדה שלמעלה');
  type(name, 'מבחן');
  expect(button('שמירה').disabled).toBe(false);
  expect(hint().hidden).toBe(true);
  expect(hint().textContent).toBe('');
  type(rows[2], '');                                                             // too few lines comes first
  expect(hint().textContent).toBe('צריך לפחות 3 תרגילים');
  type(rows[0], 'abc'); type(rows[1], '1 × 1'); type(rows[2], '(((');            // three lines, none can be practised
  expect(button('שמירה').disabled).toBe(true);
  expect(hint().textContent).toBe('צריך לפחות תרגיל אחד שאפשר לתרגל');
  expect(hint().nextElementSibling).toBe(root.querySelector('.prep-actions'));   // next to the button it explains
  expect(hint().getAttribute('aria-live')).toBe('polite');
});

test('three unsupported lines cannot be saved', () => {
  const { name, rows, type, button } = setup();
  type(name, 'מבחן');
  type(rows[0], 'abc'); type(rows[1], '1 × 1'); type(rows[2], '(((');
  expect(button('שמירה').disabled).toBe(true);
});

test('the summary shows how many lines can be practised only when some cannot', () => {
  const { rows, type, root } = setup();
  type(rows[0], '48 × 6'); type(rows[1], '52 × 7');
  expect(root.textContent).not.toContain('אפשר לתרגל');
  type(rows[3], 'abc');
  expect(root.textContent).toContain('אפשר לתרגל 2 מתוך 3');
});

test('onSave receives the trimmed name and the non-empty lines, trimmed, in row order', () => {
  const { name, rows, type, button, onSave } = setup();
  type(name, '  מבחן כפל  ');
  type(rows[0], ' 48 × 6 '); type(rows[2], 'abc'); type(rows[4], '52 × 7  ');
  button('שמירה').click();
  expect(onSave).toHaveBeenCalledWith('מבחן כפל', ['48 × 6', 'abc', '52 × 7']);
});

test('ביטול returns without saving', () => {
  const { name, rows, type, button, onSave, onCancel } = setup();
  type(name, 'מבחן'); type(rows[0], '48 × 6'); type(rows[1], '52 × 7'); type(rows[2], '3 + 4');
  button('ביטול').click();
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onSave).not.toHaveBeenCalled();
});

test('five sample problems are listed, none equal to a typed example or to each other', () => {
  const { rows, type, root, samples } = setup();
  expect(root.querySelector<HTMLElement>('.prep-samples')!.hidden).toBe(true);
  type(rows[0], '48 × 6'); type(rows[1], '3 + 4'); type(rows[2], '72 ÷ 8');
  const section = root.querySelector<HTMLElement>('.prep-samples')!;
  expect(section.hidden).toBe(false);
  expect(section.textContent).toContain('דוגמאות למה שיופיע בתרגול');
  const list = samples();
  expect(list).toHaveLength(5);
  expect(new Set(list).size).toBe(5);
  for (const s of list) expect(['48 × 6', '3 + 4', '72 ÷ 8']).not.toContain(s);
  // spread across the supported shapes: the first three come one from each
  expect(list[0]).toContain('×'); expect(list[1]).toContain('+'); expect(list[2]).toContain('÷');
});

test('the samples are the same each time for the same lines, and hidden when no line is supported', () => {
  const a = setup();
  a.type(a.rows[0], '48 × 6');
  const first = a.samples();
  document.body.innerHTML = '';
  const b = setup();
  b.type(b.rows[0], '48 × 6');
  expect(b.samples()).toEqual(first);
  b.type(b.rows[0], 'abc');
  expect(b.root.querySelector<HTMLElement>('.prep-samples')!.hidden).toBe(true);
});

test('editing an existing pack prefills the name and the rows', () => {
  const { name, rows, status, button } = setup(pack());
  expect(name.value).toBe('מבחן כפל');
  expect(rows.map(r => r.value)).toEqual(['48 × 6', '52 × 7', '3 + 4', '', '']);
  expect(status(0)).toBe('✓ כפל דו-ספרתי בחד-ספרתי');
  expect(button('שמירה').disabled).toBe(false);
});

test('a stored pack whose lines no longer parse opens with each line\'s reason', () => {
  const { rows, status, button, samples } = setup(pack({ examples: ['abc', '1 × 1', '((('] }));
  expect(rows.map(r => r.value)).toEqual(['abc', '1 × 1', '(((', '', '']);
  expect(status(0)).toBe(REJECT_TEXT.letters);
  expect(status(1)).toBe(REJECT_TEXT['cannot-vary']);
  expect(status(2)).toBe(REJECT_TEXT.syntax);
  expect(button('שמירה').disabled).toBe(true);
  expect(samples()).toEqual([]);
});
