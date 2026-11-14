/**
 * LinFamily 自己開發的 App 用：安裝成 App（沒有瀏覽器返回鍵）時，左下角出現「⌂」回 LinFamily 主畫面。
 * 用瀏覽器開時不顯示。使用方式：在 App 頁面最後加
 *   <script src="../linfamily-home.js" data-home="../"></script>
 */
(function () {
  var me = document.currentScript;
  var home = (me && me.getAttribute('data-home')) || '../';
  function standalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function add() {
    if (!standalone() || document.getElementById('lfHomeBtn')) return;
    var a = document.createElement('a');
    a.id = 'lfHomeBtn'; a.href = home; a.setAttribute('aria-label', '回 LinFamily 主畫面'); a.textContent = '⌂';
    a.style.cssText = 'position:fixed;left:max(14px,env(safe-area-inset-left));bottom:calc(14px + env(safe-area-inset-bottom));z-index:2147483000;' +
      'width:44px;height:44px;border-radius:50%;display:grid;place-items:center;text-decoration:none;font:700 22px/1 Arial,sans-serif;' +
      'background:#0E2C4E;color:#F4E4C4;box-shadow:0 6px 18px rgba(0,0,0,.3);opacity:.92;-webkit-tap-highlight-color:transparent;';
    document.body.appendChild(a);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();
