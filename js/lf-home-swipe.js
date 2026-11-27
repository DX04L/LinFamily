window.lfHomeSwipe = function ({ activeTab, selectTab, prepareTab }) {
  const root = document.documentElement;
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

  function indicatorTransform(progress) {
    const { start, end } = visual;
    const x = (end.left - start.left) * progress;
    const width = start.width + (end.width - start.width) * progress;
    return `${transform(x)} scaleX(${width / start.width})`;
  }

  function draw(g) {
    if (!visual) {
      const next = nextTab(g.tab);
      const panel = document.getElementById(next === 'family' ? 'panelFamily' : 'panelApps');
      const current = document.getElementById(g.tab === 'family' ? 'panelFamily' : 'panelApps');
      const { top } = current.getBoundingClientRect();
      const tabs = document.querySelector('#lfToolbar .clc-tb-tabs');
      const start = tabs.querySelector(`[data-tab="${g.tab}"]`).getBoundingClientRect();
      const end = tabs.querySelector(`[data-tab="${next}"]`).getBoundingClientRect();
      const indicator = document.createElement('span');
      indicator.className = 'lf-swipe-tab-indicator';
      indicator.setAttribute('aria-hidden', 'true');

      panel.style.setProperty('--lf-swipe-top', (top + (next === 'family' ? 10 : -10)) + 'px');
      panel.inert = true;
      root.classList.add('lf-swiping');
      panel.classList.add('lf-swipe-incoming');

      const tabBounds = tabs.getBoundingClientRect();
      Object.assign(indicator.style, {
        left: (start.left - tabBounds.left - tabs.clientLeft) + 'px',
        top: (start.top - tabBounds.top - tabs.clientTop) + 'px',
        width: start.width + 'px', height: start.height + 'px'
      });
      tabs.prepend(indicator);
      visual = { panel, current, indicator, start, end, distance: innerWidth };
      prepareTab(next);
    }
    const dx = Math.max(-visual.distance, Math.min(visual.distance, g.dx));
    const side = dx < 0 ? visual.distance : -visual.distance;
    visual.current.style.transform = transform(dx);
    visual.panel.style.transform = transform(side + dx);
    visual.indicator.style.transform = indicatorTransform(Math.abs(dx) / visual.distance);
  }

  function restore() {
    visual.current.style.removeProperty('transform');
    visual.panel.style.removeProperty('transform');
    visual.panel.classList.remove('lf-swipe-incoming');
    visual.panel.style.removeProperty('--lf-swipe-top');
    visual.panel.inert = false;
    visual.indicator.remove();
    root.classList.remove('lf-swiping');
    visual = null;
  }

  async function settle(g, next) {
    settling = true;
    if (visual) {
      const dx = Math.max(-visual.distance, Math.min(visual.distance, g.dx));
      const offscreen = g.dx < 0 ? -visual.distance : visual.distance;
      const options = next
        ? { duration: 200, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }
        : { duration: 160, easing: 'ease-out', fill: 'forwards' };
      const slides = [
        visual.current.animate([
          { transform: transform(dx) }, { transform: transform(next ? offscreen : 0) }
        ], options),
        visual.panel.animate([
          { transform: transform(dx - offscreen) }, { transform: transform(next ? 0 : -offscreen) }
        ], options),
        visual.indicator.animate([
          { transform: indicatorTransform(Math.abs(dx) / visual.distance) },
          { transform: indicatorTransform(next ? 1 : 0) }
        ], options)
      ];
      try { await Promise.all(slides.map(slide => slide.finished)); } catch (_) { next = null; }
      slides.forEach(slide => slide.cancel());
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
