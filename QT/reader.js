const QTReader = (() => {
  const colors = { 黃: 'F9DB82', 珊瑚: 'F7AE9C', 綠: 'BDE4A2', 藍: 'ADE4EE' };
  const storageKey = 'qt-annotations-v1';
  const $ = id => document.getElementById(id);
  const selection = () => window.getSelection();
  let options, toolbar, dialog, active, touch, records = {};

  function blocks(mode) {
    const elements = [...$(mode).querySelectorAll('p,h2,h3,li > span')];
    elements.forEach(el => el.setAttribute('data-lf-menu-ignore', ''));
    return elements;
  }

  function nodes(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const result = [];
    while (walker.nextNode()) result.push(walker.currentNode);
    return result;
  }

  function markContext(mode = options.getMode()) {
    const entry = options.getCurrent();
    return entry && JSON.stringify([entry.date, entry.scripture.reference, mode]);
  }

  function clear() {
    active = null;
    if (toolbar) toolbar.hidden = true;
  }

  function refresh(mode = options.getMode()) {
    const key = markContext(mode);
    if (!key) return;
    blocks('adult');
    blocks('kids');
    blocks(mode).forEach((block, index) => {
      [...block.querySelectorAll('mark.qt-mark')].forEach(mark => mark.replaceWith(...mark.childNodes));
      block.normalize();
      const text = block.textContent;
      const entries = (records[key] || []).flatMap(item => item.parts
        .filter(part => part.index === index && text.slice(part.start, part.end) === part.quote)
        .map(part => ({...part, item})));
      let offset = 0;
      for (const node of nodes(block)) {
        const value = node.data;
        const end = offset + value.length;
        const overlaps = entries.filter(part => part.start < end && part.end > offset);
        if (overlaps.length) {
          const cuts = [...new Set([offset, end, ...overlaps.flatMap(part => [
            Math.max(offset, part.start), Math.min(end, part.end),
          ])])].sort((a, b) => a - b);
          const content = document.createDocumentFragment();
          for (let i = 1; i < cuts.length; i++) {
            const start = cuts[i - 1], finish = cuts[i];
            const hit = overlaps.findLast(part => part.start <= start && part.end >= finish);
            const segment = value.slice(start - offset, finish - offset);
            if (!hit) content.append(segment);
            else {
              const mark = document.createElement('mark');
              mark.className = 'qt-mark';
              mark.dataset.color = hit.item.color || colors.黃;
              mark.style.setProperty('--mark', '#' + mark.dataset.color);
              if (hit.item.note) mark.setAttribute('data-note', '');
              mark.textContent = segment;
              mark.addEventListener('click', () => {
                if (selection()?.isCollapsed === false) return;
                active = { key, item: hit.item };
                toolbar.hidden = false;
              });
              content.append(mark);
            }
          }
          node.replaceWith(content);
        }
        offset = end;
      }
    });
  }

  function save(patch) {
    if (!active) return;
    const {key, item} = active;
    const updated = {...item, ...patch};
    const previous = records[key];
    records[key] = [...(previous || []).filter(saved => saved.id !== item.id), updated];
    try {
      localStorage.setItem(storageKey, JSON.stringify(records));
    } catch {
      records[key] = previous || [];
      status('無法儲存標記，請檢查此瀏覽器的網站儲存空間。');
      return;
    }
    clear();
    selection()?.removeAllRanges();
    refresh();
  }

  let messageTimer;
  function status(message) {
    const box = $('qt-reader-status');
    box.textContent = message;
    box.hidden = false;
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => { box.hidden = true; }, 2500);
  }

  function readSelection() {
    if (dialog.open) return;
    const value = selection();
    if (!value?.rangeCount || value.isCollapsed) {
      if (!active?.key || !(records[active.key] || []).some(item => item.id === active.item.id)) clear();
      return;
    }
    const key = markContext();
    if (!key) return clear();
    const range = value.getRangeAt(0);
    const panel = $(options.getMode());
    if (!panel.contains(range.startContainer) || !panel.contains(range.endContainer)) return clear();
    const parts = [];
    blocks(options.getMode()).forEach((block, index) => {
      if (!range.intersectsNode(block)) return;
      let offset = 0, start, end;
      for (const node of nodes(block)) {
        if (range.intersectsNode(node)) {
          start ??= offset + (node === range.startContainer ? range.startOffset : 0);
          end = offset + (node === range.endContainer ? range.endOffset : node.length);
        }
        offset += node.length;
      }
      const quote = block.textContent.slice(start, end);
      if (end > start && quote.trim()) parts.push({index, start, end, quote});
    });
    if (!parts.length) return clear();
    active = {key, item:{id:crypto.randomUUID(), parts, quote:parts.map(part => part.quote).join('\n')}};
    toolbar.hidden = false;
  }

  function init(settings) {
    options = settings;
    try { records = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch {}
    toolbar = document.createElement('div');
    toolbar.className = 'qt-tools';
    toolbar.hidden = true;
    toolbar.setAttribute('aria-label', '閱讀標記');
    toolbar.innerHTML = Object.entries(colors).map(([label, color]) =>
      `<button type="button" data-color="${color}" style="--mark:#${color}" aria-label="${label}色反白">${label}</button>`).join('')
      + '<button type="button" data-action="note">備註</button><button type="button" data-action="copy">複製</button>';
    document.body.appendChild(toolbar);
    document.body.insertAdjacentHTML('beforeend', `
      <div id="qt-reader-status" class="qt-tools" role="status" hidden></div>
      <dialog id="qt-note" aria-labelledby="qt-note-title"><form method="dialog">
        <h2 id="qt-note-title">備註</h2><p class="qt-note-text"></p>
        <textarea aria-label="備註內容" maxlength="2000"></textarea>
        <p class="qt-note-help">反白和備註只儲存在此瀏覽器。想長期保留，請點頁首的「匯出 Word」。</p>
        <div class="actions"><button class="action" value="save">儲存</button><button class="action" value="cancel">取消</button></div>
      </form></dialog>`);
    dialog = $('qt-note');
    const note = dialog.querySelector('textarea');
    toolbar.addEventListener('pointerdown', event => event.preventDefault());
    toolbar.addEventListener('click', async event => {
      const button = event.target.closest('button');
      if (!button || !active) return;
      if (button.dataset.color) save({color:button.dataset.color});
      if (button.dataset.action === 'note') {
        dialog.returnValue = '';
        dialog.querySelector('.qt-note-text').textContent = active.item.quote;
        note.value = active.item.note || '';
        toolbar.hidden = true;
        dialog.showModal();
        note.focus();
      }
      if (button.dataset.action === 'copy') {
        const quote = active.item.quote;
        clear();
        selection()?.removeAllRanges();
        status(await options.copy(quote) ? '已複製' : '無法複製，請用系統選單重試。');
      }
    });
    dialog.addEventListener('close', () => {
      if (dialog.returnValue === 'save' && active) save({note:note.value.trim()});
      else clear();
    });
    document.addEventListener('selectionchange', readSelection);
    document.addEventListener('pointerdown', event => {
      if (!event.target.closest('.qt-tools, .qt-mark, dialog')) clear();
      if (!event.target.closest('#date-picker')) $('date-picker').open = false;
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        clear();
        $('date-picker').open = false;
      }
    });

    const main = document.querySelector('main');
    main.addEventListener('touchstart', event => {
      touch = null;
      if (event.touches.length !== 1 || active || dialog.open || $('date-picker').open ||
          event.target.closest('a,button,summary,input,textarea,select,mark') || !selection()?.isCollapsed) return;
      const {clientX:x, clientY:y} = event.touches[0];
      if (x >= innerWidth * .1 && x <= innerWidth * .9) touch = {x,y,start:performance.now()};
    }, {passive:true});
    main.addEventListener('touchmove', event => {
      if (!touch) return;
      const point = event.touches[0];
      if (event.touches.length !== 1 ||
          Math.abs(point.clientY - touch.y) > Math.max(24, Math.abs(point.clientX - touch.x))) touch = null;
    }, {passive:true});
    main.addEventListener('touchcancel', () => { touch = null; });
    main.addEventListener('touchend', event => {
      const start = touch;
      touch = null;
      if (!start || active || !selection()?.isCollapsed || performance.now() - start.start > 500) return;
      const end = event.changedTouches[0];
      const dx = end.clientX - start.x, dy = end.clientY - start.y;
      if (Math.abs(dx) >= Math.max(55, Math.abs(dy) * 1.7)) options.turn(dx < 0 ? 1 : -1);
    }, {passive:true});

    $('export-word').addEventListener('click', async () => {
      const entry = options.getCurrent();
      if (!entry) return;
      const button = $('export-word');
      button.disabled = true;
      button.textContent = '匯出中…';
      try {
        const views = ['adult', 'kids'].map(mode => {
          refresh(mode);
          return {mode, panel:$(mode).cloneNode(true), notes:records[markContext(mode)] || []};
        });
        const {exportWord} = await import('./export-word.js');
        await exportWord(entry, views);
      } catch {
        status('無法匯出 Word，請稍後再試。');
      } finally {
        button.disabled = false;
        button.textContent = '匯出 Word';
      }
    });
  }

  function flip(forward) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const page = $(options.getMode());
    page.getAnimations().forEach(animation => animation.cancel());
    page.animate([
      {transform:`perspective(1100px) rotateY(${forward ? -13 : 13}deg)`,opacity:.45},
      {transform:'perspective(1100px) rotateY(0deg)',opacity:1},
    ], {duration:310,easing:'ease-out'});
  }

  return {init, refresh, clear, flip};
})();
