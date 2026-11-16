/**
 * A "משחק חדש" button that asks before it throws the current game away: one tap shows the question,
 * a second tap on "כן, משחק חדש" confirms. Focus goes to the safe choice ("חזרה").
 */
export function newGameControl(onConfirm: () => void): HTMLElement {
  const box = document.createElement('div');
  box.className = 'new-game';

  const button = (text: string, className: string, onClick: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = className;
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  };

  const showButton = () => {
    box.replaceChildren(button('משחק חדש', 'link-btn', showQuestion));
  };
  const showQuestion = () => {
    const question = document.createElement('p');
    question.className = 'new-game-question';
    question.textContent = 'להתחיל משחק חדש? ההתקדמות במשחק הזה תימחק.';
    const back = button('חזרה', 'secondary', showButton);
    const sure = button('כן, משחק חדש', 'danger', onConfirm);
    const row = document.createElement('div');
    row.className = 'new-game-row';
    row.append(sure, back);
    box.replaceChildren(question, row);
    back.focus();
  };

  showButton();
  return box;
}
