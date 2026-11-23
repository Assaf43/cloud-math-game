import { renderSetup } from '../../src/ui/setupScreen';
import { Storage } from '../../src/storage/storage';
import type { GameConfig } from '../../src/types';
import type { Profile } from '../../src/storage/storage';

function memory() {
  const data: Record<string, string> = {};
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; } };
}
function setup(storage = new Storage(memory())) {
  const root = document.createElement('div'); document.body.append(root);
  const onStart = vi.fn<(c: GameConfig) => void>();
  renderSetup(root, storage, onStart);
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const type = (el: HTMLInputElement | HTMLSelectElement, v: string) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  return { root, onStart, q, type, storage };
}
afterEach(() => { document.body.innerHTML = ''; });

test('has the title and Hebrew labels', () => {
  const { root } = setup();
  expect(root.querySelector('h1')!.textContent).toBe('חשבון בעננים');
  for (const label of ['שם', 'גיל', 'כיתה', 'דרגת קושי', 'זמן לתרגיל', 'מספר סבבים', 'התחל']) expect(root.textContent).toContain(label);
});

test('start is disabled until a name is entered, then returns the config', () => {
  const { q, type, onStart } = setup();
  const start = q<HTMLButtonElement>('button[type=submit]');
  expect(start.disabled).toBe(true);
  type(q<HTMLInputElement>('[name=name]'), '  דן  ');
  expect(start.disabled).toBe(false);
  type(q<HTMLInputElement>('[name=age]'), '10');
  type(q<HTMLSelectElement>('[name=grade]'), '5');
  type(q<HTMLSelectElement>('[name=difficulty]'), 'expert');
  type(q<HTMLInputElement>('[name=seconds]'), '20');
  type(q<HTMLSelectElement>('[name=rounds]'), '2');
  start.click();
  expect(onStart).toHaveBeenCalledWith({ name: 'דן', age: 10, grade: 5, difficulty: 'expert', secondsPerProblem: 20, rounds: 2 });
});

test('a blank or whitespace-only name keeps start disabled; so does an age outside 6-14', () => {
  const { q, type } = setup();
  const start = q<HTMLButtonElement>('button[type=submit]');
  type(q<HTMLInputElement>('[name=name]'), '   '); expect(start.disabled).toBe(true);
  type(q<HTMLInputElement>('[name=name]'), 'דן'); expect(start.disabled).toBe(false);
  type(q<HTMLInputElement>('[name=age]'), '5'); expect(start.disabled).toBe(true);
  type(q<HTMLInputElement>('[name=age]'), '15'); expect(start.disabled).toBe(true);
  type(q<HTMLInputElement>('[name=age]'), '14'); expect(start.disabled).toBe(false);
  type(q<HTMLInputElement>('[name=age]'), ''); expect(start.disabled).toBe(true);
});

test('defaults are 30 seconds and 3 rounds, with the value of the time slider shown', () => {
  const { q, type, onStart, root } = setup();
  expect(q<HTMLInputElement>('[name=seconds]').value).toBe('30');
  expect(q<HTMLInputElement>('[name=seconds]').min).toBe('10'); expect(q<HTMLInputElement>('[name=seconds]').max).toBe('60'); expect(q<HTMLInputElement>('[name=seconds]').step).toBe('5');
  expect(root.querySelector('[data-seconds-value]')!.textContent).toContain('30');
  type(q<HTMLInputElement>('[name=seconds]'), '45');
  expect(root.querySelector('[data-seconds-value]')!.textContent).toContain('45');
  type(q<HTMLInputElement>('[name=seconds]'), '30');
  type(q<HTMLInputElement>('[name=name]'), 'נועה');
  q<HTMLButtonElement>('button[type=submit]').click();
  expect(onStart.mock.calls[0][0]).toMatchObject({ secondsPerProblem: 30, rounds: 3 });
  const rounds = [...q<HTMLSelectElement>('[name=rounds]').options].map(o => o.value);
  expect(rounds).toEqual(['1', '2', '3', '4', '5']);
});

test('choosing a saved profile fills name, age and grade', () => {
  const storage = new Storage(memory());
  storage.saveProfile({ name: 'נועה', age: 9, grade: 4 });
  storage.saveProfile({ name: 'דן', age: 12, grade: 6 });
  const { q, type } = setup(storage);
  type(q<HTMLSelectElement>('[name=profile]'), 'דן');
  expect(q<HTMLInputElement>('[name=name]').value).toBe('דן');
  expect(q<HTMLInputElement>('[name=age]').value).toBe('12');
  expect(q<HTMLSelectElement>('[name=grade]').value).toBe('6');
  expect(q<HTMLButtonElement>('button[type=submit]').disabled).toBe(false);
});

test('starting saves the profile on the device', () => {
  const { q, type, storage } = setup();
  type(q<HTMLInputElement>('[name=name]'), 'מיכל'); type(q<HTMLInputElement>('[name=age]'), '11'); type(q<HTMLSelectElement>('[name=grade]'), '6');
  q<HTMLButtonElement>('button[type=submit]').click();
  expect(storage.profiles()).toEqual([{ name: 'מיכל', age: 11, grade: 6 }]);
});

test('a name containing markup is stored and shown as text', () => {
  const storage = new Storage(memory());
  storage.saveProfile({ name: '<img src=x>', age: 9, grade: 4 });
  const { root } = setup(storage);
  expect(root.querySelector('img')).toBeNull();
  expect([...root.querySelectorAll('option')].some(o => o.textContent === '<img src=x>')).toBe(true);
});

test('the name field is limited to 20 characters and works with an unavailable storage', () => {
  const { q } = setup(new Storage(null));
  expect(q<HTMLInputElement>('[name=name]').maxLength).toBe(20);
  expect(q<HTMLSelectElement>('[name=profile]').closest('label, div')!.hasAttribute('hidden') || q<HTMLSelectElement>('[name=profile]').options.length <= 1).toBe(true);
});

describe('the test prep button', () => {
  function withPrep(storage = new Storage(memory())) {
    const root = document.createElement('div'); document.body.append(root);
    const onStart = vi.fn<(c: GameConfig) => void>();
    const onPrep = vi.fn<(p: Profile) => void>();
    renderSetup(root, storage, onStart, onPrep);
    const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
    const type = (el: HTMLInputElement | HTMLSelectElement, v: string) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    const prep = () => [...root.querySelectorAll('button')].find(b => b.textContent === 'הכנה למבחן');
    return { root, onStart, onPrep, q, type, prep, storage };
  }

  test('there is no prep button without onPrep, and the screen is the same as before', () => {
    const plain = setup();
    expect([...plain.root.querySelectorAll('button')].map(b => b.textContent)).toEqual(['התחל']);
    const html = plain.root.innerHTML;
    document.body.innerHTML = '';
    const withButton = withPrep();
    withButton.prep()!.remove();
    expect(withButton.root.innerHTML).toBe(html);       // the button is the only difference
  });

  test('with onPrep the button comes after התחל and is disabled until a name is typed', () => {
    const { root, q, type, prep } = withPrep();
    expect([...root.querySelectorAll('button')].map(b => b.textContent)).toEqual(['התחל', 'הכנה למבחן']);
    expect(prep()!.type).toBe('button');
    expect(prep()!.disabled).toBe(true);
    type(q<HTMLInputElement>('[name=name]'), '   ');
    expect(prep()!.disabled).toBe(true);
    type(q<HTMLInputElement>('[name=name]'), 'דן');
    expect(prep()!.disabled).toBe(false);
    type(q<HTMLInputElement>('[name=age]'), '15');
    expect(prep()!.disabled).toBe(true);
  });

  test('clicking it stores the profile and calls onPrep with it, without starting a game', () => {
    const { q, type, prep, onPrep, onStart, storage } = withPrep();
    type(q<HTMLInputElement>('[name=name]'), '  מיכל  '); type(q<HTMLInputElement>('[name=age]'), '11'); type(q<HTMLSelectElement>('[name=grade]'), '6');
    prep()!.click();
    expect(onPrep).toHaveBeenCalledWith({ name: 'מיכל', age: 11, grade: 6 });
    expect(storage.profiles()).toEqual([{ name: 'מיכל', age: 11, grade: 6 }]);
    expect(onStart).not.toHaveBeenCalled();
  });

  test('התחל still starts the game when the prep button is there', () => {
    const { q, type, onPrep, onStart } = withPrep();
    type(q<HTMLInputElement>('[name=name]'), 'דן');
    q<HTMLButtonElement>('button[type=submit]').click();
    expect(onStart).toHaveBeenCalledWith({ name: 'דן', age: 10, grade: 5, difficulty: 'beginner', secondsPerProblem: 30, rounds: 3 });
    expect(onPrep).not.toHaveBeenCalled();
  });
});
