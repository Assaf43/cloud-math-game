import { newGameControl } from '../../src/ui/newGameControl';

function setup() {
  const onConfirm = vi.fn();
  const el = newGameControl(onConfirm);
  document.body.append(el);
  const buttons = () => [...el.querySelectorAll('button')];
  const byText = (t: string) => buttons().find(b => b.textContent === t)!;
  return { el, onConfirm, buttons, byText };
}
afterEach(() => { document.body.innerHTML = ''; });

test('shows one "משחק חדש" button and does nothing by itself', () => {
  const { buttons, onConfirm } = setup();
  expect(buttons().map(b => b.textContent)).toEqual(['משחק חדש']);
  expect(buttons()[0].type).toBe('button');
  expect(onConfirm).not.toHaveBeenCalled();
});

test('clicking asks for confirmation first, then starts a new game only on "כן"', () => {
  const { el, byText, buttons, onConfirm } = setup();
  byText('משחק חדש').click();
  expect(onConfirm).not.toHaveBeenCalled();
  expect(el.textContent).toContain('להתחיל משחק חדש?');
  expect(buttons().map(b => b.textContent)).toEqual(['כן, משחק חדש', 'חזרה']);
  byText('כן, משחק חדש').click();
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

test('"חזרה" goes back to the single button and nothing happens', () => {
  const { el, byText, buttons, onConfirm } = setup();
  byText('משחק חדש').click(); byText('חזרה').click();
  expect(buttons().map(b => b.textContent)).toEqual(['משחק חדש']);
  expect(el.textContent).not.toContain('להתחיל משחק חדש?');
  expect(onConfirm).not.toHaveBeenCalled();
});

test('the confirmation can be reached with the keyboard: focus moves to the safe choice', () => {
  const { byText } = setup();
  byText('משחק חדש').click();
  expect(document.activeElement).toBe(byText('חזרה'));
});
