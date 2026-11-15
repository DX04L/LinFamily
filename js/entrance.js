/* LinFamily 入口歡迎頁：內建瀏覽器處理（動畫在 js/entrance-waves.js）。
 * - window.lfEntranceGuard()：點擊時先呼叫；回傳 true 表示已處理（LINE／FB／IG 內建瀏覽器），不要叫出 Google 登入。
 */
(function () {
  const wrap = document.getElementById('lfWelcome');
  if (!wrap) return;
  // 入口頁顯示時，手機上方狀態列改成海的顏色（不是白色）；登入後還原
  const meta = document.getElementById('metaThemeColor');
  let savedTheme = null;
  function themeBar() {
    if (!meta) return;
    if (!wrap.hidden) { if (savedTheme === null) savedTheme = meta.getAttribute('content'); meta.setAttribute('content', '#02969B'); }
    else if (savedTheme !== null) { meta.setAttribute('content', savedTheme); savedTheme = null; }
  }
  new MutationObserver(themeBar).observe(wrap, { attributes: true, attributeFilter: ['hidden'] });
  themeBar();

  // ---------- LINE／Facebook／Instagram 內建瀏覽器（Google 不允許在裡面登入：disallowed_useragent） ----------
  const ua = navigator.userAgent || '';
  const isLine = /\bLine\//i.test(ua), inApp = isLine || /FBAN|FBAV|FB_IAB|Instagram/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const note = wrap.querySelector('.lf-ent-note');
  window.lfEntranceGuard = function () {
    if (!inApp) return false;
    const u = new URL(location.href);
    if (isLine && u.searchParams.get('openExternalBrowser') !== '1') { // LINE 看到這個參數會改用手機預設瀏覽器開
      u.searchParams.set('openExternalBrowser', '1'); location.replace(u.href); return true;
    }
    if (isAndroid) {
      location.href = 'intent://' + u.host + u.pathname + u.search + '#Intent;scheme=https;package=com.android.chrome;end';
      return true;
    }
    if (note) note.hidden = false; // iPhone 沒有可靠的跳轉方法，只提示
    return true;
  };
  if (inApp && note && !isAndroid && !isLine) note.hidden = false;
})();
