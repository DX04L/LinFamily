const SGReader = (() => {
  const colors = { 黃: 'F9DB82', 珊瑚: 'F7AE9C', 綠: 'BDE4A2', 藍: 'ADE4EE' };
  const storageKey = 'sg-annotations-v1';
  const $ = id => document.getElementById(id);
  const selection = () => window.getSelection();
  let options, toolbar, dialog, active, touch, overlay, handles, customRange, paper;
  let guest = {}, records = {}, account, authFailed = false, watchedKey, unsubscribe, subscription = 0;

  function blocks(tabId) {
    const container = $(tabId);
    if (!container) return [];
    const elements = [...container.querySelectorAll('.article-body p, .block-title, .block-desc, .q-title, .guide-content, .official-conclusion p')];
    elements.forEach(el => el.setAttribute('data-sg-selectable', ''));
    return elements;
  }

  function nodes(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const result = [];
    while (walker.nextNode()) result.push(walker.currentNode);
    return result;
  }

  function markContext(tabId = options.getTab()) {
    const entry = options.getCurrent();
    return entry && JSON.stringify([entry.date, entry.title, tabId]);
  }

  function setAccount(next, failed = false) {
    unsubscribe?.();
    unsubscribe = null;
    subscription++;
    watchedKey = null;
    account = next;
    authFailed = failed;
    records = next === null ? guest : {};
    clear();
    selection()?.removeAllRanges();
    if (dialog?.open) dialog.close();
    const helpEl = $('sg-note-storage');
    if (helpEl) {
      helpEl.textContent = failed
        ? '目前無法確認登入狀態，請重新整理後再儲存。'
        : next
          ? '反白和備註會自動同步到你的 LinFamily 帳戶。'
          : '目前為訪客模式，反白和備註儲存在此瀏覽器中。';
    }
    refresh();
  }

  function watchAnnotations(key) {
    if (!account || key === watchedKey) return;
    watchedKey = key;
    unsubscribe?.();
    unsubscribe = null;
    const revision = ++subscription;
    const onError = () => {
      if (revision !== subscription) return;
      watchedKey = null;
      status('目前無法同步反白和備註。');
    };
    account.subscribe(key, snapshot => {
      if (revision !== subscription) return;
      records[key] = snapshot.docs.flatMap(doc => {
        try {
          const item = JSON.parse(doc.data().payload);
          return Array.isArray(item.parts) && typeof item.quote === 'string' ? [{ ...item, id: doc.id }] : [];
        } catch {
          return [];
        }
      });
      if (!active && !dialog.open) refresh();
    }, onError).then(stop => {
      if (revision === subscription) unsubscribe = stop;
      else stop();
    }).catch(onError);
  }

  function clear() {
    active = null;
    customRange = null;
    if (overlay) overlay.replaceChildren();
    handles?.forEach(handle => { handle.hidden = true; });
    if (toolbar) toolbar.hidden = true;
  }

  function refresh(tabId = options.getTab()) {
    const key = markContext(tabId);
    if (!key) return;
    if (tabId === options.getTab()) watchAnnotations(key);
    ['tab-info', 'tab-bg', 'tab-discuss'].forEach(t => blocks(t));
    blocks(tabId).forEach((block, index) => {
      [...block.querySelectorAll('mark.sg-mark')].forEach(mark => mark.replaceWith(...mark.childNodes));
      block.normalize();
      const text = block.textContent;
      const entries = (records[key] || []).flatMap(item => item.parts
        .filter(part => part.index === index && text.slice(part.start, part.end) === part.quote)
        .map(part => ({ ...part, item })));
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
              mark.className = 'sg-mark';
              mark.dataset.color = hit.item.color || colors.黃;
              mark.style.setProperty('--mark', '#' + mark.dataset.color);
              if (hit.item.note) mark.setAttribute('data-note', '');
              mark.textContent = segment;
              mark.addEventListener('click', (e) => {
                e.stopPropagation();
                if (customRange || selection()?.isCollapsed === false) return;
                active = { key, item: hit.item, existing: true };
                showTools(mark.getBoundingClientRect());
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

  async function save(patch) {
    if (!active) return;
    if (account === undefined) {
      status(authFailed ? '無法確認登入狀態，請重新整理。' : '正在確認登入狀態，請稍後再試。');
      return;
    }
    const { key, item } = active;
    const updated = { ...item, ...patch };
    const previous = records[key];
    records[key] = [...(previous || []).filter(saved => saved.id !== item.id), updated];
    if (account) {
      const savingAccount = account;
      clear();
      selection()?.removeAllRanges();
      refresh();
      try {
        await savingAccount.save(key, updated);
      } catch {
        if (account !== savingAccount) return;
        records[key] = previous || [];
        refresh();
        status('同步失敗，請重新選取文字再試。');
      }
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(guest));
    } catch {
      records[key] = previous || [];
      status('無法儲存標記，請檢查瀏覽器儲存空間。');
      return;
    }
    clear();
    selection()?.removeAllRanges();
    refresh();
  }

  async function removeMark() {
    if (!active) return;
    const { key, item } = active;
    const previous = records[key];
    records[key] = (previous || []).filter(saved => saved.id !== item.id);
    if (account) {
      const savingAccount = account;
      clear();
      refresh();
      try {
        await savingAccount.remove(item.id);
      } catch {
        if (account !== savingAccount) return;
        records[key] = previous || [];
        refresh();
        status('刪除失敗，請稍後再試。');
      }
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(guest));
    } catch {}
    clear();
    refresh();
  }

  let messageTimer;
  function status(message) {
    const box = $('sg-reader-status');
    box.textContent = message;
    box.hidden = false;
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => { box.hidden = true; }, 2500);
  }

  function readSelection() {
    if (dialog.open || customRange) return;
    const value = selection();
    if (!value?.rangeCount || value.isCollapsed) {
      if (!active?.key || !(records[active.key] || []).some(item => item.id === active.item.id)) clear();
      return;
    }
    showRange(value.getRangeAt(0));
  }

  function showTools(rect) {
    const delBtn = toolbar.querySelector('[data-action="delete"]');
    if (delBtn) delBtn.hidden = !active?.existing;
    toolbar.hidden = false;
    const view = window.visualViewport;
    const left = view?.offsetLeft || 0, top = view?.offsetTop || 0;
    const right = left + (view?.width || innerWidth), bottom = top + (view?.height || innerHeight);
    const x = (rect.left + rect.right - toolbar.offsetWidth) / 2;
    const above = rect.top - toolbar.offsetHeight - 12;
    const y = above >= top + 8 ? above : rect.bottom + 30;
    toolbar.style.left = Math.max(left + 8, Math.min(x, right - toolbar.offsetWidth - 8)) + 'px';
    toolbar.style.top = Math.max(top + 8, Math.min(y, bottom - toolbar.offsetHeight - 8)) + 'px';
  }

  function showRange(range) {
    const key = markContext();
    if (!key) return clear();
    const panel = $(options.getTab());
    if (!panel || !panel.contains(range.startContainer) || !panel.contains(range.endContainer)) return clear();
    const parts = [];
    blocks(options.getTab()).forEach((block, index) => {
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
      if (end > start && quote.trim()) parts.push({ index, start, end, quote });
    });
    if (!parts.length) return clear();
    active = { key, item: { id: crypto.randomUUID(), parts, quote: parts.map(part => part.quote).join('\n') }, existing: false };
    showTools(range.getBoundingClientRect());
  }

  function caretAt(x, y) {
    const hit = document.caretPositionFromPoint?.(x, y);
    const legacy = !hit && document.caretRangeFromPoint?.(x, y);
    const node = hit?.offsetNode || legacy?.startContainer;
    const offset = hit?.offset ?? legacy?.startOffset;
    return node?.nodeType === Node.TEXT_NODE &&
      $(options.getTab())?.contains(node) && node.parentElement.closest('[data-sg-selectable]')
      ? { node, offset } : null;
  }

  function paintSelection() {
    if (!customRange) return;
    const rects = [...customRange.getClientRects()].filter(rect => rect.width > 0);
    const first = rects[0], last = rects.at(-1);
    if (!first) return;
    overlay.replaceChildren(...rects.map(rect => {
      const box = document.createElement('span');
      Object.assign(box.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
      return box;
    }));
    handles.forEach((handle, index) => {
      const rect = index ? last : first;
      handle.style.left = (index ? rect.right : rect.left) + 'px';
      handle.style.top = rect.bottom + 'px';
      handle.hidden = false;
    });
    showTools(customRange.getBoundingClientRect());
  }

  function enableTouchSelection() {
    overlay = document.createElement('div');
    overlay.className = 'sg-selection';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.append(overlay);
    handles = ['start', 'end'].map(edge => {
      const handle = document.createElement('span');
      handle.className = 'sg-selection-handle ' + edge;
      handle.hidden = true;
      handle.setAttribute('aria-hidden', 'true');
      document.body.append(handle);
      let yOffset = 0;
      handle.addEventListener('pointerdown', event => {
        event.preventDefault();
        const rect = handle.getBoundingClientRect();
        yOffset = event.clientY - rect.top + 6;
        handle.setPointerCapture(event.pointerId);
      });
      handle.addEventListener('pointermove', event => {
        if (!customRange || !handle.hasPointerCapture(event.pointerId)) return;
        const point = caretAt(event.clientX, event.clientY - yOffset);
        if (!point || customRange.comparePoint(point.node, point.offset) === (edge === 'start' ? 1 : -1)) return;
        const next = customRange.cloneRange();
        if (edge === 'start') next.setStart(point.node, point.offset);
        else next.setEnd(point.node, point.offset);
        if (next.collapsed) return;
        customRange = next;
        showRange(next);
        paintSelection();
      });
      return handle;
    });

    let press;
    const cancel = () => { clearTimeout(press?.timer); press = null; };
    const main = document.querySelector('main');
    main.addEventListener('touchstart', event => {
      cancel();
      if (event.touches.length !== 1 || dialog.open || !event.target.closest('[data-sg-selectable]') ||
          event.target.closest('.blank-slot, .pop-trigger, button')) return;
      const { clientX: x, clientY: y } = event.touches[0];
      press = {
        x, y, timer: setTimeout(() => {
          const point = caretAt(x, y);
          if (!point || !point.node.length) return;
          const text = point.node.data;
          const position = Math.min(point.offset, text.length - 1);
          const segments = Intl.Segmenter ? new Intl.Segmenter(document.documentElement.lang, { granularity: 'word' }).segment(text) : null;
          const hit = segments?.containing(position);
          const start = hit?.index ?? position;
          const end = start + (hit?.segment.length ?? 1);
          const range = document.createRange();
          range.setStart(point.node, start);
          range.setEnd(point.node, end);
          selection()?.removeAllRanges();
          customRange = range;
          showRange(range);
          if (customRange) paintSelection();
        }, 420)
      };
    }, { passive: true });
    main.addEventListener('touchmove', event => {
      const point = event.touches[0];
      if (press && (event.touches.length !== 1 || Math.hypot(point.clientX - press.x, point.clientY - press.y) > 10)) cancel();
    }, { passive: true });
    main.addEventListener('touchend', event => {
      cancel();
      if (customRange && event.cancelable) event.preventDefault();
    }, { passive: false });
    main.addEventListener('touchcancel', cancel);
    main.addEventListener('contextmenu', event => {
      if (event.target.closest('[data-sg-selectable]') && (matchMedia('(any-pointer: coarse)').matches || active)) event.preventDefault();
    });
    const reposition = () => {
      if (dialog.open || toolbar.hidden) return;
      if (customRange) paintSelection();
      else if (selection()?.rangeCount && !selection().isCollapsed) showTools(selection().getRangeAt(0).getBoundingClientRect());
      else clear();
    };
    window.addEventListener('scroll', reposition, { passive: true });
    window.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('resize', reposition);
  }

  function init(settings) {
    options = settings;
    try {
      guest = JSON.parse(localStorage.getItem(storageKey)) || {};
    } catch {}
    toolbar = document.createElement('div');
    toolbar.className = 'sg-tools';
    toolbar.hidden = true;
    toolbar.setAttribute('aria-label', '閱讀標記');
    toolbar.innerHTML = '<div class="sg-swatches">' + Object.entries(colors).map(([label, color]) =>
      `<button type="button" data-color="${color}" style="--mark:#${color}" aria-label="${label}色反白"></button>`).join('')
      + '</div><button type="button" data-action="note">新增／編輯註記</button>'
      + '<button type="button" data-action="copy">複製文字</button>'
      + '<button type="button" data-action="delete" hidden>刪除標記</button>';
    document.body.appendChild(toolbar);
    document.body.insertAdjacentHTML('beforeend', `
      <div id="sg-reader-status" class="sg-tools" role="status" hidden></div>
      <dialog id="sg-note" aria-labelledby="sg-note-title"><form method="dialog">
        <h2 id="sg-note-title">經文與信息註記</h2>
        <p class="sg-note-text"></p>
        <textarea aria-label="註記內容" placeholder="寫下你的領受、亮光或小組分享筆記..." maxlength="2000"></textarea>
        <p id="sg-note-storage" class="sg-note-help">正在確認登入狀態…</p>
        <div class="sg-note-actions">
          <button type="button" value="delete" id="sg-note-del">刪除標記</button>
          <button type="submit" value="cancel">取消</button>
          <button type="submit" value="save">儲存</button>
        </div>
      </form></dialog>`);
    dialog = $('sg-note');
    enableTouchSelection();
    const note = dialog.querySelector('textarea');
    $('sg-note-del').addEventListener('click', () => {
      dialog.close('delete');
    });
    toolbar.addEventListener('pointerdown', event => event.preventDefault());
    toolbar.addEventListener('click', async event => {
      const button = event.target.closest('button');
      if (!button || !active) return;
      if (button.dataset.color) save({ color: button.dataset.color });
      if (button.dataset.action === 'note') {
        dialog.returnValue = '';
        dialog.querySelector('.sg-note-text').textContent = active.item.quote;
        note.value = active.item.note || '';
        $('sg-note-del').hidden = !active.existing;
        toolbar.hidden = true;
        dialog.showModal();
        note.focus();
      }
      if (button.dataset.action === 'copy') {
        const quote = active.item.quote;
        clear();
        selection()?.removeAllRanges();
        status(await options.copy(quote) ? '已複製文字' : '無法複製，請用系統選單重試。');
      }
      if (button.dataset.action === 'delete') {
        removeMark();
      }
    });
    dialog.addEventListener('close', () => {
      if (dialog.returnValue === 'save' && active) save({ note: note.value.trim() });
      else if (dialog.returnValue === 'delete' && active) removeMark();
      else clear();
    });
    document.addEventListener('selectionchange', readSelection);
    document.addEventListener('pointerdown', event => {
      if (!event.target.closest('.sg-tools, .sg-mark, .sg-selection-handle, dialog')) clear();
      const picker = $('sg-date-picker');
      if (picker && !event.target.closest('#sg-date-picker')) picker.open = false;
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        clear();
        const picker = $('sg-date-picker');
        if (picker) picker.open = false;
      }
    });

    const sheet = $('sg-reading-sheet');
    sheet.addEventListener('touchstart', event => {
      cancelDrag();
      const picker = $('sg-date-picker');
      if (event.touches.length !== 1 || active || paper || dialog.open || picker?.open ||
          event.target.closest('a,button,summary,input,textarea,select,mark,.blank-slot,.pop-trigger') ||
          !selection()?.isCollapsed) return;
      const { clientX: x, clientY: y } = event.touches[0];
      if (x >= innerWidth * 0.08 && x <= innerWidth * 0.92) touch = { x, y, started: performance.now() };
    }, { passive: true });
    sheet.addEventListener('touchmove', event => {
      if (!touch) return;
      const point = event.touches[0];
      const dx = point.clientX - touch.x, dy = point.clientY - touch.y;
      if (event.touches.length !== 1 || active || customRange ||
          (!touch.direction && Math.abs(dy) > Math.max(12, Math.abs(dx)))) {
        cancelDrag();
        return;
      }
      if (!touch.direction && Math.abs(dx) > Math.max(14, Math.abs(dy) * 1.5)) {
        if (performance.now() - touch.started > 380) return cancelDrag();
        touch.direction = dx < 0 ? 1 : -1;
        const next = options.adjacent(touch.direction);
        if (!next) return cancelDrag();
        if (!reducedMotion()) beginPaper(next, touch.direction === 1);
      }
      if (paper && touch.direction) drawPaper(Math.max(0, -dx * touch.direction) / paper.width);
    }, { passive: true });
    sheet.addEventListener('touchcancel', cancelDrag);
    sheet.addEventListener('touchend', event => {
      const start = touch;
      touch = null;
      if (!start?.direction) return;
      const end = event.changedTouches[0];
      const travel = (start.x - end.clientX) * start.direction;
      const threshold = Math.min(100, innerWidth * 0.22);
      const velocity = travel / Math.max(1, performance.now() - start.started);
      const commit = !active && !customRange && (travel >= threshold || (travel >= 52 && velocity > 0.45));
      if (commit) options.turn(start.direction);
      else if (paper) animatePaper(0);
    }, { passive: true });
  }

  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function beginPaper(next, forward) {
    const source = $('sg-reading-sheet');
    const bounds = source.getBoundingClientRect();
    const top = document.querySelector('nav.navbar').getBoundingClientRect().bottom;
    const stage = document.createElement('div');
    stage.className = 'sg-paper-turn';
    stage.style.top = Math.max(0, top) + 'px';
    stage.inert = true;
    stage.setAttribute('aria-hidden', 'true');

    const incoming = options.preview(next);
    incoming.removeAttribute('id');
    incoming.className = 'sg-paper-incoming';
    const outgoing = document.createElement('div');
    outgoing.className = 'sg-paper-outgoing';
    const surface = source.cloneNode(true);
    surface.removeAttribute('id');
    surface.style.transform = `translateY(${Math.min(0, bounds.top - top)}px)`;
    outgoing.append(surface);
    stage.append(incoming, outgoing);
    document.body.append(stage);
    paper = { stage, incoming, outgoing, forward, width: stage.clientWidth, progress: 0 };
    drawPaper(0);
  }

  function drawPaper(value) {
    if (!paper) return;
    const { incoming, outgoing, forward, width } = paper;
    const progress = Math.max(0, Math.min(value, 1));
    paper.progress = progress;
    const direction = forward ? -1 : 1;
    outgoing.style.transform = `translate3d(${direction * width * progress}px,0,0)`;
    incoming.style.transform = `translate3d(${-direction * width * (1 - progress)}px,0,0)`;
  }

  function animatePaper(target, done) {
    const animation = paper;
    if (!animation || animation.settling) return;
    animation.settling = true;
    const from = animation.progress;
    const duration = target ? Math.max(150, 330 * (1 - from)) : 180;
    const start = performance.now();
    function frame(now) {
      if (paper !== animation) return;
      const fraction = Math.min(1, (now - start) / duration);
      drawPaper(from + (target - from) * (1 - (1 - fraction) ** 2));
      if (fraction < 1) requestAnimationFrame(frame);
      else {
        paper = null;
        done?.();
        animation.stage.remove();
      }
    }
    requestAnimationFrame(frame);
  }

  function cancelDrag() {
    touch = null;
    if (paper && !paper.settling) animatePaper(0);
  }

  function turn(data, forward, commit) {
    if (reducedMotion()) return commit();
    if (paper?.settling) return;
    if (!paper) beginPaper(data, forward);
    animatePaper(1, commit);
  }

  return { init, refresh, clear, turn, setAccount };
})();
