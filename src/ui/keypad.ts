/** On-screen keypad for touch devices. Buttons never take focus, so the system keyboard cannot open. */

type KeyDef = { key: string; label: string; aria?: string; className?: string };

const LAYOUT: KeyDef[] = [
  { key: '7', label: '7' }, { key: '8', label: '8' }, { key: '9', label: '9' },
  { key: '4', label: '4' }, { key: '5', label: '5' }, { key: '6', label: '6' },
  { key: '1', label: '1' }, { key: '2', label: '2' }, { key: '3', label: '3' },
  { key: '0', label: '0' }, { key: '.', label: '.' }, { key: '/', label: '/' },
  { key: 'space', label: '␣', aria: 'רווח' },
  { key: 'backspace', label: '⌫', aria: 'מחק' },
  { key: 'enter', label: 'אישור', className: 'key-enter' },
];

export class Keypad {
  constructor(root: HTMLElement, onKey: (key: string) => void) {
    const pad = document.createElement('div');
    pad.className = 'keypad';
    pad.dir = 'ltr';                       // digits keep a familiar phone layout
    for (const def of LAYOUT) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `key ${def.className ?? ''}`.trim();
      b.dataset.key = def.key;
      b.textContent = def.label;
      if (def.aria) b.setAttribute('aria-label', def.aria);
      b.addEventListener('mousedown', e => e.preventDefault());        // keep focus where it is
      b.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') e.preventDefault(); });
      b.addEventListener('click', () => onKey(def.key));
      pad.append(b);
    }
    root.append(pad);
  }
}
