/**
 * LinFamily 空白處選單：電腦按右鍵、手機長按「沒有物件的地方」→「Copy link（後面顯示網址，太長時跑馬灯）」「Open in new window」。
 * 外觀與文字照 DX 的 header.js 選單。
 * - 按在 App、按鈕、輸入框、圖片、平面圖等物件上不攔截（照原本行為）；有選取文字時也不攔截（方便複製文字）。
 * - 「Open in new window」盡量用預設瀏覽器：
 *     Android（已安裝成 App 或在 LINE／FB 等內建瀏覽器）→ intent:// 連結交給系統預設瀏覽器；
 *     LINE 內建瀏覽器 → 網址加 openExternalBrowser=1；其他 → 開新視窗（同 DX；電腦版安裝成 App 時會開在預設瀏覽器）。
 * 其他頁面也可直接呼叫 window.lfOpenNewTab(url)。
 */
(function () {
  'use strict';
  const OBJECT = 'a, button, input, textarea, select, label, img, svg, video, audio, iframe, canvas, dialog, summary, [contenteditable], [role="button"], [data-slot], [role="menu"], #lfHomeBtn, .slot-cell, .slot-empty, .lf-menu, .lf-ctx';
  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isLine = /\bLine\//i.test(ua);
  const inApp = isLine || /FBAN|FBAV|Instagram|MicroMessenger|; wv\)/i.test(ua);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;

  function openNewTab(url) {
    const u = new URL(url, location.href);
    if (isLine) { u.searchParams.set('openExternalBrowser', '1'); location.href = u.href; return; }
    if (isAndroid && (standalone() || inApp) && /^https?:$/.test(u.protocol)) {
      // 不指定 package → 交給系統預設瀏覽器；失敗時退回原網址
      location.href = 'intent://' + u.host + u.pathname + u.search + u.hash.replace(/#/g, '%23') +
        '#Intent;scheme=' + u.protocol.slice(0, -1) + ';action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;' +
        'S.browser_fallback_url=' + encodeURIComponent(u.href) + ';end';
      return;
    }
    // 同 DX：開一個新視窗（被擋就退回新分頁）
    const w = Math.min(1280, (screen.availWidth || 1280) - 40), h = Math.min(900, (screen.availHeight || 900) - 60);
    const left = Math.max(0, ((screen.availWidth || w) - w) / 2), top = Math.max(0, ((screen.availHeight || h) - h) / 2);
    const win = window.open(u.href, '_blank', `popup,width=${w},height=${h},left=${left},top=${top}`);
    if (win) { try { win.opener = null; } catch (_) {} } else window.open(u.href, '_blank', 'noopener');
  }
  window.lfOpenNewTab = openNewTab;

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (_) {}
    const t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:-100px;opacity:0';
    document.body.appendChild(t); t.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
    t.remove(); return ok;
  }
  function toast(msg) {
    document.querySelectorAll('.lf-toast').forEach(t => t.remove());
    const t = document.createElement('div'); t.className = 'lf-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
  }

  const style = document.createElement('style');
  style.textContent = `
    [data-lf-menu-trigger] { -webkit-touch-callout:none; }
    .lf-ctx { position:fixed; z-index:2147483600; width:280px; max-width:calc(100vw - 16px); padding:4px; border-radius:8px; background:#fff; color:#1a1a1a; border:1px solid rgba(0,0,0,.12); box-shadow:0 8px 24px rgba(0,0,0,.18); font:14px/20px "Segoe UI",Arial,sans-serif; }
    html.dark .lf-ctx { background:#2c2c2c; color:#fff; border-color:rgba(255,255,255,.1); box-shadow:0 8px 24px rgba(0,0,0,.5); }
    .lf-ctx button { display:block; width:100%; padding:6px 12px; border:0; border-radius:4px; background:transparent; color:inherit; font:inherit; text-align:left; cursor:default; }
    .lf-ctx button:hover, .lf-ctx button:focus-visible { background:rgba(0,0,0,.06); outline:none; }
    html.dark .lf-ctx button:hover, html.dark .lf-ctx button:focus-visible { background:rgba(255,255,255,.08); }
    .lf-ctx .lf-ctx-copy { display:flex; align-items:center; gap:12px; }
    .lf-ctx .lf-ctx-copy > span:first-child { flex:none; }
    .lf-ctx .lf-ctx-url { flex:1; min-width:0; overflow:hidden; white-space:nowrap; font-size:12px; opacity:.55; }
    .lf-ctx .lf-ctx-url.is-run { -webkit-mask-image:linear-gradient(90deg,transparent,#000 10px,#000 calc(100% - 10px),transparent); mask-image:linear-gradient(90deg,transparent,#000 10px,#000 calc(100% - 10px),transparent); }
    .lf-ctx .lf-ctx-url > span { display:inline-block; }
    .lf-ctx .lf-ctx-url.is-run > span { animation:lfCtxMarq linear infinite; }
    .lf-ctx .lf-ctx-url.is-run > span > span { padding-right:3em; }
    @keyframes lfCtxMarq { from { transform:translateX(0); } to { transform:translateX(-50%); } }
    @media (prefers-reduced-motion: reduce) { .lf-ctx .lf-ctx-url.is-run > span { animation:none; } }`;
  document.head.appendChild(style);

  // 「Copy link」後面顯示這一頁的網址；太長時像跑馬灯一樣流過去（選單大小固定）。
  function urlMarquee(box, url) {
    const v = box.querySelector('.lf-ctx-url'); if (!v) return;
    const text = url.replace(/^https?:\/\//, ''), inner = document.createElement('span'), a = document.createElement('span');
    a.textContent = text; inner.append(a); v.replaceChildren(inner);
    if (inner.scrollWidth <= v.clientWidth) return;
    const b = document.createElement('span'); b.textContent = text; b.setAttribute('aria-hidden', 'true');
    inner.append(b); v.classList.add('is-run');
    inner.style.animationDuration = Math.max(6, text.length * 0.22) + 's';
  }
  let menu = null, openedAt = 0;
  function close() { if (menu) { menu.remove(); menu = null; } }
  function show(x, y) {
    close();
    const url = location.href;
    menu = document.createElement('div');
    menu.className = 'lf-ctx'; menu.setAttribute('role', 'menu');
    menu.innerHTML = '<button type="button" role="menuitem" data-m="copy" class="lf-ctx-copy"><span>Copy link</span><span class="lf-ctx-url"></span></button><button type="button" role="menuitem" data-m="open">Open in new window</button>';
    menu.addEventListener('click', async e => {
      const b = e.target.closest('button[data-m]'); if (!b) return;
      close();
      if (b.dataset.m === 'copy') toast(await copy(url) ? 'Link copied' : 'Couldn\'t copy link');
      else openNewTab(url);
    });
    document.body.appendChild(menu);
    urlMarquee(menu, url);
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
    openedAt = Date.now();
    menu.querySelector('button').focus({ preventScroll: true });
  }
  const canOpen = target => target instanceof Element
    && (!target.closest(OBJECT) || target.closest(OBJECT).hasAttribute('data-lf-menu-trigger'))
    && !document.querySelector('dialog[open]')
    && !String(getSelection() || '').trim();

  // 電腦右鍵（Android 長按也會觸發 contextmenu）
  document.addEventListener('contextmenu', e => {
    if (menu && menu.contains(e.target)) { e.preventDefault(); return; }
    if (!canOpen(e.target)) return;
    e.preventDefault();
    if (Date.now() - openedAt < 800) return; // 長按計時器已經開過
    show(e.clientX, e.clientY);
  });
  // 手機長按（iPhone 不會觸發 contextmenu，用計時器）
  let lp = null;
  document.addEventListener('touchstart', e => {
    clearTimeout(lp && lp.timer); lp = null;
    if (e.touches.length !== 1 || !canOpen(e.target)) return;
    const t = e.touches[0];
    lp = { x: t.clientX, y: t.clientY, timer: setTimeout(() => { if (lp) { show(lp.x, lp.y); try { getSelection().removeAllRanges(); } catch (_) {} } }, 550) };
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!lp) return; const t = e.touches[0];
    if (e.touches.length !== 1) { clearTimeout(lp.timer); lp = null; return; }
    if (Math.hypot(t.clientX - lp.x, t.clientY - lp.y) > 10) { clearTimeout(lp.timer); lp = null; }
  }, { passive: true });
  document.addEventListener('touchend', e => { if (lp) { clearTimeout(lp.timer); lp = null; if (Date.now() - openedAt < 600) e.preventDefault(); } });
  document.addEventListener('touchcancel', () => { if (lp) { clearTimeout(lp.timer); lp = null; } });
  // 點旁邊、捲動、Esc、切換視窗 → 關閉
  document.addEventListener('pointerdown', e => { if (menu && !menu.contains(e.target) && Date.now() - openedAt > 300) close(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  addEventListener('scroll', () => { if (Date.now() - openedAt > 300) close(); }, true);
  addEventListener('blur', close);
  addEventListener('resize', close);
})();
