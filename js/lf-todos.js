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
    for (const [id, area] of Object.entries(areas)) {
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
      cards.set(id, { el, dispose: mount(el, id) });
    }
  }

  return {
    sync,
    async add() {
      if (!owner) return;
      const email = owner;
      const id = 'area-' + crypto.randomUUID();
      try {
        await change(next => { next[id] = { title: '代辦事項', items: {} }; });
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
