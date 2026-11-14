// 自家網站引用這支：<script src="https://<LinFamily網址>/lf-back.js" defer></script>
// 從 LinFamily 點進來時，左上角顯示「‹ LinFamily」回主畫面。
(function () {
  var home = new URL('./', document.currentScript.src).href, K = 'lf_from';
  try {
    if (document.referrer && new URL(document.referrer).origin === new URL(home).origin) sessionStorage.setItem(K, '1');
    if (sessionStorage.getItem(K) !== '1' || window.top !== window) return;
  } catch (_) { return; }
  var a = document.createElement('a');
  a.href = home; a.textContent = '‹ LinFamily'; a.setAttribute('aria-label', '回 LinFamily');
  a.style.cssText = 'position:fixed;z-index:2147483647;left:calc(env(safe-area-inset-left) + 10px);top:calc(env(safe-area-inset-top) + 10px);' +
    'padding:6px 12px;border-radius:999px;background:rgba(30,30,30,.72);color:#fff;font:600 13px -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif;' +
    'text-decoration:none;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 2px 8px rgba(0,0,0,.2)';
  (document.body || document.documentElement).appendChild(a);
})();
