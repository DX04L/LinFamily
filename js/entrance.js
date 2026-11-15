/* LinFamily 入口歡迎頁：海浪影片播放控制＋內建瀏覽器處理。
 * - 影片由這裡才放進 <video>：prefers-reduced-motion 時不放，只顯示 poster。
 * - 自動播放被擋（iPhone 低電量模式等）→ 保持 poster，不會黑畫面。
 * - 分頁在背景、或已登入（入口頁隱藏）時暫停。
 * - window.lfEntranceGuard()：點擊時先呼叫；回傳 true 表示已處理（LINE／FB／IG 內建瀏覽器），不要叫出 Google 登入。
 */
(function () {
  const wrap = document.getElementById('lfWelcome');
  if (!wrap) return;
  const video = wrap.querySelector('video');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shown = () => !wrap.hidden && !document.hidden;

  if (video && !reduced) {
    [['assets/entrance.v1.webm', 'video/webm'], ['assets/entrance.v1.mp4', 'video/mp4']].forEach(([src, type]) => {
      const s = document.createElement('source'); s.src = src; s.type = type; video.append(s);
    });
    video.muted = true; video.load();
  }
  function sync() {
    if (!video || reduced || !video.currentSrc && !video.querySelector('source')) return;
    if (shown()) { const p = video.play(); if (p && p.catch) p.catch(() => {}); } // 被擋就留在 poster
    else video.pause();
  }
  document.addEventListener('visibilitychange', sync);
  new MutationObserver(sync).observe(wrap, { attributes: true, attributeFilter: ['hidden'] });
  sync();

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
