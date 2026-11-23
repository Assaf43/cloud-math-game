export const KEYS = ['7','8','9','÷','(','4','5','6','×',')','1','2','3','−','/','0','.','+','=','▢','?','␣','⌫'] as const;   // '?' added 2026-11-19 (owner decision): needed to type "3/4 = ?" on a phone

const SENDS: Record<string, string> = { '␣': ' ', '⌫': 'Backspace' };
const NAMES: Record<string, string> = { '␣': 'רווח', '⌫': 'מחיקת תו' };

/** The exercise keypad. Its buttons never take the focus, so the row being typed into keeps its caret. */
export function renderKeypad(onKey: (key: string) => void): HTMLElement {
  const pad = document.createElement('div');
  pad.className = 'keypad';
  pad.dir = 'ltr';
  for (const key of KEYS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'keypad-key';
    b.textContent = key;
    if (NAMES[key]) b.setAttribute('aria-label', NAMES[key]);
    const keep = (e: Event) => e.preventDefault();
    b.addEventListener('pointerdown', keep);
    b.addEventListener('mousedown', keep);
    b.addEventListener('click', () => onKey(SENDS[key] ?? key));
    pad.append(b);
  }
  return pad;
}
