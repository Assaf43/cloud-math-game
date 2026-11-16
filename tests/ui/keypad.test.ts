import { Keypad } from '../../src/ui/keypad';

test('each key reports its value', () => {
  const root = document.createElement('div');
  const onKey = vi.fn();
  new Keypad(root, onKey);
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('button')];
  expect(buttons).toHaveLength(15);
  const keys = buttons.map(b => b.dataset.key);
  expect([...keys].sort()).toEqual(['/', '.', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'backspace', 'enter', 'space'].sort());
  buttons.forEach(b => b.click());
  expect(onKey.mock.calls.map(c => c[0])).toEqual(keys);
});

test('buttons never take focus (the system keyboard must not open) and are not form submitters', () => {
  const root = document.createElement('div'); document.body.append(root);
  new Keypad(root, () => {});
  const b = root.querySelector<HTMLButtonElement>('button')!;
  expect(b.type).toBe('button');
  const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
  b.dispatchEvent(ev);
  expect(ev.defaultPrevented).toBe(true);
  expect(root.querySelector('input, textarea')).toBeNull();
  root.remove();
});

test('keys have readable labels, the enter key is the confirm button', () => {
  const root = document.createElement('div'); new Keypad(root, () => {});
  expect(root.querySelector('[data-key=enter]')!.textContent).toBe('אישור');
  expect(root.querySelector('[data-key=backspace]')!.getAttribute('aria-label')).toBe('מחק');
  expect(root.querySelector('[data-key=space]')!.getAttribute('aria-label')).toBe('רווח');
});
