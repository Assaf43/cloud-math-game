import type { WeatherState } from '../types';
import type { Session } from '../game/session';
import { CITY_BONUS } from '../game/scoring';
import { SceneView } from '../scene/sceneView';
import { timeOfDay } from '../scene/timeOfDay';
import { newGameControl } from './newGameControl';

const CITY_FEEDBACK_MS = 1500;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function stat(label: string, value: string): HTMLElement {
  const row = el('div', 'stat');
  const v = el('bdi', 'stat-value', value);
  v.dir = 'ltr';
  row.append(el('span', 'stat-label', label), v);
  return row;
}

export function renderRoundSummary(root: HTMLElement, session: Session, onContinue: () => void, onNewGame?: () => void): void {
  const r = session.rounds[session.roundIndex];
  const card = el('main', 'card summary');
  card.append(
    el('h2', undefined, `סיכום סבב ${session.roundIndex + 1}`),
    stat('תשובות נכונות', `${r.correct} מתוך ${r.total}`),
    stat('זמן ממוצע לתשובה', `${(r.avgAnswerMs / 1000).toFixed(1)} שניות`),
    stat('נקודות בסבב', String(r.points)),
  );
  const next = el('button', 'primary', 'המשך');
  next.type = 'button';
  next.addEventListener('click', onContinue);
  card.append(next);
  if (onNewGame) card.append(newGameControl(onNewGame));
  root.replaceChildren(card);
}

export interface CityBonusOptions {
  playSuccess?: () => void;
  weather?: WeatherState;        // keeps the round's weather behind the skyline
  feedbackMs?: number;
  onNewGame?: () => void;        // leaving for a new game cancels the move on to the next round
}

/** "Which city are we in?": the skyline stays visible, a hint, four choices. */
export function renderCityBonus(root: HTMLElement, session: Session, onDone: () => void, options: CityBonusOptions = {}): void {
  const card = el('main', 'card city-bonus');
  const sky = el('div', 'city-sky');
  new SceneView(sky).setBackdrop(timeOfDay(new Date()), options.weather ?? 'clear', session.city.id);
  const result = el('p', 'city-result');
  result.setAttribute('aria-live', 'polite');
  const choices = el('div', 'city-choices');

  const buttons = session.cityOptions.map(city => {
    const b = el('button', 'city-btn', city.name);              // city names are our own constants
    b.type = 'button';
    b.dataset.city = city.id;
    return b;
  });
  let answered = false;
  let left = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  buttons.forEach(b => b.addEventListener('click', () => {
    if (answered) return;
    answered = true;
    const correct = session.answerCity(b.dataset.city!);
    buttons.forEach(x => { x.disabled = true; });
    for (const x of buttons) if (x.dataset.city === session.city.id) x.classList.add('is-correct');
    if (correct) {
      result.textContent = `נכון! +${CITY_BONUS}`;
      options.playSuccess?.();
    } else {
      b.classList.add('is-wrong');
      result.textContent = `זו הייתה ${session.city.name}`;
    }
    timer = setTimeout(() => { if (!left) { session.advance(); onDone(); } }, options.feedbackMs ?? CITY_FEEDBACK_MS);
  }));
  choices.append(...buttons);
  card.append(el('h2', undefined, 'באיזו עיר אנחנו?'), sky, el('p', 'city-hint', session.city.hint), choices, result);
  const { onNewGame } = options;
  if (onNewGame) card.append(newGameControl(() => { left = true; if (timer !== null) clearTimeout(timer); onNewGame(); }));
  root.replaceChildren(card);
}
