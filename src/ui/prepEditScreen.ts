import type { Grade } from '../types';
import { analyzeLines, canSave, MAX_LINES, MAX_PACK_NAME, MIN_LINES } from '../prep/pack';
import type { Pack, PackLine } from '../prep/pack';
import { REJECT_TEXT } from '../prep/shape';
import type { Shape } from '../prep/shape';
import { generateSimilar } from '../prep/generate';
import { MAX_INPUT } from '../prep/expr';
import { createRng } from '../rng';
import { renderKeypad } from './prepKeypad';

const SAMPLE_COUNT = 5;
const SAMPLE_SEED = 20261119;     // fixed, so the samples only change when the exercises do

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

interface Row { input: HTMLInputElement; status: HTMLElement; box: HTMLElement }

function exerciseRow(i: number, value: string): Row {
  const input = el('input', 'prep-row');
  input.type = 'text'; input.dir = 'ltr'; input.inputMode = 'none'; input.maxLength = MAX_INPUT;
  input.autocomplete = 'off'; input.setAttribute('autocapitalize', 'off'); input.spellcheck = false;
  input.setAttribute('aria-label', `תרגיל ${i + 1}`);
  input.value = value;
  const status = el('p', 'prep-row-status');
  status.id = `prep-row-status-${i + 1}`;
  input.setAttribute('aria-describedby', status.id);
  const box = el('div', 'prep-row-box');
  box.append(input, status);
  return { input, status, box };
}

/** Inserts the key at the caret (replacing a selection), or removes the selection / the character before the caret. */
function typeKey(input: HTMLInputElement, key: string): void {
  const v = input.value;
  let start = input.selectionStart ?? v.length;
  const end = input.selectionEnd ?? v.length;
  if (key === 'Backspace') {
    if (start === end) {
      if (start === 0) return;
      start -= 1;
    }
    input.value = v.slice(0, start) + v.slice(end);
    input.setSelectionRange(start, start);
    return;
  }
  const next = v.slice(0, start) + key + v.slice(end);
  if (next.length > input.maxLength) return;
  input.value = next;
  input.setSelectionRange(start + key.length, start + key.length);
}

const statusText = (line: PackLine | undefined) =>
  !line ? '' : line.analysis.ok ? `✓ ${line.analysis.shape.label}` : REJECT_TEXT[line.analysis.reason];

/** Up to five beginner problems, one shape after the other, never equal to a typed example or to each other. */
function sampleTexts(lines: readonly PackLine[], grade: Grade): string[] {
  const shapes = new Map<string, Shape>();
  for (const { analysis } of lines) if (analysis.ok && !shapes.has(analysis.shape.key)) shapes.set(analysis.shape.key, analysis.shape);
  const list = [...shapes.values()];
  const avoid = new Set(lines.map((l) => l.analysis.ok ? l.analysis.shape.exampleText : l.input));
  const rng = createRng(SAMPLE_SEED);
  const out: string[] = [];
  for (let i = 0, misses = 0; out.length < SAMPLE_COUNT && misses < 2 * list.length; i++) {
    const p = generateSimilar(list[i % list.length], 'beginner', grade, rng, avoid);
    if (!p) { misses++; continue; }
    misses = 0;
    out.push(p.text);
    avoid.add(p.text);
  }
  return out;
}

/** What is still missing before the pack can be saved, one thing at a time; '' when `canSave` holds. */
function saveBlocker(name: string, lines: readonly PackLine[]): string {
  if (lines.length < MIN_LINES) return `צריך לפחות ${MIN_LINES} תרגילים`;
  if (!lines.some((l) => l.analysis.ok)) return 'צריך לפחות תרגיל אחד שאפשר לתרגל';
  if (name.trim() === '') return 'צריך לתת שם לחבילה, בשדה שלמעלה';
  return '';
}

export function renderPrepEdit(root: HTMLElement, o: { grade: Grade; pack?: Pack;
  onSave(name: string, examples: string[]): void; onCancel(): void }): void {
  const main = el('main', 'prep prep-edit');
  const panel = el('div', 'prep-panel');

  const name = el('input');
  name.type = 'text'; name.name = 'pack-name'; name.maxLength = MAX_PACK_NAME; name.autocomplete = 'off';
  name.placeholder = 'למשל: מבחן כפל יום שלישי';
  name.value = o.pack?.name ?? '';
  const nameField = el('label', 'field');
  nameField.append(el('span', 'field-label', 'שם החבילה'), name);

  const rows = Array.from({ length: MAX_LINES }, (_, i) => exerciseRow(i, o.pack?.examples[i] ?? ''));
  const rowList = el('div', 'prep-rows');
  rowList.append(el('span', 'field-label', 'תרגילים'), ...rows.map((r) => r.box));
  let target = rows[0].input;               // the keypad types into the row that had the focus last

  const summary = el('p', 'prep-summary');
  const hint = el('p', 'prep-hint');                 // why "שמירה" is still off; sits right above it
  hint.setAttribute('aria-live', 'polite');
  const samples = el('section', 'prep-samples');
  const sampleList = el('ol', 'prep-sample-list');
  samples.append(el('h2', undefined, 'דוגמאות למה שיופיע בתרגול'), sampleList);

  const cache = new Map<string, PackLine | undefined>();
  const lineOf = (value: string) => {
    if (!cache.has(value)) cache.set(value, analyzeLines([value], o.grade)[0]);
    return cache.get(value);
  };
  let lines: PackLine[] = [];

  const save = button('שמירה', 'primary', () => {
    if (canSave(name.value, lines)) o.onSave(name.value.trim(), lines.map((l) => l.input));
  });

  const refresh = () => {
    const perRow = rows.map((r) => lineOf(r.input.value.trim()));
    rows.forEach((r, i) => { r.status.textContent = statusText(perRow[i]); });
    lines = perRow.filter((l): l is PackLine => l !== undefined);
    const supported = lines.filter((l) => l.analysis.ok).length;
    summary.hidden = !(lines.length > 0 && supported < lines.length);
    summary.textContent = summary.hidden ? '' : `אפשר לתרגל ${supported} מתוך ${lines.length}`;
    const missing = saveBlocker(name.value, lines);
    hint.hidden = missing === '';
    hint.textContent = missing;
    save.disabled = !canSave(name.value, lines);
    const texts = sampleTexts(lines, o.grade);
    sampleList.replaceChildren(...texts.map((t) => { const li = el('li', undefined, t); li.dir = 'ltr'; return li; }));
    samples.hidden = texts.length === 0;
  };

  for (const r of rows) {
    r.input.addEventListener('focus', () => { target = r.input; });
    r.input.addEventListener('input', refresh);
  }
  name.addEventListener('input', refresh);
  const keypad = renderKeypad((key) => {
    if (document.activeElement !== target) target.focus();
    typeKey(target, key);
    refresh();
  });

  const actions = el('div', 'prep-actions');
  actions.append(save, button('ביטול', 'secondary', o.onCancel));
  panel.append(nameField, rowList, keypad, summary, samples, hint, actions);
  main.append(el('h1', undefined, o.pack ? 'עריכת חבילה' : 'חבילה חדשה'), panel);
  root.replaceChildren(main);
  refresh();
}
