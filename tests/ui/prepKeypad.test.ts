import { KEYS, renderKeypad } from '../../src/ui/prepKeypad';

function setup() {
  const onKey = vi.fn<(key: string) => void>();
  const pad = renderKeypad(onKey);
  document.body.append(pad);
  const buttons = () => [...pad.querySelectorAll('button')];
  const byText = (t: string) => buttons().find(b => b.textContent === t)!;
  return { pad, onKey, buttons, byText };
}
afterEach(() => { document.body.innerHTML = ''; });

test('the key list is exactly as agreed, ? included', () => {
  expect([...KEYS]).toEqual(['7', '8', '9', '÷', '(', '4', '5', '6', '×', ')', '1', '2', '3', '−', '/', '0', '.', '+', '=', '▢', '?', '␣', '⌫']);
});

test('renders 23 buttons, one per key, in order', () => {
  const { buttons } = setup();
  expect(buttons()).toHaveLength(23);
  expect(buttons().map(b => b.textContent)).toEqual([...KEYS]);
  expect(buttons().every(b => b.type === 'button')).toBe(true);
});

test('clicking a key sends it; ␣ sends a space and ⌫ sends Backspace', () => {
  const { byText, onKey } = setup();
  byText('×').click();
  expect(onKey).toHaveBeenLastCalledWith('×');
  byText('?').click();
  expect(onKey).toHaveBeenLastCalledWith('?');
  byText('␣').click();
  expect(onKey).toHaveBeenLastCalledWith(' ');
  byText('⌫').click();
  expect(onKey).toHaveBeenLastCalledWith('Backspace');
  expect(onKey).toHaveBeenCalledTimes(4);
});

test('pressing a key does not take the focus away from the text field', () => {
  const { byText, onKey } = setup();
  for (const type of ['pointerdown', 'mousedown']) {
    const e = new Event(type, { bubbles: true, cancelable: true });
    byText('7').dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  }
  expect(onKey).not.toHaveBeenCalled();
});

test('the space and backspace keys have readable names', () => {
  const { byText } = setup();
  expect(byText('␣').getAttribute('aria-label')).toBe('רווח');
  expect(byText('⌫').getAttribute('aria-label')).toBe('מחיקת תו');
});
