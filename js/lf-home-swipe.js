window.lfHomeSwipe = function ({ tabs, activeTab, selectTab, needsPin }) {
  const welcome = document.getElementById('lfWelcome');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const busy = 'dialog[open]:not(.lf-pin), #lfMenu:not([hidden]), .clc-tb-menu:not([hidden]), .todo-edit, ' +
    '.reorder-source, .reorder-floating, .is-dragging, .dk-root.is-editing, .slot-grid.is-editing, ' +
    '.slot-floating, .clc-hmenu, .dk-menu, .dk-sel, .ui-resizable-resizing, .ui-draggable-dragging, ' +
    '.grid-stack-item.ui-draggable-dragging, .lfc-pop, .lfc-view, .lfc-cam, .lfc-stks:not([hidden])';
  const controls = 'input, textarea, select, dialog, [role="dialog"], [contenteditable], iframe, video, audio, ' +
    '.ui-resizable-handle, .lfc-rz, .lfc-down';
  let gesture, visual, settling = false;

  const openPin = () => document.querySelector('dialog.lf-pin[open]');
  function canSwipe(pin = null) {
    return welcome.hidden && innerWidth <= 1023 && openPin() === pin && !document.querySelector(busy);
  }

  function blocked(node, surface) {
    if (node.closest(controls)) return true;
    for (let el = node; el && el !== surface; el = el.parentElement) {
      if (el.scrollWidth > el.clientWidth + 4 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
    }
    return false;
  }

  const transform = x => `translate3d(${x}px,0,0)`;
  function nextTab(g) {
    const index = tabs.findIndex(tab => tab.id === (g.pin ? 'all' : g.tab));
    return tabs[(index + (g.dx < 0 ? 1 : tabs.length - 1)) % tabs.length];
  }

  function draw(g) {
    if (!visual) {
      const rect = g.surface.getBoundingClientRect();
      const viewport = document.createElement('div');
      const layer = document.createElement('div');
      viewport.setAttribute('aria-hidden', 'true');
      viewport.className = 'lf-swipe-viewport';
      const chatTab = g.surface.matches('.lf-family-scroll') && document.querySelector('.lfc-tab:not([hidden])');
      const bottom = chatTab ? Math.min(rect.bottom, chatTab.getBoundingClientRect().top) : rect.bottom;
      const list = g.surface.matches('.lfc-list');
      Object.assign(viewport.style, {
        top: rect.top + 'px', height: Math.max(0, bottom - rect.top) + 'px',
        left: (list ? rect.left : 0) + 'px', width: (list ? rect.width : innerWidth) + 'px'
      });
      layer.className = 'lf-swipe-preview';
      layer.append(document.createElement('strong'));
      viewport.append(layer);
      document.body.append(viewport);
      visual = { viewport, layer, surface: g.surface, distance: list ? rect.width : innerWidth, original: g.surface.style.transform };
    }
    const dx = Math.max(-visual.distance, Math.min(visual.distance, g.dx));
    visual.layer.firstElementChild.textContent = nextTab(g).label;
    visual.surface.style.transform = transform(dx);
    visual.layer.style.transform = transform((dx < 0 ? visual.distance : -visual.distance) + dx);
  }

  function restore() {
    if (!visual) return;
    visual.surface.style.transform = visual.original;
    visual.viewport.remove();
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
      const outgoing = visual.surface.animate(
        [{ transform: transform(dx) }, { transform: transform(next ? offscreen : 0) }], options);
      const incoming = visual.layer.animate(
        [{ transform: transform(dx - offscreen) }, { transform: transform(next ? 0 : -offscreen) }], options);
      await Promise.allSettled([outgoing.finished, incoming.finished]);
      outgoing.cancel();
      incoming.cancel();
      restore();
    }
    settling = false;
    if (next && activeTab() === g.tab && canSwipe()) selectTab(next.id);
  }

  function cancel() {
    const g = gesture;
    gesture = null;
    if (visual && g) settle(g);
  }

  document.addEventListener('touchstart', e => {
    if (settling) return;
    if (gesture) return cancel();
    const pin = openPin();
    if (e.touches.length !== 1 || !canSwipe(pin) || (pin && !pin.contains(e.target))) return;
    const tab = activeTab();
    const panel = tabs.find(item => item.id === tab).panel;
    const surface = tab === 'family'
      ? e.target.closest('.lfc-list, .lf-family-scroll')
      : panel;
    if (!pin && (!surface || !panel.contains(surface) || !surface.contains(e.target) || blocked(e.target, surface))) return;
    const t = e.touches[0];
    const edge = innerWidth * .1; // 左右各留 10% 給系統手勢
    if (t.clientX < edge || t.clientX > innerWidth - edge) return;
    gesture = { tab, surface, pin, id: t.identifier, x: t.clientX, y: t.clientY, at: performance.now(), horizontal: false, dx: 0 };
  }, { capture: true, passive: true });

  document.addEventListener('touchmove', e => {
    if (!gesture) return;
    if (e.touches.length !== 1 || !canSwipe(gesture.pin) || activeTab() !== gesture.tab) return cancel();
    const t = e.touches[0], dx = t.clientX - gesture.x, dy = t.clientY - gesture.y;
    if (t.identifier !== gesture.id) return cancel();
    if (!gesture.horizontal) {
      if (Math.abs(dy) > 22 && Math.abs(dy) > Math.abs(dx) * 1.2) return cancel();
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      gesture.horizontal = true;
    }
    gesture.dx = dx;
    if (e.cancelable) e.preventDefault();
    if (!gesture.pin && !reduceMotion.matches) draw(gesture);
  }, { capture: true, passive: false });

  document.addEventListener('touchend', e => {
    const g = gesture;
    if (!g || !g.horizontal || !canSwipe(g.pin) || activeTab() !== g.tab) return cancel();
    if (e.cancelable) e.preventDefault();
    const fast = Math.abs(g.dx) >= 28 && performance.now() - g.at < 320;
    if (!fast && Math.abs(g.dx) < Math.max(40, innerWidth * .11)) return cancel();
    const next = nextTab(g);
    gesture = null;
    if (g.pin) {
      // 密碼視窗代表 Apps；從這裡往任一方向滑，關閉視窗並移到相鄰分頁。
      g.pin.close();
      if (next.id !== g.tab) selectTab(next.id);
      return;
    }
    // App 櫃鎖住時先回彈，再走工具列原本的密碼流程。
    if (needsPin(next.id)) {
      settle(g).then(() => {
        if (activeTab() === g.tab && canSwipe()) selectTab(next.id);
      });
    } else {
      settle(g, next);
    }
  }, { capture: true, passive: false });

  document.addEventListener('touchcancel', cancel, { passive: true });
};
