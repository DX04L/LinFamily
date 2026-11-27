window.lfHomeSwipe = function ({ activeTab, selectTab, prepareTab, hasAdd }) {
  const page = document.body, root = document.documentElement;
  const welcome = document.getElementById('lfWelcome');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const busy = 'dialog[open], #lfMenu:not([hidden]), .clc-tb-menu:not([hidden]), .todo-edit, ' +
    '.reorder-source, .reorder-floating, .is-dragging, .dk-root.is-editing, .slot-grid.is-editing, ' +
    '.slot-floating, .clc-hmenu, .dk-menu:not(.lfc-options):not([hidden]), .dk-sel, .ui-resizable-resizing, .ui-draggable-dragging, ' +
    '#panelFamily:not([hidden]) .lfc-options:not([hidden]), ' +
    '.grid-stack-item.ui-draggable-dragging, .lfc-pop, .lfc-view, .lfc-cam, .lfc-stks:not([hidden])';
  const controls = 'input, textarea, select, dialog, [role="dialog"], [contenteditable], iframe, video, audio, ' +
    '.ui-resizable-handle, .lfc-rz, .lfc-down';
  let gesture, visual, settling = false;

  function canSwipe(tab) {
    return (tab === 'apps' || tab === 'family') && welcome.hidden &&
      innerWidth <= 1023 && !document.querySelector(busy);
  }

  function blocked(node, surface) {
    if (node.closest(controls)) return true;
    for (let el = node; el && el !== surface; el = el.parentElement) {
      if (el.scrollWidth > el.clientWidth + 4 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
    }
    return false;
  }

  const transform = x => `translate3d(${x}px,0,0)`;
  function nextTab(tab) {
    // Home 在工具列內的 ID 是 apps，App 櫃是 all。
    return tab === 'apps' ? 'family' : 'apps';
  }

  function cloneDecoration(element) {
    const clone = element.cloneNode(true);
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    return clone;
  }

  function draw(g) {
    if (!visual) {
      const next = nextTab(g.tab);
      const panel = document.getElementById(next === 'family' ? 'panelFamily' : 'panelApps');
      const current = document.getElementById(g.tab === 'family' ? 'panelFamily' : 'panelApps');
      const { top } = current.getBoundingClientRect();
      const nextIsFamily = next === 'family';
      const frame = document.createElement('div');
      frame.className = 'lf-swipe-frame';
      frame.inert = true;
      frame.setAttribute('aria-hidden', 'true');

      const wallpaper = document.querySelector('.lf-wall:not([hidden])');
      if (wallpaper) frame.append(cloneDecoration(wallpaper));
      const header = cloneDecoration(document.querySelector('.lf-top'));
      header.querySelectorAll('[data-tab]').forEach(button => {
        button.setAttribute('aria-selected', String(button.dataset.tab === next));
      });
      header.querySelector('.clc-tb-btn').hidden = !hasAdd(next);
      frame.append(header);

      const search = document.querySelector('main > .clc-tb-search:not([hidden])');
      if (search) {
        const clone = cloneDecoration(search);
        const rect = search.getBoundingClientRect();
        clone.querySelector('input').value = search.querySelector('input').value;
        Object.assign(clone.style, {
          position: 'absolute', top: rect.top + 'px', left: rect.left + 'px',
          width: rect.width + 'px', margin: '0'
        });
        frame.append(clone);
      }

      panel.style.setProperty('--lf-swipe-top', (top + (nextIsFamily ? 10 : -10)) + 'px');
      panel.inert = true;
      page.append(frame);
      root.classList.add('lf-swiping');
      panel.classList.add('lf-swipe-incoming');
      visual = { frame, panel, distance: innerWidth, original: page.style.transform };
      prepareTab(next);
    }
    const dx = Math.max(-visual.distance, Math.min(visual.distance, g.dx));
    page.style.setProperty('--lf-swipe-side', (dx < 0 ? visual.distance : -visual.distance) + 'px');
    page.style.transform = transform(dx);
  }

  function restore() {
    page.style.transform = visual.original;
    page.style.removeProperty('--lf-swipe-side');
    visual.panel.classList.remove('lf-swipe-incoming');
    visual.panel.style.removeProperty('--lf-swipe-top');
    visual.panel.inert = false;
    visual.frame.remove();
    root.classList.remove('lf-swiping');
    visual = null;
  }

  async function settle(g, next) {
    settling = true;
    if (visual) {
      const dx = Math.max(-visual.distance, Math.min(visual.distance, g.dx));
      const offscreen = g.dx < 0 ? -visual.distance : visual.distance;
      const duration = next ? 200 : 160;
      const easing = next ? 'cubic-bezier(.2,.7,.3,1)' : 'ease-out';
      const slide = page.animate(
        [{ transform: transform(dx) }, { transform: transform(next ? offscreen : 0) }],
        { duration, easing, fill: 'forwards' }
      );
      try { await slide.finished; } catch (_) { next = null; }
      slide.cancel();
      restore();
    }
    settling = false;
    if (next && activeTab() === g.tab && canSwipe(g.tab)) selectTab(next);
  }

  function cancel() {
    const g = gesture;
    gesture = null;
    if (visual && g) settle(g);
  }

  document.addEventListener('touchstart', e => {
    if (settling) return;
    if (gesture) return cancel();
    const tab = activeTab();
    if (e.touches.length !== 1 || !canSwipe(tab)) return;
    const target = e.target;
    const surface = target.closest('.lfc-list, .lf-family-scroll, main > section, .lf-top, main');
    if (!surface || blocked(target, surface)) return;
    const t = e.touches[0];
    const edge = innerWidth * .1; // 左右各留 10% 給系統手勢
    if (t.clientX < edge || t.clientX > innerWidth - edge) return;
    gesture = { tab, id: t.identifier, x: t.clientX, y: t.clientY, at: performance.now(), horizontal: false, dx: 0 };
  }, { capture: true, passive: true });

  document.addEventListener('touchmove', e => {
    if (!gesture) return;
    if (e.touches.length !== 1 || !canSwipe(gesture.tab) || activeTab() !== gesture.tab) return cancel();
    const t = e.touches[0], dx = t.clientX - gesture.x, dy = t.clientY - gesture.y;
    if (t.identifier !== gesture.id) return cancel();
    if (!gesture.horizontal) {
      if (Math.abs(dy) > 22 && Math.abs(dy) > Math.abs(dx) * 1.2) return cancel();
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      gesture.horizontal = true;
    }
    gesture.dx = dx;
    if (e.cancelable) e.preventDefault();
    if (!reduceMotion.matches) draw(gesture);
  }, { capture: true, passive: false });

  document.addEventListener('touchend', e => {
    const g = gesture;
    if (!g || !g.horizontal || !canSwipe(g.tab) || activeTab() !== g.tab) return cancel();
    if (e.cancelable) e.preventDefault();
    const fast = Math.abs(g.dx) >= 28 && performance.now() - g.at < 320;
    if (!fast && Math.abs(g.dx) < Math.max(40, innerWidth * .11)) return cancel();
    gesture = null;
    settle(g, nextTab(g.tab));
  }, { capture: true, passive: false });

  document.addEventListener('touchcancel', cancel, { passive: true });
};
