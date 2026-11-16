import type { Difficulty, GameConfig, Grade } from '../types';
import type { Storage } from '../storage/storage';

const GRADE_LABELS: [Grade, string][] = [[3, 'ג׳'], [4, 'ד׳'], [5, 'ה׳'], [6, 'ו׳']];
const DIFFICULTY_LABELS: [Difficulty, string][] = [['beginner', 'מתחיל'], ['advanced', 'מתקדם'], ['expert', 'ממש מתקדם']];

function field(label: string, control: HTMLElement, extra?: HTMLElement): HTMLLabelElement {
  const l = document.createElement('label');
  l.className = 'field';
  const span = document.createElement('span');
  span.className = 'field-label';
  span.textContent = label;
  l.append(span, control);
  if (extra) l.append(extra);
  return l;
}

function select(name: string, options: [string, string][], value: string): HTMLSelectElement {
  const s = document.createElement('select');
  s.name = name;
  for (const [v, text] of options) s.append(new Option(text, v));      // Option text is always plain text
  s.value = value;
  return s;
}

export function renderSetup(root: HTMLElement, storage: Storage, onStart: (config: GameConfig) => void): void {
  const main = document.createElement('main');
  main.className = 'setup';
  const title = document.createElement('h1');
  title.textContent = 'חשבון בעננים';

  const form = document.createElement('form');
  form.noValidate = true;
  form.autocomplete = 'off';

  const profiles = storage.profiles();
  const profile = select('profile', [['', 'שחקן חדש'], ...profiles.map(p => [p.name, p.name] as [string, string])], '');
  const profileField = field('שחקן קיים', profile);
  profileField.hidden = profiles.length === 0;

  const name = document.createElement('input');
  name.type = 'text'; name.name = 'name'; name.maxLength = 20; name.autocomplete = 'off'; name.placeholder = 'איך קוראים לך?';
  const age = document.createElement('input');
  age.type = 'number'; age.name = 'age'; age.min = '6'; age.max = '14'; age.step = '1'; age.inputMode = 'numeric'; age.value = '10';
  const grade = select('grade', GRADE_LABELS.map(([g, l]) => [String(g), l]), '5');
  const difficulty = select('difficulty', DIFFICULTY_LABELS, 'beginner');
  const seconds = document.createElement('input');
  seconds.type = 'range'; seconds.name = 'seconds'; seconds.min = '10'; seconds.max = '60'; seconds.step = '5'; seconds.value = '30';
  const secondsValue = document.createElement('output');
  secondsValue.dataset.secondsValue = '';
  const rounds = select('rounds', [1, 2, 3, 4, 5].map(n => [String(n), String(n)]), '3');

  const start = document.createElement('button');
  start.type = 'submit'; start.className = 'primary'; start.textContent = 'התחל';

  const secondsLabel = () => { secondsValue.textContent = `${seconds.value} שניות`; };
  const valid = () => {
    const a = Number(age.value);
    return name.value.trim().length > 0 && age.value.trim() !== '' && Number.isInteger(a) && a >= 6 && a <= 14;
  };
  const refresh = () => { secondsLabel(); start.disabled = !valid(); };

  profile.addEventListener('change', () => {
    const p = profiles.find(x => x.name === profile.value);
    if (!p) return;
    name.value = p.name; age.value = String(p.age); grade.value = String(p.grade);
    refresh();
  });
  for (const el of [name, age, grade, difficulty, seconds, rounds]) {
    el.addEventListener('input', refresh);
    el.addEventListener('change', refresh);
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!valid()) return;
    const config: GameConfig = {
      name: name.value.trim().slice(0, 20),
      age: Number(age.value),
      grade: Number(grade.value) as Grade,
      difficulty: difficulty.value as Difficulty,
      secondsPerProblem: Number(seconds.value),
      rounds: Number(rounds.value),
    };
    storage.saveProfile({ name: config.name, age: config.age, grade: config.grade });
    onStart(config);
  });

  form.append(
    profileField, field('שם', name), field('גיל', age), field('כיתה', grade), field('דרגת קושי', difficulty),
    field('זמן לתרגיל', seconds, secondsValue), field('מספר סבבים', rounds), start,
  );
  main.append(title, form);
  root.replaceChildren(main);
  refresh();
}
