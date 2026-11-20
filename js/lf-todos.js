// LF 的待辦區域和待辦存於目前登入者的私人桌面文件。
window.lfDesktopTodos = function (host, { db, toast }) {
  const cards = new Map(), listeners = new Map();
  let owner = '', areas = {};
  let mount;
  window.clcMountTodos({
    find: (widget, id) => widget.querySelector('[data-todo-field="' + id + '"]'),
    register: (_, init) => { mount = init; }
  }, {
    access: () => !!owner,
    account: () => owner,
    orderNamespace: 'linfamily_todo_order',
    transcribeUrl: 'https://clc-dx04.pages.dev/api/transcribe',
    store: {
      id: () => crypto.randomUUID(),
      watch(area, receive) {
        listeners.set(area, receive);
        receive(documents(areas[area]));
        return () => listeners.delete(area);
      },
      set: (area, id, value) => change(next => { tasks(next, area)[id] = value; }),
      update: (area, id, patch) => change(next => {
        const items = tasks(next, area);
        if (items[id]) items[id] = { ...items[id], ...patch };
      }),
      remove: (area, id) => change(next => { delete tasks(next, area)[id]; }),
      move: (from, to, id) => change(next => {
        const source = tasks(next, from);
        if (!source[id]) return false;
        tasks(next, to)[id] = source[id];
        delete source[id];
        return true;
      })
    }
  });

  function documents(area) {
    return Object.entries(area?.items || {}).map(([id, value]) => ({ id, data: () => value }));
  }

  function tasks(next, area) {
    if (!next[area]) throw new Error('待辦區域已移除');
    return next[area].items ||= {};
  }

  function change(operation) {
    if (!owner || !db) return Promise.reject(new Error('尚未登入'));
    const ref = db.collection('linfamily_desktops').doc(owner);
    return db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const next = snap.data()?.todoAreas || {};
      const result = operation(next);
      if (result === false) return false;
      tx.set(ref, { todoAreas: next }, { mergeFields: ['todoAreas'] });
      return true;
    });
  }

  function ordered(data) {
    return Object.keys(data).sort((a, b) =>
      (data[a]?.position ?? Number.MAX_SAFE_INTEGER) - (data[b]?.position ?? Number.MAX_SAFE_INTEGER));
  }

  function cardMenu(el, id) {
    const header = el.firstElementChild;
    const actions = document.createElement('div');
    actions.className = 'lf-todo-actions';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '⋯';
    button.setAttribute('aria-label', '待辦區塊選單');
    button.setAttribute('aria-expanded', 'false');
    const menu = document.createElement('div');
    menu.className = 'lf-menu';
    menu.hidden = true;
    function toggle(open) {
      menu.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
    }
    for (const [label, step] of [['往前移', -1], ['往後移', 1], ['刪除區塊', 0]]) {
      const action = document.createElement('button');
      action.type = 'button';
      action.textContent = label;
      if (!step) action.className = 'lf-danger';
      action.addEventListener('click', async () => {
        toggle(false);
        if (!step && !confirm('確定刪除此區塊和裡面的待辦事項？')) return;
        try {
          await change(next => {
            if (!Object.hasOwn(next, id)) return false;
            if (!step) { delete next[id]; return true; }
            const order = ordered(next);
            const from = order.indexOf(id), to = from + step;
            if (!order[to]) return false;
            [order[from], order[to]] = [order[to], order[from]];
            order.forEach((key, position) => { next[key].position = position; });
            return true;
          });
        } catch (_) { toast('待辦區塊更新失敗，請稍後再試。'); }
      });
      menu.append(action);
    }
    actions.append(button, menu);
    header.append(actions);
    function openMenu() {
      for (const active of host.querySelectorAll('.lf-todo-actions [aria-expanded="true"]')) {
        if (active !== button) active.click();
      }
      const order = ordered(areas);
      const position = order.indexOf(id);
      menu.children[0].disabled = position <= 0;
      menu.children[1].disabled = position >= order.length - 1;
      toggle(true);
    }
    button.addEventListener('click', () => menu.hidden ? openMenu() : toggle(false));
    el.addEventListener('contextmenu', e => {
      if (e.target.closest('input, textarea, select, .todo-row')) return;
      e.preventDefault();
      openMenu();
    });
    return toggle;
  }

  document.addEventListener('pointerdown', e => {
    for (const { el, toggleMenu } of cards.values()) {
      if (!el.querySelector('.lf-todo-actions').contains(e.target)) toggleMenu(false);
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') for (const { toggleMenu } of cards.values()) toggleMenu(false);
  });

  function sync(email, next = {}) {
    if (email !== owner) {
      for (const card of cards.values()) { card.dispose(); card.el.remove(); }
      cards.clear();
      owner = email;
      areas = {};
    }
    if (!owner) next = {};
    for (const [id, card] of cards) {
      if (Object.hasOwn(next, id)) continue;
      card.dispose();
      card.el.remove();
      cards.delete(id);
    }
    const previous = areas;
    areas = next;
    for (const id of ordered(areas)) {
      const area = areas[id];
      if (!/^area-[a-f0-9-]+$/.test(id) || !area) continue;
      if (cards.has(id)) {
        if (JSON.stringify(previous[id]?.items) !== JSON.stringify(area.items)) {
          listeners.get(id)?.(documents(area));
        }
        continue;
      }
      const el = document.createElement('section');
      el.className = 'lf-todo-card';
      el.dataset.widget = 'todo';
      el.dataset.widgetId = id;
      el.setAttribute('aria-labelledby', 'todoTitle-' + id);
      el.append(window.clcBuildTodoFields(id));
      el.querySelector('h2').textContent = area.title || '代辦事項';
      host.append(el);
      cards.set(id, { el, toggleMenu: cardMenu(el, id), dispose: mount(el, id) });
    }
    const visible = ordered(areas).map(id => cards.get(id)?.el).filter(Boolean);
    visible.forEach((el, index) => {
      if (host.children[index] !== el) host.insertBefore(el, host.children[index] || null);
    });
  }

  return {
    sync,
    async add() {
      if (!owner) return;
      const email = owner;
      const id = 'area-' + crypto.randomUUID();
      try {
        await change(next => {
          const order = ordered(next);
          order.forEach((key, position) => { next[key].position = position; });
          next[id] = { title: '代辦事項', position: order.length, items: {} };
        });
        if (owner !== email) return;
        // Firestore may publish the snapshot just after the write promise settles.
        requestAnimationFrame(() => {
          const card = cards.get(id)?.el;
          card?.scrollIntoView({ block: 'nearest' });
          card?.querySelector('textarea')?.focus({ preventScroll: true });
        });
      } catch (error) {
        console.warn('LF 待辦區域新增失敗', error);
        toast('無法新增待辦事項區域，請稍後再試。');
      }
    }
  };
};
