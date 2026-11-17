/**
 * LinFamily 自己開發的子 App（例如 HannahProjects）用：左下角淡淡的圓形 🏠 浮動鈕回 LinFamily 主畫面。
 * 樣式與行為與 DX04 的 lf-back.js（DX、YA、SR）相同：淡淡半透明、吸邊半藏、按住可拖動、點一下回 LinFamily；位置每頁各自記在這個瀏覽器。
 * 使用方式：在 App 頁面最後加
 *   <script src="../linfamily-home.js" data-home="../"></script>
 */
(function () {
  var me = document.currentScript;
  var home = (me && me.getAttribute('data-home')) || '../';
    // 可拖動、自動吸邊、一半藏在畫面外；點一下回 LinFamily。位置記在這個瀏覽器（每站各自記）。
    var CSS = '#lfHomeBtn{position:fixed;z-index:Z;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;' +
      'background:rgba(28,28,28,.45);color:#fff;opacity:.28;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 2px 8px rgba(0,0,0,.15);' +
      'cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;' +
      'transition:opacity .2s,transform .25s ease,left .25s ease,top .25s ease}' +
      '#lfHomeBtn svg{width:22px;height:22px;display:block;pointer-events:none}' +
      '#lfHomeBtn.tuck-left{transform:translateX(-50%)}#lfHomeBtn.tuck-right{transform:translateX(50%)}' +
      '#lfHomeBtn:hover,#lfHomeBtn:focus-visible,#lfHomeBtn.is-active{opacity:.9;transform:none;outline:none}' +
      '#lfHomeBtn.is-dragging{transition:opacity .2s;opacity:.9;transform:none}';
    function homeDraggable(a, key) {
      var SIZE = 44, pos = { side: 'left', y: 0.86 }, start = null, dragged = false;
      try { var saved = JSON.parse(localStorage.getItem(key) || 'null'); if (saved && (saved.side === 'left' || saved.side === 'right') && saved.y >= 0 && saved.y <= 1) pos = saved; } catch (_) {}
      function place() {
        var top = Math.min(innerHeight - SIZE - 12, Math.max(12, pos.y * innerHeight - SIZE / 2));
        a.style.top = top + 'px';
        a.style.left = (pos.side === 'left' ? 0 : innerWidth - SIZE) + 'px';
        a.classList.toggle('tuck-left', pos.side === 'left');
        a.classList.toggle('tuck-right', pos.side === 'right');
      }
      place(); addEventListener('resize', place);
      a.addEventListener('pointerdown', function (e) {
        start = { x: e.clientX, y: e.clientY, l: a.offsetLeft, t: a.offsetTop }; dragged = false;
        a.classList.add('is-active'); try { a.setPointerCapture(e.pointerId); } catch (_) {}
      });
      a.addEventListener('pointermove', function (e) {
        if (!start) return;
        var dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (!dragged && Math.sqrt(dx * dx + dy * dy) < 10) return; // 移動超過 10px 才算拖動
        dragged = true; a.classList.add('is-dragging'); a.classList.remove('tuck-left', 'tuck-right');
        a.style.left = Math.min(innerWidth - SIZE, Math.max(0, start.l + dx)) + 'px';
        a.style.top = Math.min(innerHeight - SIZE, Math.max(0, start.t + dy)) + 'px';
      });
      function end() {
        if (!start) return;
        start = null; a.classList.remove('is-active', 'is-dragging');
        if (!dragged) return;
        pos = { side: a.offsetLeft + SIZE / 2 < innerWidth / 2 ? 'left' : 'right', y: (a.offsetTop + SIZE / 2) / innerHeight };
        try { localStorage.setItem(key, JSON.stringify(pos)); } catch (_) {}
        place();
      }
      a.addEventListener('pointerup', end); a.addEventListener('pointercancel', end);
      a.addEventListener('click', function (e) { if (dragged) { e.preventDefault(); dragged = false; } }); // 剛拖完不算點擊
      a.addEventListener('contextmenu', function (e) { e.preventDefault(); }); // 手機長按不跳出連結選單
    }
  function add() {
    if (window.top !== window || document.getElementById('lfHomeBtn')) return;
    var s = document.createElement('style');
    s.textContent = CSS.replace('Z', '2147483000');
    document.head.appendChild(s);
    var a = document.createElement('a');
    a.id = 'lfHomeBtn'; a.href = home; a.title = 'LinFamily 主畫面'; a.setAttribute('aria-label', '回 LinFamily 主畫面');
    a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/></svg>';
    document.body.appendChild(a);
    homeDraggable(a, me && me.getAttribute('data-key') || ('linfamily_homebtn_' + location.pathname.replace(/[^\w]+/g, '_')));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();
