/* Adapted from LinFamily's js/lf-menu.js for the offline Pinky Jump game. */
(function () {
  'use strict';
  const canonicalUrl = document.querySelector('link[rel="canonical"]').href;
  const OBJECT = 'a, button, input, textarea, select, label, img, svg, video, audio, iframe, dialog, summary, [contenteditable], [role="button"], [role="menu"]';
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
    const t = document.createElement('div'); t.className = 'lf-toast'; t.setAttribute('role', 'status'); PinkyLocale.set(t, msg);
    document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
  }

  const style = document.createElement('style');
  style.textContent = `
    .lf-ctx { position:fixed; z-index:2147483600; width:280px; max-width:calc(100vw - 16px); padding:4px; border-radius:8px; background:#2c2c2c; color:#fff; border:1px solid rgba(255,255,255,.1); box-shadow:0 8px 24px rgba(0,0,0,.5); font:14px/20px "Segoe UI",Arial,sans-serif; }
    .lf-toast { position:fixed; left:50%; bottom:20px; z-index:2147483600; transform:translateX(-50%); padding:8px 14px; border-radius:8px; background:#2c2c2c; color:#fff; font:14px/20px "Segoe UI",Arial,sans-serif; pointer-events:none; }
    .lf-ctx button { display:block; width:100%; padding:6px 12px; border:0; border-radius:4px; background:transparent; color:inherit; font:inherit; text-align:left; cursor:default; }
    .lf-ctx button:hover, .lf-ctx button:focus-visible { background:rgba(255,255,255,.08); outline:none; }
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
  let menu = null;
  function close() {
    if (!menu) return;
    const restoreFocus = menu.contains(document.activeElement);
    menu.remove();
    menu = null;
    if (restoreFocus) document.getElementById('game-wrapper').focus({preventScroll:true});
  }
  function show(x, y) {
    if (duringPlay()) return;
    close();
    const url = canonicalUrl;
    menu = document.createElement('div');
    menu.className = 'lf-ctx'; menu.setAttribute('role', 'menu');
    menu.innerHTML = '<button type="button" role="menuitem" data-m="copy" class="lf-ctx-copy"><span data-label></span><span class="lf-ctx-url"></span></button><button type="button" role="menuitem" data-m="open"></button>';
    PinkyLocale.set(menu.querySelector('[data-label]'), '複製網址');
    PinkyLocale.set(menu.querySelector('[data-m="open"]'), '在新視窗開啟');
    menu.addEventListener('click', async e => {
      const b = e.target.closest('button[data-m]'); if (!b) return;
      close();
      if (duringPlay()) return;
      if (b.dataset.m === 'copy') toast(await copy(url) ? '已複製網址' : '無法複製網址');
      else openNewTab(url);
    });
    document.body.appendChild(menu);
    urlMarquee(menu, url);
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
    menu.querySelector('button').focus({ preventScroll: true });
  }
  function duringPlay() {
    return gameState === 'PLAYING' || window.pinkyArcade?.isPairedPlaying();
  }
  function canOpen(target) {
    if (!(target instanceof Element) || document.querySelector('dialog[open]') || String(getSelection() || '').trim()) return false;
    const control = target.closest(OBJECT);
    return Boolean(target.closest('#game-wrapper')) && !control;
  }

  document.addEventListener('contextmenu', e => {
    if (duringPlay() || menu?.contains(e.target)) {
      e.preventDefault();
      return;
    }
    if (!canOpen(e.target)) return;
    e.preventDefault();
    if (e.pointerType !== 'touch' || !menu) show(e.clientX, e.clientY);
  });

  // Share one gesture between the idle long press and pull-to-refresh.
  let gesture = null;
  function cancelGesture() {
    clearTimeout(gesture?.timer);
    gesture = null;
  }
  document.addEventListener('touchstart', e => {
    cancelGesture();
    if (duringPlay() || e.touches.length !== 1 || !canOpen(e.target) ||
        e.target.closest('#record-panel')) return;
    const panel = e.target.closest('.panel');
    if (panel && panel.scrollHeight > panel.clientHeight) return;
    const {identifier, clientX, clientY} = e.touches[0];
    gesture = {
      identifier, x: clientX, y: clientY, opened: false,
      timer: setTimeout(() => {
        if (duringPlay() || !canOpen(e.target)) return;
        gesture.opened = true;
        show(clientX, clientY);
      }, 550)
    };
  }, {passive:true});
  document.addEventListener('touchmove', e => {
    if (!gesture) return;
    if (duringPlay() || e.touches.length !== 1) {
      cancelGesture();
      return;
    }
    const touch = e.touches[0];
    const dx = touch.clientX - gesture.x;
    const dy = touch.clientY - gesture.y;
    if (Math.hypot(dx, dy) > 10) clearTimeout(gesture.timer);
    if (!gesture.opened && dy > 10 && dy > Math.abs(dx) * 1.5 && e.cancelable) e.preventDefault();
  }, {passive:false});
  document.addEventListener('touchend', e => {
    if (!gesture) return;
    const {identifier, x, y, opened} = gesture;
    cancelGesture();
    if (duringPlay()) return;
    if (opened) {
      if (e.cancelable) e.preventDefault();
      return;
    }
    if (!canOpen(e.target)) return;
    const touch = Array.from(e.changedTouches).find(item => item.identifier === identifier);
    if (!touch) return;
    const dx = touch.clientX - x;
    const dy = touch.clientY - y;
    if (dy >= 85 && dy > Math.abs(dx) * 1.5) {
      if (e.cancelable) e.preventDefault();
      location.reload();
    }
  }, {passive:false});
  document.addEventListener('touchcancel', cancelGesture);
  document.addEventListener('pinky-play-start', () => {
    cancelGesture();
    close();
    document.querySelector('.lf-toast')?.remove();
  });
  // 點旁邊、捲動、Esc、切換視窗 → 關閉
  document.addEventListener('pointerdown', e => { if (menu && !menu.contains(e.target)) close(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  addEventListener('scroll', close, true);
  addEventListener('blur', () => { cancelGesture(); close(); });
  addEventListener('resize', close);
})();
