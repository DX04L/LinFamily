/* LF 下拉重新整理：主畫面只有下方 App 區會捲動（body 不捲），瀏覽器原生的下拉更新失效，安裝成 App 後也沒有，所以自己做。
 * 在 Home／Family／Apps 區塊捲到最上面時往下拉 → 出現 ↻，拉夠放開就重新整理。編輯（晃動）中或對話框開著時不作用。 */
(function () {
  const TRIGGER = 70, MAX = 110;
  const ind = document.createElement('div');
  ind.setAttribute('aria-hidden', 'true');
  ind.textContent = '↻';
  ind.style.cssText = 'position:fixed;left:50%;top:calc(8px + env(safe-area-inset-top));z-index:80;width:36px;height:36px;margin-left:-18px;border-radius:50%;' +
    'display:grid;place-items:center;font-size:20px;font-weight:700;background:var(--btn,#E6E7E9);color:var(--pine,#4E8B7E);box-shadow:0 2px 10px rgba(0,0,0,.18);' +
    'opacity:0;transform:translateY(-50px);transition:opacity .15s;pointer-events:none;';
  document.body.appendChild(ind);
  let startY = null, dy = 0;
  const busy = () => document.querySelector('dialog[open]') || document.querySelector('.slot-grid.is-editing') || !document.getElementById('lfWelcome')?.hidden;
  document.addEventListener('touchstart', e => {
    const sec = e.target.closest && e.target.closest('main > section');
    startY = sec && sec.scrollTop <= 0 && e.touches.length === 1 && !busy() ? e.touches[0].clientY : null; dy = 0;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (startY === null) return;
    dy = Math.min(MAX, Math.max(0, (e.touches[0].clientY - startY) * 0.6));
    ind.style.transition = 'opacity .15s';
    ind.style.opacity = dy > 10 ? Math.min(1, dy / TRIGGER) : 0;
    ind.style.transform = `translateY(${dy - 40}px) rotate(${dy * 4}deg)`;
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (startY === null) return;
    startY = null;
    if (dy >= TRIGGER) { ind.style.transition = 'none'; ind.animate && ind.animate([{ transform: `translateY(${dy - 40}px) rotate(0)` }, { transform: `translateY(${dy - 40}px) rotate(360deg)` }], { duration: 600, iterations: Infinity }); location.reload(); return; }
    ind.style.transition = 'opacity .15s, transform .2s'; ind.style.opacity = 0; ind.style.transform = 'translateY(-50px)';
  });
})();
