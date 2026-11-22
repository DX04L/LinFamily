/* pinky-ui.js — Pinky Jump UI manager (the standard game approach: one screen + one popup stack).
 * 1. Screens: start / gameover / record are mutually exclusive. Always switch with pinkyUI.screen(name);
 *    pinkyUI.screen(null) hides them all (during play). Never toggle those panels' .hidden directly.
 * 2. Popups (<dialog> leaderboard / settings / install): a stack. Opening one hides the one below;
 *    closing (✕, Escape, backdrop) reveals the previous one. Only the top popup is ever visible.
 *    Existing showModal()/close() calls go through the stack automatically.
 * Load before game.js and pinky-online.js.
 */
(function () {
  const SCREENS = { start: 'start-panel', gameover: 'gameover-panel', record: 'record-panel' };
  let current = 'start';

  function screen(name) {
    current = name || null;
    for (const [key, id] of Object.entries(SCREENS)) {
      document.getElementById(id)?.classList.toggle('hidden', key !== current);
    }
  }

  const stack = [];
  function hook(dialog) {
    if (!dialog || dialog.__pinkyHooked) return;
    dialog.__pinkyHooked = true;
    const rawShow = dialog.showModal.bind(dialog);
    const rawClose = dialog.close.bind(dialog);
    dialog.showModal = function () {
      if (dialog.open) return;
      const top = stack[stack.length - 1];
      if (top && top !== dialog && top.open) { top.__pinkyCovered = true; rawCloseOf(top)(); }
      const at = stack.indexOf(dialog);
      if (at >= 0) stack.splice(at, 1);
      stack.push(dialog);
      rawShow();
    };
    dialog.__pinkyRawShow = rawShow;
    dialog.__pinkyRawClose = rawClose;
    // Registered before any other close listener, so a "covered" close stays silent.
    dialog.addEventListener('close', event => {
      if (dialog.__pinkyCovered) { dialog.__pinkyCovered = false; event.stopImmediatePropagation(); return; }
      const at = stack.indexOf(dialog);
      if (at >= 0) stack.splice(at, 1);
      const prev = stack[stack.length - 1];
      if (prev && !prev.open) prev.__pinkyRawShow();
    });
  }
  function rawCloseOf(dialog) { return dialog.__pinkyRawClose || dialog.close.bind(dialog); }

  document.querySelectorAll('dialog').forEach(hook);

  window.pinkyUI = {
    screen,
    current: () => current,
    top: () => stack[stack.length - 1] || null,
    hook,
    /** Close every popup at once (no previous one is revealed). */
    closeAll() { while (stack.length) { const d = stack.pop(); if (d.open) rawCloseOf(d)(); } }
  };
})();
