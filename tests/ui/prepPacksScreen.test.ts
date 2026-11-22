import { renderPrepPacks } from '../../src/ui/prepPacksScreen';
import type { Pack } from '../../src/prep/pack';
import type { Difficulty } from '../../src/types';

const pack = (over: Partial<Pack> = {}): Pack => ({
  id: 'p1', owner: 'דנה', name: 'מבחן כפל', grade: 5, examples: ['48 × 6', '52 × 7', '3 + 4'],
  createdAt: '2026-11-19T10:00:00.000Z', shapes: {}, lastStars: null, ...over,
});

function setup(packs: Pack[]) {
  const root = document.createElement('div'); document.body.append(root);
  const o = {
    player: { name: 'דנה', age: 10, grade: 5 as const }, packs,
    onPlay: vi.fn<(p: Pack, d: Difficulty) => void>(), onNew: vi.fn(), onEdit: vi.fn<(p: Pack) => void>(),
    onDelete: vi.fn<(p: Pack) => void>(), onBack: vi.fn(),
  };
  renderPrepPacks(root, o);
  const buttons = (scope: ParentNode = root) => [...scope.querySelectorAll('button')];
  const byText = (t: string, scope: ParentNode = root) => buttons(scope).find(b => b.textContent === t)!;
  const items = () => [...root.querySelectorAll<HTMLElement>('.prep-pack')];
  return { root, o, buttons, byText, items };
}
afterEach(() => { document.body.innerHTML = ''; });

test('has the title, the new and back buttons, and a difficulty choice defaulting to מתחיל', () => {
  const { root, byText, o } = setup([pack()]);
  expect(root.querySelector('h1')!.textContent).toBe('הכנה למבחן');
  const select = root.querySelector<HTMLSelectElement>('select[name=difficulty]')!;
  expect([...select.options].map(x => x.textContent)).toEqual(['מתחיל', 'מתקדם', 'ממש מתקדם']);
  expect(select.value).toBe('beginner');
  expect(select.selectedOptions[0].textContent).toBe('מתחיל');
  byText('חבילה חדשה').click();
  expect(o.onNew).toHaveBeenCalledTimes(1);
  byText('חזרה').click();
  expect(o.onBack).toHaveBeenCalledTimes(1);
});

test('each pack shows its name, how many kinds of exercises, the last stars and three buttons', () => {
  const two = pack({ id: 'a', name: 'כפל', examples: ['48 × 6', '52 × 7', '3 + 4'], lastStars: 2 });
  const one = pack({ id: 'b', name: 'חיבור', examples: ['3 + 4', '5 + 2', '6 + 1'] });
  const { items, buttons } = setup([two, one]);
  expect(items()).toHaveLength(2);
  expect(items()[0].textContent).toContain('כפל');
  expect(items()[0].textContent).toContain('2 סוגי תרגילים');
  expect(items()[0].textContent).toContain('⭐ 2');
  expect(items()[1].textContent).toContain('חיבור');
  expect(items()[1].textContent).toContain('1 סוגי תרגילים');
  expect(items()[1].textContent).not.toContain('⭐');
  for (const it of items()) expect(buttons(it).map(b => b.textContent)).toEqual(['שחק', 'עריכה', 'מחיקה']);
});

test('a pack name containing markup is shown as text', () => {
  const { root, items } = setup([pack({ name: '<img src=x onerror=1>' })]);
  expect(root.querySelector('img')).toBeNull();
  expect(items()[0].textContent).toContain('<img src=x onerror=1>');
});

test('שחק passes the pack and the selected difficulty; עריכה passes the pack', () => {
  const p = pack();
  const { root, o, byText, items } = setup([p]);
  const select = root.querySelector<HTMLSelectElement>('select[name=difficulty]')!;
  byText('שחק', items()[0]).click();
  expect(o.onPlay).toHaveBeenLastCalledWith(p, 'beginner');
  select.value = 'expert'; select.dispatchEvent(new Event('change', { bubbles: true }));
  byText('שחק', items()[0]).click();
  expect(o.onPlay).toHaveBeenLastCalledWith(p, 'expert');
  byText('עריכה', items()[0]).click();
  expect(o.onEdit).toHaveBeenCalledWith(p);
});

test('deleting asks in the page first; only כן, למחוק deletes, ביטול brings the buttons back', () => {
  const a = pack({ id: 'a', name: 'א' });
  const b = pack({ id: 'b', name: 'ב' });
  const { o, byText, items, buttons } = setup([a, b]);
  byText('מחיקה', items()[1]).click();
  expect(o.onDelete).not.toHaveBeenCalled();
  expect(items()[1].textContent).toContain('למחוק את החבילה?');
  expect(buttons(items()[1]).map(x => x.textContent)).toEqual(['כן, למחוק', 'ביטול']);
  expect(buttons(items()[0]).map(x => x.textContent)).toEqual(['שחק', 'עריכה', 'מחיקה']);
  byText('ביטול', items()[1]).click();
  expect(o.onDelete).not.toHaveBeenCalled();
  expect(items()[1].textContent).not.toContain('למחוק את החבילה?');
  expect(buttons(items()[1]).map(x => x.textContent)).toEqual(['שחק', 'עריכה', 'מחיקה']);
  byText('מחיקה', items()[1]).click();
  byText('כן, למחוק', items()[1]).click();
  expect(o.onDelete).toHaveBeenCalledTimes(1);
  expect(o.onDelete).toHaveBeenCalledWith(b);
});

test('no browser dialogs are used', () => {
  const confirm = vi.spyOn(window, 'confirm').mockImplementation(() => true);
  const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  const { byText, items } = setup([pack()]);
  byText('מחיקה', items()[0]).click();
  byText('כן, למחוק', items()[0]).click();
  expect(confirm).not.toHaveBeenCalled();
  expect(alert).not.toHaveBeenCalled();
  confirm.mockRestore(); alert.mockRestore();
});

test('with no packs the friendly empty state shows, and a new pack can still be made', () => {
  const { root, items, byText, o } = setup([]);
  expect(items()).toHaveLength(0);
  expect(root.textContent).toContain('עוד אין חבילות. מוסיפים 3 עד 5 תרגילים מהחומר למבחן, והמשחק מכין תרגילים דומים.');
  byText('חבילה חדשה').click();
  expect(o.onNew).toHaveBeenCalledTimes(1);
});

test('a pack with no supported line says so and cannot be played, but can be edited or deleted', () => {
  const broken = pack({ examples: ['abc', '1 × 1', '((('] });
  const { o, byText, items } = setup([broken]);
  expect(items()[0].textContent).toContain('אין בחבילה תרגילים שאפשר לתרגל');
  expect(items()[0].textContent).not.toContain('סוגי תרגילים');
  const play = byText('שחק', items()[0]);
  expect(play.disabled).toBe(true);
  play.click();
  expect(o.onPlay).not.toHaveBeenCalled();
  expect(byText('עריכה', items()[0]).disabled).toBe(false);
  expect(byText('מחיקה', items()[0]).disabled).toBe(false);
});
