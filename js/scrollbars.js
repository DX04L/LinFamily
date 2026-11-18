// Shared visual scrollbar policy. Scroll input and overflow behavior stay native.
(function () {
  'use strict';
  if (window.CLC_SCROLLBARS_INSTALLED) return;
  window.CLC_SCROLLBARS_INSTALLED = true;
  var root = document.documentElement;
  var style = document.createElement('style');
  style.id = 'clc-scrollbar-style';
  style.textContent = `
html,body,* { scrollbar-gutter:auto !important; scrollbar-width:thin !important; scrollbar-color:transparent transparent !important; }
html.clc-scrollbar-active,html.clc-scrollbar-active *,*:not(html):not(body):hover { scrollbar-color:rgba(128,128,128,.55) transparent !important; }
*::-webkit-scrollbar { width:6px !important; height:6px !important; background:transparent !important; }
*::-webkit-scrollbar-track,*::-webkit-scrollbar-corner { background:transparent !important; }
*::-webkit-scrollbar-thumb { background:transparent !important; border-radius:999px !important; }
html.clc-scrollbar-active::-webkit-scrollbar-thumb,html.clc-scrollbar-active *::-webkit-scrollbar-thumb,*:not(html):not(body):hover::-webkit-scrollbar-thumb { background:rgba(128,128,128,.55) !important; }
@supports selector(::-webkit-scrollbar) { html,body,* { scrollbar-width:auto !important; } html,body,*,html.clc-scrollbar-active,html.clc-scrollbar-active *,*:not(html):not(body):hover { scrollbar-color:auto !important; } }
html.clc-scrollbars-hidden,html.clc-scrollbars-hidden *,:fullscreen,:fullscreen * { scrollbar-width:none !important; }
html.clc-scrollbars-hidden::-webkit-scrollbar,html.clc-scrollbars-hidden *::-webkit-scrollbar,:fullscreen::-webkit-scrollbar,:fullscreen *::-webkit-scrollbar { width:0 !important; height:0 !important; display:none !important; }
`;
  (document.head || root).appendChild(style);
  var queries = ['(display-mode: fullscreen)', '(display-mode: standalone)', '(display-mode: minimal-ui)'].map(function (q) { return window.matchMedia(q); });
  function syncMode() {
    root.classList.toggle('clc-scrollbars-hidden', !!document.fullscreenElement || navigator.standalone === true || queries.some(function (q) { return q.matches; }));
  }
  queries.forEach(function (q) {
    if (q.addEventListener) q.addEventListener('change', syncMode);
    else if (q.addListener) q.addListener(syncMode);
  });
  document.addEventListener('fullscreenchange', syncMode);
  window.addEventListener('resize', syncMode);
  var idleTimer;
  function showThumb() {
    root.classList.add('clc-scrollbar-active');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () { root.classList.remove('clc-scrollbar-active'); }, 1200);
  }
  document.addEventListener('scroll', showThumb, { capture:true, passive:true });
  document.addEventListener('wheel', showThumb, { passive:true });
  var lastPointer = 0;
  document.addEventListener('pointermove', function (e) {
    var now = Date.now(); if (now - lastPointer < 100) return; lastPointer = now;
    if (e.clientX > innerWidth - 12 || e.clientY > innerHeight - 12) showThumb();
  }, { passive:true });
  syncMode();
})();
