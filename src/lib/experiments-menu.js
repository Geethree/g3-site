// Native details handles clicking and keyboard toggling. Add hover and dismissal.
for (const menu of document.querySelectorAll('details.experiments')) {
  const trigger = menu.querySelector('summary');
  let timer;
  let keyboard = false;
  const cancel = () => clearTimeout(timer);
  const close = () => { cancel(); menu.open = false; };
  const hasKeyboardFocus = () => keyboard && menu.contains(document.activeElement);

  document.addEventListener('keydown', event => {
    keyboard = true;
    if (event.key === 'Escape' && menu.open) {
      close(); trigger.focus(); event.preventDefault();
    }
  });
  document.addEventListener('pointerdown', event => {
    keyboard = false;
    if (!menu.contains(event.target)) close();
  });
  menu.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse') { cancel(); menu.open = true; }
  });
  menu.addEventListener('pointerleave', event => {
    if (event.pointerType === 'mouse' && !hasKeyboardFocus()) {
      cancel(); timer = setTimeout(() => { if (!hasKeyboardFocus()) close(); }, 150);
    }
  });
  menu.addEventListener('focusin', cancel);
  menu.addEventListener('focusout', event => {
    if (!menu.contains(event.relatedTarget)) close();
  });
}
