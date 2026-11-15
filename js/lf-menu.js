/**
 * LinFamily 空白處選單：電腦按右鍵、手機長按「沒有物件的地方」→「複製網址」「在新分頁開啟」。
 * - 按在 App、按鈕、輸入框、圖片、平面圖等物件上不攔截（照原本行為）；有選取文字時也不攔截（方便複製文字）。
 * - 「在新分頁開啟」盡量用預設瀏覽器：
 *     Android（已安裝成 App 或在 LINE／FB 等內建瀏覽器）→ intent:// 連結交給系統預設瀏覽器；
 *     LINE 內建瀏覽器 → 網址加 openExternalBrowser=1；其他 → window.open（電腦版安裝成 App 時會開在預設瀏覽器）。
 * 其他頁面也可直接呼叫 window.lfOpenNewTab(url)。
 */
(function () {
  'use strict';
  const OBJECT = 'a, button, input, textarea, select, label, img, svg, video, audio, iframe, canvas, dialog, summary, [contenteditable], [role="button"], [data-slot], [role="menu"], .slot-cell, .slot-empty, .lf-menu, .lf-ctx';
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
    window.open(u.href, '_blank', 'noopener');
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
    .lf-ctx { position:fixed; z-index:200; min-width:180px; padding:6px; border-radius:14px; background:var(--surface,#fff); color:var(--text,#1C1C1C);
      border:1px solid var(--border,rgba(28,28,28,.12)); box-shadow:var(--shadow,0 18px 40px rgba(28,28,28,.16)); font-size:14.5px; }
    .lf-ctx button { display:block; width:100%; text-align:left; border:0; background:none; color:inherit; font:inherit; padding:10px 12px; border-radius:9px; cursor:pointer; }
    .lf-ctx button:hover, .lf-ctx button:focus-visible { background:var(--btn-h,rgba(28,28,28,.08)); outline:none; }`;
  document.head.appendChild(style);

  let menu = null, openedAt = 0;
  function close() { if (menu) { menu.remove(); menu = null; } }
  function show(x, y) {
    close();
    const url = location.href.split('#')[0];
    menu = document.createElement('div');
    menu.className = 'lf-ctx'; menu.setAttribute('role', 'menu');
    menu.innerHTML = '<button type="button" role="menuitem" data-m="copy">複製網址</button><button type="button" role="menuitem" data-m="open">在新分頁開啟</button>';
    menu.addEventListener('click', async e => {
      const b = e.target.closest('button[data-m]'); if (!b) return;
      close();
      if (b.dataset.m === 'copy') toast(await copy(url) ? '已複製網址' : '無法複製，請手動複製網址列');
      else openNewTab(url);
    });
    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
    openedAt = Date.now();
    menu.querySelector('button').focus({ preventScroll: true });
  }
  const isBlank = t => t instanceof Element && !t.closest(OBJECT) && !document.querySelector('dialog[open]') && !String(getSelection() || '').trim();

  // 電腦右鍵（Android 長按也會觸發 contextmenu）
  document.addEventListener('contextmenu', e => {
    if (menu && menu.contains(e.target)) { e.preventDefault(); return; }
    if (!isBlank(e.target)) return;
    e.preventDefault();
    if (Date.now() - openedAt < 800) return; // 長按計時器已經開過
    show(e.clientX, e.clientY);
  });
  // 手機長按（iPhone 不會觸發 contextmenu，用計時器）
  let lp = null;
  document.addEventListener('touchstart', e => {
    clearTimeout(lp && lp.timer); lp = null;
    if (e.touches.length !== 1 || !isBlank(e.target)) return;
    const t = e.touches[0];
    lp = { x: t.clientX, y: t.clientY, timer: setTimeout(() => { if (lp) { show(lp.x, lp.y); try { getSelection().removeAllRanges(); } catch (_) {} } }, 550) };
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!lp) return; const t = e.touches[0];
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
