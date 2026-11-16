import type { Difficulty, Grade } from '../types';
import type { Session } from '../game/session';
import type { ScoreEntry, Storage } from '../storage/storage';

const GRADE_LABEL: Record<Grade, string> = { 3: 'ג׳', 4: 'ד׳', 5: 'ה׳', 6: 'ו׳' };
const DIFFICULTY_LABEL: Record<Difficulty, string> = { beginner: 'מתחיל', advanced: 'מתקדם', expert: 'ממש מתקדם' };

/** A game is saved exactly once, however many times its final screen is drawn. */
const saved = new WeakMap<Session, { entry: ScoreEntry; isPersonalBest: boolean }>();

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function table(className: string, headers: string[], rows: string[][], current?: (i: number) => boolean): HTMLTableElement {
  const t = el('table', className);
  const head = el('thead');
  const hr = el('tr');
  headers.forEach(h => hr.append(el('th', undefined, h)));
  head.append(hr);
  const body = el('tbody');
  rows.forEach((cells, i) => {
    const tr = el('tr');
    if (current?.(i)) tr.classList.add('is-current');
    cells.forEach(c => tr.append(el('td', undefined, c)));     // names and numbers as text only
    body.append(tr);
  });
  t.append(head, body);
  return t;
}

function saveOnce(session: Session, storage: Storage): { entry: ScoreEntry; isPersonalBest: boolean } {
  const known = saved.get(session);
  if (known) return known;
  const entry: ScoreEntry = {
    name: session.config.name,
    grade: session.config.grade,
    difficulty: session.config.difficulty,
    total: session.totalScore,
    avg: session.avgPointsPerProblem,
    problems: session.rounds.reduce((n, r) => n + r.total, 0),
    date: new Date().toISOString(),
  };
  const { isPersonalBest } = storage.addScore(entry);
  const result = { entry, isPersonalBest };
  saved.set(session, result);
  return result;
}

export function renderFinal(root: HTMLElement, session: Session, storage: Storage, onPlayAgain: () => void): void {
  const { entry, isPersonalBest } = saveOnce(session, storage);
  const card = el('main', 'card final');
  card.append(el('h2', undefined, `סיום המשחק, ${session.config.name}!`));
  if (isPersonalBest) card.append(el('p', 'personal-best', 'שיא אישי חדש!'));

  const totals = el('div', 'totals');
  const big = (label: string, value: number) => {
    const box = el('div', 'total-box');
    const v = el('bdi', 'total-value', String(value));
    v.dir = 'ltr';
    box.append(v, el('span', 'total-label', label));
    return box;
  };
  totals.append(big('סך הכל נקודות', session.totalScore), big('ממוצע לתרגיל', session.avgPointsPerProblem));
  card.append(totals);

  card.append(el('h3', undefined, 'הסבבים'));
  card.append(table('rounds-table', ['סבב', 'נכונות', 'זמן ממוצע', 'נקודות', 'עיר'],
    session.rounds.map((r, i) => [
      String(i + 1), `${r.correct}/${r.total}`, `${(r.avgAnswerMs / 1000).toFixed(1)} שנ׳`, String(r.points),
      r.cityCorrect ? '✓' : '✗',
    ])));

  card.append(el('h3', undefined, 'טבלת השיאים במכשיר'));
  const top = storage.topScores();
  if (top.length === 0) card.append(el('p', 'empty', 'עדיין אין תוצאות שמורות'));
  card.append(table('leaderboard', ['#', 'שם', 'כיתה', 'דרגה', 'ממוצע', 'סך הכל'],
    top.map((s, i) => [String(i + 1), s.name, GRADE_LABEL[s.grade], DIFFICULTY_LABEL[s.difficulty], String(s.avg), String(s.total)]),
    i => top[i].date === entry.date && top[i].name === entry.name && top[i].total === entry.total && top[i].avg === entry.avg));

  const again = el('button', 'primary', 'שחק שוב');
  again.type = 'button';
  again.addEventListener('click', onPlayAgain);
  const credit = el('a', 'credit', 'Weather data by Open-Meteo.com');
  credit.href = 'https://open-meteo.com/';
  credit.target = '_blank';
  credit.rel = 'noopener noreferrer';
  card.append(again, credit);
  root.replaceChildren(card);
}
