// LF 的待辦區域和待辦存於目前登入者的私人桌面文件。
window.lfDesktopTodos = function (host, { db, toast, layout: deskLayout }) {
  const cards = new Map(), listeners = new Map();
  let owner = '', areas = {};
  // layout：共用桌面（shared/desktop）傳進來就用它放卡片；沒有就用舊的 dashboard-widgets
  const layout = deskLayout || window.clcDashboardWidgets(host, {
    key: () => 'linfamily_todo_layout:' + owner,
    canEdit: () => !!owner,
    async remove(id) {
      if (!confirm('確定刪除此區塊和裡面的待辦事項？')) return;
      try { await change(next => { delete next[id]; }); }
      catch (_) { toast('待辦區塊更新失敗，請稍後再試。'); }
    }
  });
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

  function sync(email, next = {}) {
    if (email !== owner) {
      for (const [id, card] of cards) { card.dispose(); layout.detach(id); }
      cards.clear();
      owner = email;
      areas = {};
    }
    if (!owner) next = {};
    for (const [id, card] of cards) {
      if (Object.hasOwn(next, id)) continue;
      card.dispose();
      layout.detach(id);
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
      el.className = 'lf-todo-card dash-widget';
      el.dataset.widget = 'todo';
      el.dataset.widgetId = id;
      el.setAttribute('aria-labelledby', 'todoTitle-' + id);
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'drag-handle dk-handle';
      handle.setAttribute('aria-label', '拖曳移動');
      el.append(handle, window.clcBuildTodoFields(id));
      el.querySelector('h2').textContent = area.title || '代辦事項';
      layout.attach(el, id);
      cards.set(id, { el, dispose: mount(el, id) });
    }
  }

  return {
    sync,
    // 共用桌面刪除（已在確認框確認過）
    async removeArea(id) {
      try { await change(next => { delete next[id]; }); }
      catch (_) { toast('待辦區塊更新失敗，請稍後再試。'); }
    },
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
