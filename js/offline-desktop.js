(() => {
  const desktop = document.getElementById('offline-desktop');
  const list = document.getElementById('offline-apps');
  if (!desktop || !window.firebase) return;
  firebase.initializeApp(lfFirebaseConfig);
  firebase.auth().onAuthStateChanged(user => {
    list.replaceChildren();
    desktop.hidden = true;
    if (!user?.emailVerified) return;

    // Firebase 的本機登入狀態決定可讀取哪個帳號的唯讀清單。
    let items, layout;
    try {
      items = JSON.parse(localStorage.getItem('linfamily_offline_desktop_' + user.uid));
      const mode = matchMedia('(max-width:699px)').matches ? 'phone' : 'desktop';
      layout = JSON.parse(localStorage.getItem('linfamily_layout_' + mode + '_' + user.uid));
    } catch (_) { return; }
    if (!Array.isArray(items)) return;
    const order = app => {
      const cell = layout?.[app.id];
      return cell ? 100 * cell.y + cell.x : app.pos;
    };
    items.sort((a, b) => order(a) - order(b));
    for (const app of items) {
      let target;
      try { target = new URL(app.href, location.href); } catch (_) { continue; }
      if (app.href === '#' || !/^https?:$/.test(target.protocol)) continue;
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = target.href;
      link.textContent = app.name;
      item.append(link);
      list.append(item);
    }
    desktop.hidden = !list.childElementCount;
  });
})();
