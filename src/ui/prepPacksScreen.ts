import type { Difficulty } from '../types';
import type { Profile } from '../storage/storage';
import { packShapes } from '../prep/pack';
import type { Pack } from '../prep/pack';

const DIFFICULTY_LABELS: [Difficulty, string][] = [['beginner', 'מתחיל'], ['advanced', 'מתקדם'], ['expert', 'ממש מתקדם']];

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

export function renderPrepPacks(root: HTMLElement, o: { player: Profile; packs: Pack[];
  onPlay(pack: Pack, difficulty: Difficulty): void; onNew(): void; onEdit(pack: Pack): void; onDelete(pack: Pack): void; onBack(): void }): void {
  const main = el('main', 'prep prep-packs');

  const difficulty = el('select');
  difficulty.name = 'difficulty';
  for (const [v, text] of DIFFICULTY_LABELS) difficulty.append(new Option(text, v));
  difficulty.value = 'beginner';
  const difficultyField = el('label', 'field');
  difficultyField.append(el('span', 'field-label', 'דרגת קושי'), difficulty);

  const list = el('ul', 'prep-pack-list');
  for (const pack of o.packs) list.append(packItem(pack, () => difficulty.value as Difficulty, o));

  const panel = el('div', 'prep-panel');
  panel.append(difficultyField);
  if (o.packs.length === 0) panel.append(el('p', 'prep-empty', 'עוד אין חבילות. מוסיפים 3 עד 5 תרגילים מהחומר למבחן, והמשחק מכין תרגילים דומים.'));
  else panel.append(list);
  panel.append(button('חבילה חדשה', 'primary', o.onNew), button('חזרה', 'secondary', o.onBack));

  main.append(el('h1', undefined, 'הכנה למבחן'), panel);
  root.replaceChildren(main);
}

function packItem(pack: Pack, difficulty: () => Difficulty,
  o: { onPlay(pack: Pack, difficulty: Difficulty): void; onEdit(pack: Pack): void; onDelete(pack: Pack): void }): HTMLLIElement {
  const item = el('li', 'prep-pack');
  const kinds = packShapes(pack).length;
  const info = el('p', 'prep-pack-info', kinds > 0 ? `${kinds} סוגי תרגילים` : 'אין בחבילה תרגילים שאפשר לתרגל');
  if (pack.lastStars !== null) info.append(' · ', el('span', 'prep-pack-stars', `⭐ ${pack.lastStars}`));
  const actions = el('div', 'prep-pack-actions');

  const showButtons = () => {
    const play = button('שחק', 'primary', () => o.onPlay(pack, difficulty()));
    play.disabled = kinds === 0;
    const remove = button('מחיקה', 'secondary', showQuestion);
    actions.replaceChildren(play, button('עריכה', 'secondary', () => o.onEdit(pack)), remove);
    return remove;
  };
  const showQuestion = () => {
    const back = button('ביטול', 'secondary', () => showButtons().focus());
    actions.replaceChildren(el('p', 'prep-pack-question', 'למחוק את החבילה?'), button('כן, למחוק', 'secondary prep-delete', () => o.onDelete(pack)), back);
    back.focus();
  };

  showButtons();
  item.append(el('h2', 'prep-pack-name', pack.name), info, actions);
  return item;
}
