/**
 * LinFamily 自己開發的子 App（例如 HannahProjects）用：左下角淡淡的圓形 🏠 浮動鈕回 LinFamily 主畫面。
 * 樣式與 DX04 的 lf-back.js（DX、YA、SR）、open.html 相同：平常幾乎透明，碰到才變清楚。
 * 使用方式：在 App 頁面最後加
 *   <script src="../linfamily-home.js" data-home="../"></script>
 */
(function () {
  var me = document.currentScript;
  var home = (me && me.getAttribute('data-home')) || '../';
  function add() {
    if (window.top !== window || document.getElementById('lfHomeBtn')) return;
    var s = document.createElement('style');
    s.textContent = '#lfHomeBtn{position:fixed;z-index:2147483000;left:calc(env(safe-area-inset-left) + 12px);bottom:calc(env(safe-area-inset-bottom) + 14px);' +
      'width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:rgba(28,28,28,.45);color:#fff;opacity:.28;' +
      '-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 2px 8px rgba(0,0,0,.15);transition:opacity .2s;-webkit-tap-highlight-color:transparent}' +
      '#lfHomeBtn:hover,#lfHomeBtn:focus-visible,#lfHomeBtn:active{opacity:.9;outline:none}#lfHomeBtn svg{width:22px;height:22px;display:block}';
    document.head.appendChild(s);
    var a = document.createElement('a');
    a.id = 'lfHomeBtn'; a.href = home; a.title = 'LinFamily 主畫面'; a.setAttribute('aria-label', '回 LinFamily 主畫面');
    a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/></svg>';
    document.body.appendChild(a);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();
