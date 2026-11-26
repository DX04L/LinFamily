/* LF 家庭留言板（Family 分頁）— 操作照 LINE：群組聊天、照片、貼圖、回覆、收回、表情回應、@提及、公告、已讀、頭像、點頭像撥電話
   Firestore：
     lf_chat_messages/{id}  { uid, text, img, stk, replyTo:{id,name,text}, mentions:[uid], reacts:{uid:emoji}, unsent, ts }
     lf_chat_profiles/{uid} { name, av, email, at }（本人寫）   lf_chat_reads/{uid} { at }（本人寫，算已讀）
     lf_chat_phones/{uid}   { phone }（Superuser 寫）           lf_chat_meta/pin { id, name, text }（公告）
   用法：const chat = lfChatInit(rootEl, { db, desktop, toast, tabDot }); chat.auth(user, role); chat.show(true/false) */
(function () {
  const AV = [['cat', '小貓', '#f8c8d8', '#e58aa8'], ['bear', '小熊', '#e8c9a0', '#b98a5a'], ['rab', '兔兔', '#eef0f6', '#f2a7c0'], ['dog', '小狗', '#f3dcb5', '#a8774a'],
    ['pen', '企鵝', '#cfe3f7', '#2f3a4a'], ['chk', '小雞', '#fde9a0', '#f0a640'], ['frg', '青蛙', '#c9eab0', '#5a9a3a'], ['pnd', '熊貓', '#f4f4f4', '#333333']];
  const MOODS = ['', 'happy', 'love', 'wow']; // 貼圖：每個頭像 4 種表情
  // 貼圖：不畫方框，只有動物的臉；4 種表情各有不同的歪頭角度（臉部五官往轉的方向偏，看起來不是正面）
  const TILT = { '': [-10, -3], happy: [8, 3], love: [-5, 2.5], wow: [12, -2.5] };
  function face(key, mood, stk) {
    if (key === 'pinky') return '<img class="lfc-face" src="assets/pinky-avatar.webp" alt="Pinky">';
    if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(String(key || ''))) return `<img class="lfc-face" src="${key}" alt="">`; // 自訂照片頭像
    const a = AV.find(x => x[0] === key) || AV[0], t = a[0], b = a[2], c = a[3];
    let e = '';
    if (t === 'cat') e = `<path d="M14 22 L18 8 L26 18Z M50 22 L46 8 L38 18Z" fill="${c}"/>`;
    if (t === 'bear' || t === 'pnd') e = `<circle cx="16" cy="16" r="7" fill="${c}"/><circle cx="48" cy="16" r="7" fill="${c}"/>`;
    if (t === 'rab') e = `<ellipse cx="23" cy="10" rx="5" ry="12" fill="${c}"/><ellipse cx="41" cy="10" rx="5" ry="12" fill="${c}"/>`;
    if (t === 'dog') e = `<ellipse cx="13" cy="28" rx="6" ry="11" fill="${c}"/><ellipse cx="51" cy="28" rx="6" ry="11" fill="${c}"/>`;
    if (t === 'frg') e = `<circle cx="21" cy="17" r="8" fill="${b}" stroke="${c}" stroke-width="2"/><circle cx="43" cy="17" r="8" fill="${b}" stroke="${c}" stroke-width="2"/>`;
    if (t === 'chk') e = `<path d="M28 9 Q32 2 36 9" stroke="${c}" stroke-width="3" fill="none"/>`;
    const fc = t === 'pen' ? `<ellipse cx="32" cy="38" rx="16" ry="15" fill="#fff"/>` : '';
    let eyes = t === 'pnd' ? `<ellipse cx="24" cy="32" rx="5" ry="6" fill="#333"/><ellipse cx="40" cy="32" rx="5" ry="6" fill="#333"/><circle cx="24" cy="32" r="2" fill="#fff"/><circle cx="40" cy="32" r="2" fill="#fff"/>`
      : `<circle cx="25" cy="32" r="2.6" fill="#333"/><circle cx="39" cy="32" r="2.6" fill="#333"/>`;
    if (mood === 'happy') eyes = `<path d="M21 33 Q25 28 29 33 M35 33 Q39 28 43 33" stroke="#333" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    if (mood === 'love') eyes = `<path d="M25 35 l-4-4 a2.4 2.4 0 0 1 4-2.5 a2.4 2.4 0 0 1 4 2.5z M39 35 l-4-4 a2.4 2.4 0 0 1 4-2.5 a2.4 2.4 0 0 1 4 2.5z" fill="#e2445c"/>`;
    const beak = t === 'chk' || t === 'pen';
    const mouth = mood === 'wow' ? `<ellipse cx="32" cy="44" rx="3" ry="4" fill="#7a3b3b"/>` : mood === 'happy' || mood === 'love' ? `<path d="M27 42 Q32 48 37 42" stroke="#555" stroke-width="2" fill="none" stroke-linecap="round"/>` : '';
    const nose = beak ? `<path d="M29 38 L35 38 L32 42Z" fill="#f0a640"/>` : `<ellipse cx="32" cy="39" rx="2.4" ry="1.8" fill="#555"/>`;
    const feat = `${fc}${eyes}${nose}${beak ? '' : mouth}<circle cx="19" cy="41" r="3" fill="#f39cb0" opacity=".6"/><circle cx="45" cy="41" r="3" fill="#f39cb0" opacity=".6"/>`;
    if (stk) {
      const [deg, dx] = TILT[mood] || TILT[''];
      return `<svg viewBox="-4 -4 72 72" width="100%" height="100%" aria-hidden="true"><g transform="rotate(${deg} 32 34)">${e}<ellipse cx="32" cy="35" rx="23" ry="21" fill="${b}" stroke="${c}" stroke-opacity=".35" stroke-width="1.5"/><g transform="translate(${dx} 0)">${feat}</g></g></svg>`;
    }
    return `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true"><rect width="64" height="64" fill="${b}"/>${e}${feat}</svg>`;
  }
  const PINKY_LABELS = ['早安', 'Good night', '謝啦！', 'OK!', '辛苦了', 'You got this!'];
  const BLUES_LABELS = ['Good Morning!', '等等我！', 'High Five!', '抱一下', 'On my way!', '掰掰！'];
  const STICKER_PACKS = {
    Pinky: PINKY_LABELS.map((_, i) => 'pinky-' + (i + 1)),
    Bluezi: BLUES_LABELS.map((_, i) => 'blues-new-' + (i + 1))
  };
  const STICKERS = new Map([
    ...STICKER_PACKS.Pinky.map((id, i) => [id, 'Pinky · ' + PINKY_LABELS[i]]),
    ...STICKER_PACKS.Bluezi.map((id, i) => [id, 'Bluezi · ' + BLUES_LABELS[i]]),
    // Keep the intended greeting on Bluezi stickers sent before the redesign.
    ...PINKY_LABELS.map((label, i) => ['blues-' + (i + 1), 'Bluezi · ' + label])
  ]);
  const LEGACY_STICKERS = AV.flatMap(([key, label]) =>
    MOODS.map(mood => ({ id: key + ':' + mood, label })));
  const RECENT_STICKERS_KEY = 'lf-chat-recent-stickers';
  function sticker(id) {
    if (STICKERS.has(id)) return `<img src="assets/chat-stickers/${id}.webp?v=2" alt="${STICKERS.get(id)}" draggable="false">`;
    const [key, mood] = id.split(':');
    return face(key, mood, true);
  }
  const EMOS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const DAY = 86400000;
  function dayLabel(ms) {
    const d = new Date(ms), now = new Date(), d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (ms >= d0) return '今天'; if (ms >= d0 - DAY) return '昨天';
    return (d.getFullYear() !== now.getFullYear() ? d.getFullYear() + '/' : '') + (d.getMonth() + 1) + '/' + d.getDate() + '（' + '日一二三四五六'[d.getDay()] + '）';
  }
  const hm = ms => { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const ms = ts => ts && ts.toMillis ? ts.toMillis() : Date.now();

  // 照片壓縮：長邊 1280、JPEG；太大再縮，確保一則訊息 < 900KB（Firestore 單筆上限 1MB）
  async function shrink(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      let max = 1280, q = .72, out = '';
      for (let k = 0; k < 6; k++) {
        const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * s); cv.height = Math.round(img.naturalHeight * s);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        out = cv.toDataURL('image/jpeg', q);
        if (out.length < 900000) return out;
        max *= .8; q = Math.max(.5, q - .06);
      }
      return out.length < 900000 ? out : '';
    } finally { URL.revokeObjectURL(url); }
  }

  window.lfChatInit = function (root, opt) {
    const db = opt.db, FV = firebase.firestore.FieldValue;
    let me = null, role = '', unsubs = [], visible = false, needPick = false, denied = false;
    let msgs = [], members = {}, phones = {}, reads = {}, pin = null, myRead = 0, seenTs = 0, firstOpen = true, reply = null, menuOpen = false;
    const hidden = new Set(JSON.parse(localStorage.getItem('linfamily_chat_hidden') || '[]'));
    const isSuper = () => role === 'superuser';
    const PINKY = { name: 'Pinky', av: 'pinky' }; // AI 小幫手（訊息存成發問者的 uid + bot:'pinky'）
    const prof = uid => members[uid] || { name: '家人', av: 'cat' };

    const I = d => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const IC = {
      back: I('<path d="M15 4 7 12l8 8"/>'), search: I('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/><path d="M11 7.5v3.5l2.2 1.5"/>'),
      menu: I('<path d="M4 6.5h16M4 12h16M4 17.5h16"/>'), more: I('<path d="m9 5 7 7-7 7"/>'),
      cam: I('<path d="M4 8h3l1.6-2.5h6.8L17 8h3v11H4z"/><circle cx="12" cy="13.2" r="3.4"/>'), pic: I('<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4.5 4 3.5 2.5-2 4.5 4"/>'),
      smile: I('<circle cx="12" cy="12" r="8.5"/><path d="M8.7 14.2c1.8 2 4.8 2 6.6 0"/><path d="M9.3 9.8h.01M14.7 9.8h.01" stroke-width="2.4"/>'),
      mic: I('<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>'), send: I('<path d="M4.5 12 20 4.5 15.5 20l-3.2-6.3z"/><path d="m12.3 13.7 7.7-9.2"/>')
    };
    root.innerHTML = `
      <div class="lfc">
        <div class="lfc-top" id="lfcHead">
          <button class="lfc-ibtn" id="lfcMin" title="收合留言板" aria-label="收合留言板">${IC.back}</button>
          <strong id="lfcMyName"></strong>
          <button class="lfc-ibtn" id="lfcOptions" aria-label="留言板選單" aria-expanded="false" aria-controls="lfcOptionsList">${IC.menu}</button>
          <div class="dk-menu lfc-options" id="lfcOptionsList" hidden>
            <button type="button" data-feature="photo">Photo</button>
            <button type="button" data-feature="note">Note</button>
          </div>
        </div>
        <div class="lfc-findbar" id="lfcFindBar" hidden><span id="lfcFindN"></span><button id="lfcFindUp" title="上一則（較舊）">˄</button><button id="lfcFindDn" title="下一則（較新）">˅</button></div>
        <div class="lfc-pin" id="lfcPin" hidden>📢<span id="lfcPinText"></span><button id="lfcUnpin" title="取消公告">✕</button></div>
        <div class="lfc-list" id="lfcList"></div>
        <div class="lfc-reply" id="lfcReply" hidden>↩︎<span id="lfcReplyText"></span><button id="lfcReplyX">✕</button></div>
        <div class="lfc-sugg" id="lfcSugg" hidden></div>
        <div class="lfc-stks" id="lfcStks" hidden></div>
        <div class="lfc-bar">
          <button class="lfc-ibtn" id="lfcMore" title="更多">${IC.more}</button>
          <span class="lfc-tools" id="lfcTools" hidden><button class="lfc-ibtn" id="lfcCam" title="拍照">${IC.cam}</button><button class="lfc-ibtn" id="lfcPic" title="傳照片">${IC.pic}</button></span>
          <div class="lfc-inwrap"><textarea class="lfc-in" id="lfcIn" rows="1" enterkeyhint="send" aria-label="輸入訊息"></textarea><button class="lfc-ibtn lfc-smile" id="lfcStk" title="貼圖">${IC.smile}</button></div>
          <button class="lfc-ibtn" id="lfcSend" title="語音訊息">${IC.mic}</button>
        </div>
        <input type="file" id="lfcFileCam" accept="image/*" capture="environment" hidden>
        <input type="file" id="lfcFilePic" accept="image/*" multiple hidden>
      </div>`;
    const $ = id => root.querySelector('#' + id);
    const list = $('lfcList'), input = $('lfcIn');
    // ↓ 回到最新：沒停在最底下時出現，數字＝下面還沒捲到的別人訊息
    const down = h('<div class="lfc-downwrap"><button class="lfc-down" title="回到最新訊息" hidden><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg><b hidden></b></button></div>');
    const downBtn = down.firstElementChild;
    downBtn.onclick = () => { list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' }); };

    // ---------- 版面：手機全寬貼底；寬螢幕（≥640，跟桌面引擎同一個分界）是浮在 Family 分頁上的卡片，可左右移動、調寬窄 ----------
    const box = root.firstElementChild, wideQ = matchMedia('(min-width:640px)');
    const notice = h('<div class="lfc-notice" role="status" aria-live="polite"></div>');
    box.append(notice);
    let noticeTimer, closeOverlay;
    function toast(message) {
      notice.textContent = message;
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => { notice.textContent = ''; }, 3500);
    }

    // 留言板位置：先用這台裝置上次的位置（重新整理不會先跳到預設位置再移過去），雲端讀到再校正
    const LAY_KEY = 'lf_chat_layout';
    let lay = { x: null, w: 420 }, layLoaded = false, collapsed = false;
    try { const c = JSON.parse(localStorage.getItem(LAY_KEY) || 'null'); if (c && c.w) lay = { x: c.x, w: c.w }; } catch (_) {}
    const keepLay = () => { try { localStorage.setItem(LAY_KEY, JSON.stringify({ x: lay.x == null ? null : Math.round(lay.x), w: Math.round(lay.w) })); } catch (_) {} };
    root.setAttribute('data-lf-menu-ignore', ''); // 卡片裡不出現 LF 的 Copy link 選單
    root.addEventListener('contextmenu', e => { if (!e.target.closest('textarea, input, a')) e.preventDefault(); });
    const tab = h('<button class="lfc-tab" hidden>Lin Family<span class="lfc-tdot" hidden></span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg></button>');
    root.append(tab, h('<div class="lfc-rz l"></div>'), h('<div class="lfc-rz r"></div>'));
    const rzL = root.querySelector('.lfc-rz.l'), rzR = root.querySelector('.lfc-rz.r');
    function place() {
      const W = root.clientWidth, wide = wideQ.matches;
      let x = 0, w = W;
      if (wide) { w = Math.min(W, Math.max(360, lay.w || 420)); x = lay.x == null ? W - w : lay.x; x = Math.max(0, Math.min(W - w, x)); }
      box.style.left = x + 'px'; box.style.width = wide ? w + 'px' : '';
      rzL.style.left = (x - 5) + 'px'; rzR.style.left = (x + w - 5) + 'px'; rzL.hidden = rzR.hidden = !wide || collapsed;
      tab.style.left = (wide ? x + 16 : 12) + 'px';
      return { x, w, W };
    }
    function fit() {
      if (!visible) return;
      const vh = window.visualViewport ? visualViewport.height : innerHeight;
      box.style.height = Math.max(160, Math.min(root.clientHeight, vh - Math.max(0, root.getBoundingClientRect().top))) + 'px'; // 手機橫放高度很矮：最低只留 160，輸入列才不會被推出畫面
      place();
    }
    addEventListener('resize', fit); if (window.visualViewport) visualViewport.addEventListener('resize', () => { const nb = nearBottom(); fit(); if (nb) toBottom(); });
    // ---------- 收合 = 右下角固定泡泡（顯示未讀數字）；展開／收合是「黑洞放出／吸入」動畫 ----------
    // 展開：泡泡噴出一顆光點，沿弧線飛到面板底部中央，再從那一點攤開（先橫向、再縱向）；收合完全倒著播。
    // 手機面板全寬，光點飛到底部中央後往左右兩邊攤開；電腦飛到面板設定的位置再攤開。
    const bubble = h('<button class="lfc-bubble" hidden title="展開留言板"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5h16v10H9l-5 4z"/></svg><b class="lfc-bnum" hidden></b></button>');
    root.append(bubble);
    bubble.onclick = () => setCollapsed(false);
    let warpId = 0;
    const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches || !box.animate;
    // 像 Android 關掉 App：整張面板等比例縮小、圓角變圓、淡出，縮進右下角泡泡；泡泡再慢慢浮現。展開完全倒著播。
    async function warp(c) {
      const id = ++warpId; box.getAnimations().forEach(a => a.cancel()); bubble.getAnimations().forEach(a => a.cancel());
      const B = box.getBoundingClientRect(), bb = bubble.getBoundingClientRect();
      const dx = bb.left + bb.width / 2 - (B.left + B.width / 2), dy = bb.top + bb.height / 2 - (B.top + B.height / 2);
      const sc = Math.max(bb.width / B.width, bb.height / B.height);
      box.style.transformOrigin = '50% 50%';
      const kf = [{ transform: 'none', borderRadius: '20px 20px 0 0', opacity: 1 },
                  { offset: .75, opacity: 1 },
                  { transform: `translate(${dx}px,${dy}px) scale(${sc})`, borderRadius: '50%', opacity: 0 }];
      const ease = 'cubic-bezier(.3,0,.1,1)';
      if (c) { // 收進去
        const an = box.animate(kf, { duration: 320, easing: ease, fill: 'forwards' });
        bubble.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 260, delay: 220, easing: 'ease-out', fill: 'backwards' });
        await an.finished.catch(() => {}); if (id !== warpId) return;
        box.classList.add('is-collapsed'); an.cancel(); place();
      } else { // 飛出來
        bubble.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.6)' }], { duration: 140, easing: 'ease-in', fill: 'forwards' });
        await box.animate(kf.slice().reverse(), { duration: 340, easing: ease }).finished.catch(() => {}); if (id !== warpId) return;
        bubble.hidden = true; bubble.getAnimations().forEach(a => a.cancel());
      }
    }
    function applyCollapsed(c, animate = false) {
      if (c === collapsed) return;
      collapsed = c; place();
      if (!c) { box.classList.remove('is-collapsed'); fit(); firstOpen = true; myRead = seenTs = me ? (reads[me.uid] || 0) : 0; render(); markRead(); }
      dot();
      if (!animate || calm()) {
        ++warpId;
        box.getAnimations?.().forEach(a => a.cancel());
        bubble.getAnimations?.().forEach(a => a.cancel());
        box.classList.toggle('is-collapsed', c);
        bubble.hidden = !c;
        return;
      }
      bubble.hidden = false; warp(c);
    }
    const collapsedKey = uid => 'linfamily_messenger_collapsed_' + uid;
    function cacheCollapsed(c) {
      if (!me) return;
      try { localStorage.setItem(collapsedKey(me.uid), c ? '1' : '0'); } catch (_) {}
    }
    function setCollapsed(c) {
      if (c === collapsed) return;
      applyCollapsed(c, true);
      if (!me) return;
      cacheCollapsed(c);
      desktopDoc().set({ messengerCollapsed: c }, { merge: true })
        .catch(() => opt.toast('Messenger 狀態同步失敗'));
    }
    tab.onclick = () => setCollapsed(false);
    function saveLay() { keepLay(); if (me) db.collection('lf_chat_profiles').doc(me.uid).set({ layout: { x: Math.round(lay.x), w: Math.round(lay.w) } }, { merge: true }).catch(() => {}); }
    // 拖標題列：寬螢幕左右移動；沒有移動就是點一下 → 收合
    function drag(el, onMove, onClick) {
      el.addEventListener('pointerdown', e => {
        if (e.button > 0 || e.target.closest('button:not(.lfc-tab), input')) return;
        const sx = e.clientX, st = place(); let moved = false;
        const mv = ev => { const dx = ev.clientX - sx; if (!moved && Math.abs(dx) < 5) return; if (!moved) { moved = true; try { el.setPointerCapture(e.pointerId); } catch (_) {} } onMove(dx, st); place(); };
        const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (moved) saveLay(); else if (onClick) onClick(); };
        addEventListener('pointermove', mv); addEventListener('pointerup', up);
      });
    }
    // 收合鈕；寬螢幕按住頂端隱形條左右拖 = 移動位置
    $('lfcMin').onclick = () => { setOptions(false); setCollapsed(true); };
    drag($('lfcHead'), (dx, st) => { lay.x = st.x + dx; });
    drag(rzR, (dx, st) => { lay.x = st.x; lay.w = Math.max(360, Math.min(st.W - st.x, st.w + dx)); });
    drag(rzL, (dx, st) => { const w = Math.max(360, Math.min(st.x + st.w, st.w - dx)); lay.x = st.x + st.w - w; lay.w = w; });
    wideQ.addEventListener && wideQ.addEventListener('change', fit);

    const options = $('lfcOptionsList'), optionsButton = $('lfcOptions');
    function setOptions(open) {
      options.hidden = !open;
      optionsButton.setAttribute('aria-expanded', String(open));
    }
    optionsButton.onclick = () => setOptions(options.hidden);
    document.addEventListener('pointerdown', e => {
      if (!options.hidden && !options.contains(e.target) && !optionsButton.contains(e.target)) setOptions(false);
    });
    box.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !options.hidden) {
        e.stopPropagation();
        setOptions(false);
        optionsButton.focus();
      }
    });

    function activateTile(tile, action) {
      tile.onclick = action;
      tile.onkeydown = e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        action();
      };
    }
    const pinnedPhotos = new Map();
    const widgetSize = { type: 'card', w: 2, h: 1, minW: 2, minH: 1 };
    let familyLayoutUid = null;
    const desktopDoc = () => db.collection('linfamily_desktops').doc(me.email.toLowerCase());
    const familyDesk = window.clcDesktop(opt.desktop, {
      cols: { desktop: 16, phone: 4 }, cell: { desktop: 104, phone: 88 }, ratio: 1.3, margin: { desktop: 11, phone: 8 },
      waitLayout: true,
      canEdit: () => !!familyLayoutUid,
      menu: ({ id }) => {
        if (!id) return [{ label: '往上整理', run: () => familyDesk.compact() }];
        const photo = pinnedPhotos.get(id);
        if (!photo) return [{ label: '開啟', run: () => openFeature(id) }];
        return [
          { label: '開啟照片', run: () => photo.message && viewer(photo.message.id, photo.message) },
          { label: '從桌面移除', run: () => savePinnedPhoto(photo.id, false) }
        ];
      },
      saveLayout: (mode, map) => {
        if (!familyLayoutUid || familyLayoutUid !== me?.uid) return;
        const field = 'familyLayout_' + mode;
        return desktopDoc().set({ [field]: map }, { mergeFields: [field] });
      },
      error: () => opt.toast('家庭桌面排列儲存失敗')
    });
    const landscape = 'assets/family-landscape-v1.webp';
    let photoPreview;
    for (const [id, label] of [['note', 'Notes'], ['photo', 'Photo']]) {
      const photo = id === 'photo';
      const image = photo ? landscape : 'assets/family-notebook-v1.webp';
      const widget = h(`<div role="button" tabindex="0" aria-label="${label}" class="lf-family-widget lf-family-${id} dk-handle">
        <img alt="" src="${image}" draggable="false">
      </div>`);
      if (photo) {
        photoPreview = widget.firstElementChild;
        photoPreview.addEventListener('error', () => {
          if (photoPreview.getAttribute('src') !== landscape) photoPreview.src = landscape;
        });
      }
      activateTile(widget, () => openFeature(id));
      familyDesk.put(id, widget, widgetSize);
    }

    function familyLayout(layout) {
      if (!layout) return layout;
      const updated = { ...layout };
      for (const id of ['note', 'photo']) {
        const pos = layout[id];
        if (pos?.w === 1 && pos.h === 2) updated[id] = { ...pos, w: 2, h: 1 };
      }
      if (layout.__byCols) updated.__byCols = Object.fromEntries(
        Object.entries(layout.__byCols).map(([cols, map]) => [cols, familyLayout(map)])
      );
      return updated;
    }

    async function savePinnedPhoto(id, add) {
      if (!me || familyLayoutUid !== me.uid) return opt.toast('家庭桌面尚未載入');
      if (add && pinnedPhotos.has('pinned-' + id)) return opt.toast('這張照片已在 Family 桌面');
      try {
        await desktopDoc().set({ familyPinnedPhotos: { [id]: add ? true : FV.delete() } }, { merge: true });
        opt.toast(add ? '已加入 Family 桌面' : '已從 Family 桌面移除');
      } catch (_) {
        opt.toast(add ? '無法將照片加入 Family 桌面' : '無法從 Family 桌面移除照片');
      }
    }
    function syncPinnedPhotos(saved = {}) {
      for (const [key, entry] of pinnedPhotos) {
        if (saved[entry.id] === true) continue;
        entry.stop();
        pinnedPhotos.delete(key);
        familyDesk.drop(key);
      }
      for (const id of Object.keys(saved)) {
        const key = 'pinned-' + id;
        if (saved[id] !== true || pinnedPhotos.has(key)) continue;
        const tile = h('<div role="button" tabindex="0" class="lf-family-pinned dk-handle" aria-label="開啟原始照片"><img alt="" hidden><span>載入照片…</span></div>');
        const entry = { id, message: null };
        const img = tile.querySelector('img'), status = tile.querySelector('span');
        pinnedPhotos.set(key, entry);
        familyDesk.put(key, tile, widgetSize);
        activateTile(tile, () => entry.message && viewer(id, entry.message));
        const showPhoto = m => {
          entry.message = m?.img && !m.unsent ? { id, img: m.img, t: ms(m.ts) } : null;
          img.hidden = status.hidden = false;
          if (entry.message) {
            img.src = entry.message.img;
            status.hidden = true;
          } else {
            img.removeAttribute('src');
            img.hidden = true;
            status.textContent = '照片已無法顯示';
          }
          tile.setAttribute('aria-disabled', String(!entry.message));
        };
        entry.stop = db.collection('lf_chat_messages').doc(id).onSnapshot(s => showPhoto(s.data()), () => showPhoto(null));
      }
    }

    let note = '';
    const feature = h('<dialog class="lf-dialog lf-family-feature" aria-labelledby="lfFamilyFeatureTitle"></dialog>');
    root.after(feature);
    let startedOutsideAlbum = false;
    function outsideAlbum(e) {
      if (!feature.hasAttribute('data-photo') || e.target !== feature) return false;
      const r = feature.getBoundingClientRect();
      return e.clientX < r.left || e.clientX >= r.right || e.clientY < r.top || e.clientY >= r.bottom;
    }
    feature.addEventListener('pointerdown', e => { startedOutsideAlbum = outsideAlbum(e); });
    feature.addEventListener('click', e => {
      if (startedOutsideAlbum && outsideAlbum(e)) feature.close();
      startedOutsideAlbum = false;
    });
    function openFeature(id) {
      if (!me || feature.open) return;
      setOptions(false);
      const photo = id === 'photo';
      feature.toggleAttribute('data-photo', photo);
      feature.setAttribute('closedby', photo ? 'any' : 'closerequest');
      startedOutsideAlbum = false;
      if (!photo && familyLayoutUid !== me.uid) return opt.toast('筆記尚未載入');
      feature.innerHTML = `<form><h3 id="lfFamilyFeatureTitle">${photo ? 'Photo' : 'Notes'}</h3>
        ${photo ? '<div class="lf-family-gallery"></div>' : '<textarea aria-label="筆記內容" rows="7" maxlength="10000" placeholder="寫下筆記…"></textarea><p class="lf-err" role="status" hidden></p>'}
        <div class="lf-family-actions"><button class="lfc-gbtn" type="button" data-close>關閉</button>
        ${photo ? '' : '<button class="lfc-pbtn" type="submit">儲存</button>'}</div></form>`;
      feature.querySelector('[data-close]').onclick = () => feature.close();
      const form = feature.querySelector('form');
      form.onsubmit = async e => {
        e.preventDefault();
        if (photo || !me) return;
        const area = form.querySelector('textarea'), button = form.querySelector('[type=submit]');
        const status = form.querySelector('.lf-err');
        const uid = me.uid;
        button.disabled = area.readOnly = true;
        status.hidden = true;
        try {
          await desktopDoc().set({ familyNote: area.value }, { merge: true });
          if (me?.uid === uid) note = area.value;
          if (feature.contains(form) && feature.open) feature.close();
        } catch (_) {
          status.textContent = '筆記儲存失敗，請再試一次。';
          status.hidden = false;
          button.disabled = area.readOnly = false;
        }
      };
      if (photo) {
        const gallery = feature.querySelector('.lf-family-gallery');
        for (const m of chatPhotos().reverse()) {
          const thumb = h('<button type="button"><img alt="查看照片" loading="lazy"></button>');
          thumb.firstElementChild.src = m.img;
          thumb.onclick = () => { feature.close(); viewer(m.id); };
          gallery.append(thumb);
        }
        if (!gallery.childElementCount) gallery.textContent = '最近的聊天沒有照片。';
      } else {
        feature.querySelector('textarea').value = note;
      }
      feature.showModal();
    }
    options.querySelectorAll('[data-feature]').forEach(b => {
      b.onclick = () => { optionsButton.focus(); openFeature(b.dataset.feature); };
    });
    function updateName() {
      $('lfcMyName').textContent = me ? members[me.uid]?.name || me.displayName || me.email.split('@')[0] : '';
    }
    const chatPhotos = () => msgs.filter(m => m.img && !m.unsent && !hidden.has(m.id));
    function updatePhotoPreview() {
      const latest = chatPhotos().pop();
      const src = latest?.img || landscape;
      if (photoPreview.getAttribute('src') !== src) photoPreview.src = src;
    }

    // ---------- 資料 ----------
    function stop() { unsubs.forEach(u => u()); unsubs = []; }
    function start() {
      stop(); firstOpen = true; denied = false;
      unsubs.push(desktopDoc().onSnapshot({ includeMetadataChanges: true }, s => {
        if (s.metadata.hasPendingWrites || (s.metadata.fromCache && !s.exists)) return;
        const data = s.data() || {};
        syncPinnedPhotos(data.familyPinnedPhotos || {});
        note = typeof data.familyNote === 'string' ? data.familyNote : '';
        for (const mode of ['desktop', 'phone']) familyDesk.setLayout(mode, familyLayout(data['familyLayout_' + mode]));
        familyLayoutUid = me.uid;
        const savedCollapsed = data.messengerCollapsed === true;
        cacheCollapsed(savedCollapsed);
        applyCollapsed(savedCollapsed);
      }, () => opt.toast('家庭桌面讀取失敗')));
      const col = n => db.collection(n);
      unsubs.push(col('lf_chat_profiles').onSnapshot(s => {
        members = {}; s.forEach(d => members[d.id] = d.data());
        updateName();
        if (!layLoaded && members[me.uid]) { layLoaded = true; const L = members[me.uid].layout; if (L && L.w) { lay = { x: L.x, w: L.w }; keepLay(); place(); } }
        if (!members[me.uid]) col('lf_chat_profiles').doc(me.uid).set({ name: me.displayName || me.email.split('@')[0], av: 'cat', email: me.email.toLowerCase(), at: FV.serverTimestamp() }).then(() => { needPick = true; if (visible) { needPick = false; avatarPicker(true); } });
        render();
      }, err));
      unsubs.push(col('lf_chat_phones').onSnapshot(s => { phones = {}; s.forEach(d => phones[d.id] = d.data().phone || ''); }, err));
      unsubs.push(col('lf_chat_reads').onSnapshot(s => {
        reads = {}; s.forEach(d => reads[d.id] = ms(d.data({ serverTimestamps: 'estimate' }).at));
        if (reads[me.uid] && firstOpen) myRead = seenTs = Math.max(seenTs, reads[me.uid]);
        render(); dot();
      }, err));
      unsubs.push(col('lf_chat_meta').doc('pin').onSnapshot(d => { pin = d.exists && d.data().id ? d.data() : null; $('lfcPin').hidden = !pin; if (pin) $('lfcPinText').textContent = pin.name + '：' + pin.text; fit(); }, err));
      unsubs.push(col('lf_chat_messages').orderBy('ts', 'desc').limit(300).onSnapshot(s => {
        msgs = s.docs.map(d => Object.assign({ id: d.id }, d.data({ serverTimestamps: 'estimate' }))).map(m => (m.t = ms(m.ts), m)).reverse();
        render(); dot(); markRead();
      }, err));
    }
    function err(e) { console.warn('留言板', e); toast('留言板讀取失敗：' + ((e && e.code) || e)); if (e && e.code === 'permission-denied') denied = true, list.innerHTML = '<p class="lfc-empty">留言板還沒開放（Firestore 規則尚未發布）。</p>'; }
    function markRead() {
      if (!visible || collapsed || document.hidden || !me || !msgs.length) return;
      const last = msgs[msgs.length - 1].t;
      if ((reads[me.uid] || 0) >= last) return;
      reads[me.uid] = last;
      db.collection('lf_chat_reads').doc(me.uid).set({ at: FV.serverTimestamp() }).catch(() => {});
    }
    document.addEventListener('visibilitychange', markRead);
    function dot() { // Family 分頁紅點：別人有新訊息、我還沒看
      if (!opt.tabDot || !me) return;
      const mine = reads[me.uid] || 0;
      const n = msgs.filter(m => m.uid !== me.uid && m.t > mine).length, unread = n > 0;
      opt.tabDot(visible ? 0 : n);
      const num = bubble.querySelector('.lfc-bnum'); num.hidden = !unread; num.textContent = n > 99 ? '99+' : n;
      badge(n);
    }
    // 瀏覽器分頁標題「(3) LinFamily」、分頁小圖示右上角紅點、安裝成 App 時的圖示數字（電腦、iPhone）
    let baseTitle = '', lastBadge = -1, favOrig = null, favDot = null;
    function badge(n) {
      if (n === lastBadge) return; lastBadge = n;
      if (!baseTitle) baseTitle = document.title.replace(/^\(\d+\+?\)\s*/, '');
      document.title = n ? `(${n > 99 ? '99+' : n}) ${baseTitle}` : baseTitle;
      try { if (navigator.setAppBadge) n ? navigator.setAppBadge(n) : navigator.clearAppBadge(); } catch (_) {}
      const link = document.querySelector('link[rel="icon"]'); if (!link) return;
      if (!favOrig) favOrig = link.href;
      if (!n) { link.href = favOrig; return; }
      if (favDot) { link.href = favDot; return; }
      const im = new Image(); im.onload = () => {
        const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
        g.drawImage(im, 0, 0, 64, 64); g.beginPath(); g.arc(50, 14, 13, 0, 7); g.fillStyle = '#ef4444'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke();
        try { favDot = c.toDataURL('image/png'); if (lastBadge) link.href = favDot; } catch (_) {}
      }; im.src = favOrig;
    }

    // ---------- 畫面 ----------
    let lastId = '', stick = true;
    list.addEventListener('scroll', () => { stick = nearBottom(); }, { passive: true });
    list.addEventListener('load', () => { if (stick) toBottom(); }, true); // 照片載入後高度變了，仍停在最新
    const nearBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    const toBottom = () => { list.scrollTop = list.scrollHeight; };
    function textHtml(m) {
      let s = esc(m.text || '').replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
      (m.mentions || []).forEach(uid => { const n = esc('@' + prof(uid).name); s = s.split(n).join(`<span class="lfc-ment">${n}</span>`); });
      s = s.replace(/@pinky/gi, x => `<span class="lfc-ment">${x}</span>`);
      return s;
    }
    function readCount(m) { let n = 0; for (const uid in reads) if (uid !== me.uid && reads[uid] >= m.t) n++; return n; }
    function render() {
      if (!me || denied) return;
      updatePhotoPreview();
      const keep = nearBottom(), top = list.scrollTop, newest = msgs.length ? msgs[msgs.length - 1].id : '', fresh = newest !== lastId; lastId = newest;
      const nm = msgs[msgs.length - 1], ownNew = !!nm && nm.uid === me.uid && nm.bot !== 'pinky';
      const frag = document.createDocumentFragment(); let lastDay = '', unreadMark = false;
      const shown = msgs.filter(m => !hidden.has(m.id));
      if (!shown.length) frag.append(h('<p class="lfc-empty">No messages yet — say hi to your family!</p>'));
      shown.forEach(m => {
        const dl = dayLabel(m.t);
        if (dl !== lastDay) { frag.append(h(`<div class="lfc-date"><span>${dl}</span></div>`)); lastDay = dl; }
        if (!unreadMark && firstOpen && myRead && m.t > myRead && m.uid !== me.uid) { unreadMark = true; frag.append(h('<div class="lfc-sys lfc-unread" id="lfcUnreadMark"><span>以下為尚未閱讀的訊息</span></div>')); }
        const bot = m.bot === 'pinky', p = bot ? PINKY : prof(m.uid), mine = !bot && m.uid === me.uid;
        if (m.unsent) { frag.append(h(`<div class="lfc-sys"><span>${esc(mine ? '你' : p.name)}已收回訊息</span></div>`)); return; }
        let body;
        if (m.img) body = `<div class="lfc-bub lfc-media"><img class="lfc-photo" src="${m.img}" alt="照片"></div>`;
        else if (m.stk) { body = `<div class="lfc-bub lfc-media lfc-stkbub"><div class="lfc-stk">${sticker(m.stk)}</div></div>`; }
        else body = `<div class="lfc-bub">${m.replyTo ? `<div class="lfc-quote" data-go="${esc(m.replyTo.id)}">${esc(m.replyTo.name)}：${esc(m.replyTo.text)}</div>` : ''}${textHtml(m)}</div>`;
        const rc = {}; Object.values(m.reacts || {}).forEach(e => rc[e] = (rc[e] || 0) + 1);
        const myE = (m.reacts || {})[me.uid];
        const reacts = Object.keys(rc).length ? `<div class="lfc-reacts">${Object.keys(rc).map(e => `<span data-emo="${e}" class="${e === myE ? 'mine' : ''}">${e}${rc[e] > 1 ? ' ' + rc[e] : ''}</span>`).join('')}</div>` : '';
        const n = mine ? readCount(m) : 0;
        const meta = `<div class="lfc-meta">${mine && n ? '已讀 ' + n + '<br>' : ''}${hm(m.t)}</div>`;
        const hit = !mine && (m.mentions || []).includes(me.uid);
        frag.append(h(`<div class="lfc-row${mine ? ' me' : ''}${hit ? ' hit' : ''}" data-id="${m.id}" data-ts="${ms(m.ts)}">
          ${mine ? '' : bot ? `<span class="lfc-av lfc-bot" data-at="Pinky" aria-label="Pinky">${face(p.av)}</span>` : `<button class="lfc-av" data-uid="${esc(m.uid)}" aria-label="${esc(p.name)}">${face(p.av)}</button>`}
          <div class="lfc-col">${mine ? '' : `<button class="lfc-name" data-at="${esc(p.name)}" title="@${esc(p.name)}">${esc(p.name)}</button>`}<div class="lfc-line">${body}${meta}</div>${reacts}</div></div>`));
      });
      list.replaceChildren(frag); if (findQ) findMark();
      if (firstOpen && visible) {
        const mk = list.querySelector('#lfcUnreadMark');
        if (mk) list.scrollTop = mk.offsetTop - 8; else toBottom();
        if (msgs.length) { firstOpen = false; myRead = 0; }
      } else if (keep || (fresh && ownNew)) { toBottom(); stick = true; } else list.scrollTop = top; // 在最底下或自己發的才捲到最新；往上看時不拉走
      list.append(down); downUpd();
    }
    function downUpd() {
      // 只在下面還有「沒看過」的訊息時出現；捲到看過的就不算，已讀的不會再出現
      const edge = list.scrollTop + list.clientHeight; let k = 0;
      list.querySelectorAll('.lfc-row').forEach(r => { const t = +r.dataset.ts; if (r.offsetTop + r.offsetHeight <= edge) { if (t > seenTs) seenTs = t; } });
      list.querySelectorAll('.lfc-row:not(.me)').forEach(r => { if (r.offsetTop + r.offsetHeight > edge && +r.dataset.ts > seenTs) k++; });
      downBtn.hidden = !k; const b = downBtn.querySelector('b'); b.hidden = !k; b.textContent = k > 99 ? '99+' : k;
    }
    list.addEventListener('scroll', () => requestAnimationFrame(downUpd), { passive: true });

    // ---------- 傳送 ----------
    async function send(data) {
      if (!me) return false;
      const d = Object.assign({ uid: me.uid, ts: FV.serverTimestamp() }, data);
      if (reply) { d.replyTo = reply; setReply(null); }
      try { await db.collection('lf_chat_messages').add(d); setTimeout(toBottom, 50); return true; }
      catch (e) { toast('傳送失敗：' + ((e && e.code) || e)); console.warn(e); return false; }
    }
    function sendText() {
      const text = input.value.trim(); if (!text) return;
      const mentions = Object.keys(members).filter(uid => text.includes('@' + members[uid].name));
      input.value = ''; grow(); $('lfcSugg').hidden = true;
      send(mentions.length ? { text, mentions } : { text }).then(ok => { if (ok && /@pinky/i.test(text)) askPinky(text); });
    }
    // ---------- @Pinky AI 小幫手（只在聊天室裡回覆文字） ----------
    let pinkyBusy = false;
    async function askPinky(text) {
      if (pinkyBusy) return toast('Pinky 還在想上一題，請稍等');
      pinkyBusy = true; toast('Pinky 思考中…');
      try {
        const history = msgs.filter(m => !m.unsent && m.text).slice(-20).map(m => ({ name: m.bot === 'pinky' ? 'Pinky' : prof(m.uid).name, text: m.text }));
        const url = (/^\/lf(\/|$)/.test(location.pathname) ? '/lf' : '') + '/api/pinky';
        const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ idToken: await me.getIdToken(), name: prof(me.uid).name, prompt: text, history }) });
        const d = await res.json().catch(() => ({}));
        if (!d.ok) throw new Error(d.error || ('HTTP ' + res.status));
        await db.collection('lf_chat_messages').add({ uid: me.uid, bot: 'pinky', ts: FV.serverTimestamp(), text: d.text });
        clearTimeout(noticeTimer); notice.textContent = '';
      } catch (e) { toast('Pinky 暫時沒辦法回答：' + String(e.message || e).slice(0, 80)); console.warn(e); }
      finally { pinkyBusy = false; }
    }
    async function sendFiles(files) {
      for (const f of Array.from(files || []).slice(0, 10)) {
        const img = await shrink(f).catch(() => '');
        if (img) await send({ img }); else toast('這張照片無法讀取');
      }
    }
    // 拖放照片到留言板、在輸入框貼上截圖：直接傳送
    box.addEventListener('dragover', e => { if (Array.from(e.dataTransfer.types || []).includes('Files')) { e.preventDefault(); box.classList.add('lfc-drop'); } });
    box.addEventListener('dragleave', e => { if (!e.relatedTarget || !box.contains(e.relatedTarget)) box.classList.remove('lfc-drop'); });
    box.addEventListener('drop', e => { box.classList.remove('lfc-drop'); const fs = Array.from(e.dataTransfer.files || []).filter(f => /^image\//.test(f.type)); if (!fs.length) return; e.preventDefault(); sendFiles(fs); });
    input.addEventListener('paste', e => { const fs = Array.from((e.clipboardData && e.clipboardData.items) || []).filter(i => i.kind === 'file' && /^image\//.test(i.type)).map(i => i.getAsFile()); if (fs.length) { e.preventDefault(); sendFiles(fs); } });

    // ---------- 相機（照 LINE 的介面）：直接拍照、前後鏡頭、閃光燈（有支援才顯示）、倒數、可愛相框、拍完預覽 ----------
    // 手機：全螢幕；寬螢幕：像看照片一樣在頁面中間跳出框
    const FRAMES = [['none', '無'], ['polaroid', '拍立得'], ['pinky', 'Pinky'], ['blues', 'Bluezi'], ...AV.map(a => [a[0], a[1]])];
    const imgCache = {};
    const loadImg = src => imgCache[src] || (imgCache[src] = new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; }));
    const svgSrc = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
    function frameArt(kind) { // 回傳 [邊框色, 圖片網址們]
      if (kind === 'pinky') return ['#f9a8d4', ['assets/chat-stickers/pinky-1.webp?v=2', 'assets/chat-stickers/pinky-4.webp?v=2']];
      if (kind === 'blues') return ['#93c5fd', ['assets/chat-stickers/blues-new-1.webp?v=2', 'assets/chat-stickers/blues-new-3.webp?v=2']];
      const a = AV.find(x => x[0] === kind); if (!a) return null;
      return [a[2], [svgSrc(face(kind, 'happy', true)), svgSrc(face(kind, 'love', true))]];
    }
    async function drawFrame(g, W, H, kind) {
      const u = Math.min(W, H) / 100;
      if (kind === 'polaroid') {
        g.fillStyle = '#fff'; const b = u * 5; g.fillRect(0, 0, W, b); g.fillRect(0, 0, b, H); g.fillRect(W - b, 0, b, H); g.fillRect(0, H - u * 18, W, u * 18);
        // 手寫字：右下角兩行「2026.11.24」「love you」，從左往右微微上揚
        const d = new Date(), ds = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
        g.save(); g.translate(W - u * 8, H - u * 9); g.rotate(-0.07);
        g.fillStyle = '#6b7280'; g.textAlign = 'right'; g.textBaseline = 'middle';
        g.font = `${u * 5.6}px "Segoe Script", "Snell Roundhand", "Bradley Hand", "Dancing Script", cursive`;
        g.fillText(ds, 0, -u * 3.6); g.fillStyle = '#ec4899'; g.fillText('love you ♡', 0, u * 3.8); g.restore(); return;
      }
      const art = frameArt(kind); if (!art) return;
      const [col, srcs] = art, ims = await Promise.all(srcs.map(loadImg));
      g.save(); g.lineWidth = u * 3.2; g.strokeStyle = col; g.globalAlpha = .9;
      const r = u * 6, x = u * 2, y = u * 2, w = W - u * 4, hh = H - u * 4;
      g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.stroke();
      g.globalAlpha = 1; g.fillStyle = col; // 邊框上的小圓點
      for (let i = 1; i < 8; i++) { g.beginPath(); g.arc(x + w * i / 8, y, u * 1.3, 0, 7); g.arc(x + w * i / 8, y + hh, u * 1.3, 0, 7); g.fill(); }
      const S = u * 30; // 角落的角色：右上小、左下大
      if (ims[1]) g.drawImage(ims[1], W - S * .8 - u, u, S * .8, S * .8);
      if (ims[0]) g.drawImage(ims[0], u, H - S - u, S, S);
      g.restore();
    }
    // ---------- 照片編輯（拍完、預設相機、單張傳照片都會進來）：相框、裁切旋轉、貼圖、文字、畫畫 ----------
    // 版面照 Samsung：左上 ‹ 回上一步、左下 ⬇ 存到手機、右下傳送；右側功能鍵；底部相框列
    async function photoEditor(file, o = {}) {
      if (closeOverlay) closeOverlay(false);
      const wide = wideQ.matches;
      const srcUrl = URL.createObjectURL(file), base = await loadImg(srcUrl); URL.revokeObjectURL(srcUrl); delete imgCache[srcUrl];
      if (!base) { if (o.onBack) { toast('照片讀取失敗'); return o.onBack(); } return sendFiles([file]); } // 編輯器讀不了的格式（例如 HEIC）就直接傳
      let rot = 0, flip = false, flBefore = false, rc = null, crop = { x: 0, y: 0, w: 1, h: 1 }, fr = o.frame || 'none', strokes = [], layers = [], sel = null, mode = 'main';
      const I = (d, w = 24) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
      const COLORS = ['#ffffff', '#111827', '#f472b6', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'];
      const v = h(`<div class="lfc-cam lfc-ed${wide ? ' wide' : ''}"><div class="lfc-cam-box">
        <div class="lfc-ed-stage"><div class="lfc-ed-art"><canvas class="lfc-ed-cv"></canvas><div class="lfc-ed-layers"></div><canvas class="lfc-ed-pen" hidden></canvas></div>
          <div class="lfc-ed-crop" hidden><canvas></canvas><div class="lfc-ed-cbox"><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i></div></div></div>
        <button class="lfc-cam-x lfc-ed-back" data-a="back" aria-label="回上一步">${I('<path d="M15 5l-7 7 7 7"/>', 28)}</button>
        <div class="lfc-ed-tools" data-m="main">
          <button data-a="crop"><span>裁切與旋轉</span>${I('<path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/>')}</button>
          <button data-a="stk"><span>貼圖</span>${I('<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>')}</button>
          <button data-a="txt"><span>文字</span>${I('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>')}</button>
          <button data-a="draw"><span>畫畫</span>${I('<path d="M4 20l4-1L19 8a2.1 2.1 0 0 0-3-3L5 16z"/>')}</button>
        </div>
        <div class="lfc-ed-bottom" data-m="main">
          <div class="lfc-cam-frs lfc-ed-frs">${FRAMES.map(f => `<button data-fr="${f[0]}" class="${f[0] === fr ? 'on' : ''}"><span class="lfc-cam-th" data-th="${f[0]}">${f[0] === 'none' ? '🚫' : f[0] === 'polaroid' ? '<i class="lfc-cam-pol"></i>' : ''}</span>${f[1]}</button>`).join('')}</div>
          <div class="lfc-ed-bar"><button class="lfc-ed-dl" data-a="dl" aria-label="存到手機">${I('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', 30)}</button>
            <button class="lfc-ed-send" data-a="send" aria-label="傳送"><svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M3 20.5 21 12 3 3.5l2.6 7.2L14 12l-8.4 1.3z" fill="currentColor"/></svg></button></div>
        </div>
        <div class="lfc-ed-top" data-m="crop" hidden><button data-a="cancel">取消</button><button data-a="done">完成</button></div>
        <div class="lfc-ed-sub lfc-ed-cropbar" data-m="crop" hidden>
          <div class="lfc-ed-chips"><button data-r="0" class="on">自由</button><button data-r="1">1:1</button><button data-r="1.3333">4:3</button><button data-r="0.75">3:4</button></div>
          <div class="lfc-ed-chips"><button data-a="rot" aria-label="旋轉">${I('<path d="M20 12a8 8 0 1 1-2.3-5.7L20 8.6M20 4v4.6h-4.6"/>', 20)} 旋轉</button><button data-a="flip" aria-label="左右翻轉">${I('<path d="M12 3v18M9 7 4 17h5zM15 7l5 10h-5z"/>', 20)} 翻轉</button></div></div>
        <div class="lfc-ed-sub" data-m="draw" hidden>
          <div class="lfc-ed-chips">${COLORS.map((c, i) => `<button class="lfc-ed-col${i === 2 ? ' on' : ''}" data-c="${c}" style="background:${c}"></button>`).join('')}</div>
          <div class="lfc-ed-chips"><button data-w="0.006">細</button><button data-w="0.012" class="on">中</button><button data-w="0.024">粗</button><button data-a="undo">↶ 上一步</button></div>
          <div class="lfc-ed-ok"><button data-a="done" class="go">完成</button></div></div>
        <div class="lfc-ed-sub" data-m="txt" hidden>
          <input class="lfc-ed-tin" maxlength="60" placeholder="輸入文字" enterkeyhint="done">
          <div class="lfc-ed-chips">${COLORS.map((c, i) => `<button class="lfc-ed-col${i === 0 ? ' on' : ''}" data-tc="${c}" style="background:${c}"></button>`).join('')}</div>
          <div class="lfc-ed-chips"><button data-f="n" class="on">一般</button><button data-f="h" class="hand">手寫</button></div>
          <div class="lfc-ed-ok"><button data-a="cancel">取消</button><button data-a="tok" class="go">完成</button></div></div>
        <div class="lfc-ed-sheet" data-m="stk" hidden><div class="lfc-ed-sgrid"></div><div class="lfc-ed-ok"><button data-a="cancel">關閉</button></div></div>
      </div></div>`);
      document.body.append(v);
      v.querySelectorAll('[data-th]').forEach(t => { const a = frameArt(t.dataset.th); if (a) { t.style.background = a[0]; t.innerHTML = `<img src="${a[1][0]}" alt="">`; } });
      const q = s => v.querySelector(s), stage = q('.lfc-ed-stage'), art = q('.lfc-ed-art'), cv = q('.lfc-ed-cv'), pen = q('.lfc-ed-pen'), lay = q('.lfc-ed-layers');
      const HAND = '"Segoe Script", "Snell Roundhand", "Bradley Hand", "Dancing Script", cursive', NORM = '"CLC Arial", Arial, "Microsoft JhengHei", sans-serif';
      function rotated() { // 旋轉後的整張照片
        if (rc && rc._rot === rot && rc._fl === flip) return rc;
        const sw = base.naturalWidth, sh = base.naturalHeight, side = rot % 180 !== 0, k = Math.min(1, 3000 / Math.max(sw, sh));
        const c = document.createElement('canvas'); c.width = Math.round((side ? sh : sw) * k); c.height = Math.round((side ? sw : sh) * k);
        const g = c.getContext('2d'); g.translate(c.width / 2, c.height / 2); if (flip) g.scale(-1, 1); g.rotate(rot * Math.PI / 180); g.drawImage(base, -sw * k / 2, -sh * k / 2, sw * k, sh * k);
        c._rot = rot; c._fl = flip; return (rc = c);
      }
      const outSize = () => { const r = rotated(); return [r.width * crop.w, r.height * crop.h]; };
      let dispW = 1, dispH = 1;
      async function render() { // 編輯畫面：照片＋畫線＋相框（貼圖、文字是上面的 DOM 物件）
        const bh = mode === 'main' ? q('.lfc-ed-bottom').offsetHeight : 0; stage.style.paddingBottom = bh + 'px'; // 照片放在相框列上面，相框才看得完整
        const S0 = stage.getBoundingClientRect(), S = { width: S0.width, height: S0.height - bh }, [ow, oh] = outSize(), sc = Math.min(S.width / ow, S.height / oh);
        dispW = ow * sc; dispH = oh * sc; Object.assign(art.style, { width: dispW + 'px', height: dispH + 'px' });
        const dpr = devicePixelRatio; cv.width = Math.round(dispW * dpr); cv.height = Math.round(dispH * dpr);
        await paintTo(cv.getContext('2d'), cv.width, cv.height, false); placeLayers();
      }
      async function paintTo(g, W, H, withLayers) {
        const r = rotated(); g.clearRect(0, 0, W, H);
        g.drawImage(r, crop.x * r.width, crop.y * r.height, crop.w * r.width, crop.h * r.height, 0, 0, W, H);
        const m = Math.min(W, H); g.lineCap = g.lineJoin = 'round';
        strokes.forEach(s => { g.strokeStyle = s.c; g.lineWidth = s.w * m; g.beginPath(); s.p.forEach(([x, y], i) => i ? g.lineTo(x * W, y * H) : g.moveTo(x * W, y * H)); if (s.p.length === 1) g.lineTo(s.p[0][0] * W + .1, s.p[0][1] * H); g.stroke(); });
        await drawFrame(g, W, H, fr);
        if (!withLayers) return;
        for (const L of layers) {
          g.save(); g.translate(L.x * W, L.y * H); g.rotate(L.r); const sz = L.s * m;
          if (L.t === 'stk') { const im = await loadImg(L.src); if (im) g.drawImage(im, -sz / 2, -sz / 2, sz, sz); }
          else { g.font = `${L.f === 'h' ? '' : '700 '}${sz * .4}px ${L.f === 'h' ? HAND : NORM}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
            g.lineWidth = sz * .06; g.strokeStyle = L.c === '#111827' ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.45)'; g.strokeText(L.text, 0, 0); g.fillStyle = L.c; g.fillText(L.text, 0, 0); }
          g.restore();
        }
      }
      // ---- 貼圖、文字物件：拖曳、雙指縮放旋轉；選取時有 ✕ 刪除、↻ 縮放旋轉把手 ----
      function placeLayers() {
        lay.replaceChildren(...layers.map(L => {
          const m = Math.min(dispW, dispH), sz = L.s * m, el = h(`<div class="lfc-ed-obj${L === sel ? ' sel' : ''}"></div>`);
          if (L.t === 'stk') el.innerHTML = `<img src="${esc(L.src)}" alt="" draggable="false">`;
          else { el.textContent = L.text; Object.assign(el.style, { color: L.c, fontFamily: L.f === 'h' ? HAND : NORM, fontWeight: L.f === 'h' ? '400' : '700', fontSize: sz * .4 + 'px', textShadow: L.c === '#111827' ? '0 0 3px #fff' : '0 1px 3px rgba(0,0,0,.5)' }); el.classList.add('txt'); }
          Object.assign(el.style, { left: L.x * dispW + 'px', top: L.y * dispH + 'px', transform: `translate(-50%,-50%) rotate(${L.r}rad)` });
          if (L.t === 'stk') Object.assign(el.style, { width: sz + 'px', height: sz + 'px' });
          if (L === sel) el.append(h('<button class="lfc-ed-del" data-a="del" aria-label="刪除">✕</button>'), h('<span class="lfc-ed-rs" aria-hidden="true">↻</span>'));
          el._L = L; return el;
        }));
      }
      const ptrs = new Map(); let gest = null;
      lay.addEventListener('pointerdown', e => {
        if (e.target.closest('.lfc-ed-del')) return;
        const el = e.target.closest('.lfc-ed-obj'); if (!el) { if (sel) { sel = null; placeLayers(); } return; }
        e.preventDefault(); const L = el._L, wasSel = sel === L; if (sel !== L) { sel = L; layers.push(layers.splice(layers.indexOf(L), 1)[0]); placeLayers(); }
        lay.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
        const A = art.getBoundingClientRect(), cx = A.left + L.x * dispW, cy = A.top + L.y * dispH;
        const rs = e.target.closest('.lfc-ed-rs');
        gest = { L, x: L.x, y: L.y, s: L.s, r: L.r, cx, cy, rs: !!rs, p0: [e.clientX, e.clientY], d0: Math.hypot(e.clientX - cx, e.clientY - cy), a0: Math.atan2(e.clientY - cy, e.clientX - cx), moved: false, wasSel };
        if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; Object.assign(gest, { two: true, x: L.x, y: L.y, s: L.s, r: L.r, d0: Math.hypot(a[0] - b[0], a[1] - b[1]), a0: Math.atan2(b[1] - a[1], b[0] - a[0]) }); }
      });
      lay.addEventListener('pointermove', e => {
        if (!gest || !ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]); const L = gest.L; gest.moved = true;
        if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; L.s = Math.max(.06, Math.min(2, gest.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / gest.d0)); L.r = gest.r + Math.atan2(b[1] - a[1], b[0] - a[0]) - gest.a0; }
        else if (gest.rs) { L.s = Math.max(.06, Math.min(2, gest.s * Math.hypot(e.clientX - gest.cx, e.clientY - gest.cy) / gest.d0)); L.r = gest.r + Math.atan2(e.clientY - gest.cy, e.clientX - gest.cx) - gest.a0; }
        else if (!gest.two) { L.x = Math.min(1, Math.max(0, gest.x + (e.clientX - gest.p0[0]) / dispW)); L.y = Math.min(1, Math.max(0, gest.y + (e.clientY - gest.p0[1]) / dispH)); }
        placeLayers();
      });
      const endPtr = e => { ptrs.delete(e.pointerId); if (!ptrs.size) { if (gest && !gest.moved && gest.L.t === 'txt' && gest.wasSel) editText(gest.L); gest = null; } };
      lay.addEventListener('pointerup', endPtr); lay.addEventListener('pointercancel', endPtr);
      lay.addEventListener('dblclick', e => { const el = e.target.closest('.lfc-ed-obj.txt'); if (el) editText(el._L); });
      lay.addEventListener('wheel', e => { if (!sel) return; e.preventDefault(); sel.s = Math.max(.06, Math.min(2, sel.s * (e.deltaY < 0 ? 1.08 : .93))); placeLayers(); }, { passive: false });
      // ---- 畫畫 ----
      let penC = '#f472b6', penW = .012, cur = null;
      pen.addEventListener('pointerdown', e => { pen.setPointerCapture(e.pointerId); const A = art.getBoundingClientRect(); cur = { c: penC, w: penW, p: [[(e.clientX - A.left) / dispW, (e.clientY - A.top) / dispH]] }; strokes.push(cur); render(); });
      pen.addEventListener('pointermove', e => { if (!cur) return; const A = art.getBoundingClientRect(); cur.p.push([(e.clientX - A.left) / dispW, (e.clientY - A.top) / dispH]); drawLive(); });
      pen.addEventListener('pointerup', () => { cur = null; render(); });
      let raf = 0; function drawLive() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; render(); }); }
      // ---- 裁切與旋轉 ----
      const cropEl = q('.lfc-ed-crop'), ccv = cropEl.querySelector('canvas'), cbox = q('.lfc-ed-cbox');
      let ck = null, ratio = 0, cBox = null; // cBox：在 crop canvas 上的框（像素）
      function cropShow() {
        const r = rotated(), S = stage.getBoundingClientRect(), pad = 24;
        const top = q('.lfc-ed-top').getBoundingClientRect().bottom - S.top + 8, bot = S.bottom - q('.lfc-ed-cropbar').getBoundingClientRect().top + 16; // 上：取消／完成，下：選項列
        const avH = Math.max(80, S.height - top - bot), sc = Math.min((S.width - pad * 2) / r.width, avH / r.height);
        ccv.width = r.width * sc; ccv.height = r.height * sc; ccv.getContext('2d').drawImage(r, 0, 0, ccv.width, ccv.height);
        Object.assign(ccv.style, { left: (S.width - ccv.width) / 2 + 'px', top: top + (avH - ccv.height) / 2 + 'px' }); cropDraw();
      }
      function cropDraw() {
        const L = parseFloat(ccv.style.left), T = parseFloat(ccv.style.top);
        Object.assign(cbox.style, { left: L + ck.x * ccv.width + 'px', top: T + ck.y * ccv.height + 'px', width: ck.w * ccv.width + 'px', height: ck.h * ccv.height + 'px' });
      }
      function applyRatio() {
        if (!ratio) return; const W = ccv.width, H = ccv.height; let w = ck.w * W, hh = ck.h * H;
        if (w / hh > ratio) w = hh * ratio; else hh = w / ratio;
        if (w > W) { w = W; hh = w / ratio; } if (hh > H) { hh = H; w = hh * ratio; }
        const cx = (ck.x + ck.w / 2) * W, cy = (ck.y + ck.h / 2) * H;
        ck = { x: Math.max(0, Math.min(W - w, cx - w / 2)) / W, y: Math.max(0, Math.min(H - hh, cy - hh / 2)) / H, w: w / W, h: hh / H };
      }
      let cg = null;
      cropEl.addEventListener('pointerdown', e => { if (!e.target.closest('.lfc-ed-cbox')) return; e.preventDefault(); cropEl.setPointerCapture(e.pointerId); cg = { h: e.target.dataset.h || 'mv', p: [e.clientX, e.clientY], k: { ...ck } }; });
      cropEl.addEventListener('pointermove', e => {
        if (!cg) return; const W = ccv.width, H = ccv.height, dx = (e.clientX - cg.p[0]) / W, dy = (e.clientY - cg.p[1]) / H, k = cg.k, MIN = .08;
        let { x, y, w, h: hh } = k;
        if (cg.h === 'mv') { x = Math.max(0, Math.min(1 - w, x + dx)); y = Math.max(0, Math.min(1 - hh, y + dy)); }
        else {
          let x2 = x + w, y2 = y + hh;
          if (cg.h.includes('w')) x = Math.max(0, Math.min(x2 - MIN, x + dx)); else x2 = Math.min(1, Math.max(x + MIN, x2 + dx));
          if (cg.h.includes('n')) y = Math.max(0, Math.min(y2 - MIN, y + dy)); else y2 = Math.min(1, Math.max(y + MIN, y2 + dy));
          w = x2 - x; hh = y2 - y;
          if (ratio) { const want = ratio * H / W; if (w / hh > want) { const nw = hh * want; if (cg.h.includes('w')) x += w - nw; w = nw; } else { const nh = w / want; if (cg.h.includes('n')) y += hh - nh; hh = nh; } }
        }
        ck = { x, y, w, h: hh }; cropDraw();
      });
      cropEl.addEventListener('pointerup', () => { cg = null; });
      // ---- 模式切換 ----
      function setMode(m) {
        mode = m; v.querySelectorAll('[data-m]').forEach(x => { x.hidden = x.dataset.m !== m; });
        v.classList.toggle('sub', m !== 'main'); pen.hidden = m !== 'draw'; art.hidden = m === 'crop'; cropEl.hidden = m !== 'crop'; q('.lfc-ed-back').hidden = m !== 'main';
        if (m === 'crop') { ck = { ...crop }; rcBefore = rot; flBefore = flip; cropShow(); }
        if (m !== 'main') { sel = null; placeLayers(); }
      }
      let rcBefore = 0, editing = null;
      function editText(L) {
        editing = L || null; const tin = q('.lfc-ed-tin'); tin.value = L ? L.text : '';
        const c = L ? L.c : '#ffffff', f = L ? L.f : 'n';
        v.querySelectorAll('[data-tc]').forEach(b => b.classList.toggle('on', b.dataset.tc === c)); v.querySelectorAll('[data-f]').forEach(b => b.classList.toggle('on', b.dataset.f === f));
        setMode('txt'); setTimeout(() => tin.focus(), 50);
      }
      function textOk() {
        const t = q('.lfc-ed-tin').value.trim(), c = (q('[data-tc].on') || {}).dataset?.tc || '#ffffff', f = (q('[data-f].on') || {}).dataset?.f || 'n';
        if (editing) { if (t) Object.assign(editing, { text: t, c, f }); else layers.splice(layers.indexOf(editing), 1); }
        else if (t) { const L = { t: 'txt', text: t, c, f, x: .5, y: .5, s: .25, r: 0 }; layers.push(L); sel = L; }
        editing = null; setMode('main'); placeLayers();
      }
      q('.lfc-ed-tin').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); textOk(); } });
      function stickerSheet() {
        const g = q('.lfc-ed-sgrid'); if (!g.firstChild) {
          const items = [...STICKER_PACKS.Pinky, ...STICKER_PACKS.Bluezi].map(id => `assets/chat-stickers/${id}.webp?v=2`)
            .concat(AV.flatMap(([k]) => MOODS.map(m => svgSrc(face(k, m, true)))));
          g.innerHTML = items.map(s => `<button data-s="${esc(s)}"><img src="${esc(s)}" alt="" loading="lazy"></button>`).join('') + EMOS.map(e => `<button data-emo="${e}" class="emo">${e}</button>`).join('');
        }
        setMode('stk');
      }
      async function exportBlob() {
        const [ow, oh] = outSize(), k = Math.min(1, 2000 / Math.max(ow, oh)), c = document.createElement('canvas'); c.width = Math.round(ow * k); c.height = Math.round(oh * k);
        await paintTo(c.getContext('2d'), c.width, c.height, true); return new Promise(ok => c.toBlob(ok, 'image/jpeg', .92));
      }
      const close = () => { v.remove(); removeEventListener('resize', onRs); };
      const onRs = () => (mode === 'crop' ? cropShow() : render()); addEventListener('resize', onRs);
      if (wide) v.addEventListener('click', e => { if (e.target === v) { close(); o.onClose && o.onClose(); } });
      v.addEventListener('click', async e => {
        const b = e.target.closest('button'); if (!b || !v.contains(b)) return; const a = b.dataset.a;
        if (b.dataset.fr) { fr = b.dataset.fr; v.querySelectorAll('[data-fr]').forEach(x => x.classList.toggle('on', x === b)); return render(); }
        if (b.dataset.s) { const L = { t: 'stk', src: b.dataset.s, x: .5, y: .5, s: .32, r: 0 }; layers.push(L); sel = L; setMode('main'); return placeLayers(); }
        if (b.dataset.emo) { const L = { t: 'txt', text: b.dataset.emo, c: '#ffffff', f: 'n', x: .5, y: .5, s: .45, r: 0 }; layers.push(L); sel = L; setMode('main'); return placeLayers(); }
        if (b.dataset.c) { penC = b.dataset.c; v.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b)); return; }
        if (b.dataset.w) { penW = +b.dataset.w; v.querySelectorAll('[data-w]').forEach(x => x.classList.toggle('on', x === b)); return; }
        if (b.dataset.tc) { v.querySelectorAll('[data-tc]').forEach(x => x.classList.toggle('on', x === b)); return; }
        if (b.dataset.f) { v.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === b)); return; }
        if (b.dataset.r !== undefined) { ratio = +b.dataset.r; v.querySelectorAll('[data-r]').forEach(x => x.classList.toggle('on', x === b)); applyRatio(); return cropDraw(); }
        if (a === 'del') { layers.splice(layers.indexOf(sel), 1); sel = null; return placeLayers(); }
        if (a === 'crop') return setMode('crop');
        if (a === 'stk') return stickerSheet();
        if (a === 'txt') return editText(null);
        if (a === 'draw') return setMode('draw');
        if (a === 'undo') { strokes.pop(); return render(); }
        if (a === 'rot') { rot = (rot + 90) % 360; ck = { x: 0, y: 0, w: 1, h: 1 }; applyRatio(); return cropShow(); }
        if (a === 'flip') { flip = !flip; ck = { x: 1 - ck.x - ck.w, y: ck.y, w: ck.w, h: ck.h }; return cropShow(); }
        if (a === 'tok') return textOk();
        if (a === 'cancel') { if (mode === 'crop') { rot = rcBefore; flip = flBefore; } editing = null; setMode('main'); return render(); }
        if (a === 'done') { if (mode === 'crop') { if (rot !== rcBefore || flip !== flBefore) { strokes = []; } crop = { ...ck }; } setMode('main'); return render(); }
        if (a === 'back') { close(); return o.onBack ? o.onBack() : o.onClose && o.onClose(); }
        if (a === 'dl') { const bl = await exportBlob(); if (!bl) return; const u = URL.createObjectURL(bl), l = document.createElement('a'); l.href = u; l.download = 'LinFamily-' + Date.now() + '.jpg'; document.body.append(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); return toast('已存到手機'); }
        if (a === 'send') { b.disabled = true; const bl = await exportBlob(); if (!bl) { b.disabled = false; return; } close(); o.onClose && o.onClose(); return sendFiles([new File([bl], 'photo.jpg', { type: 'image/jpeg' })]); }
      });
      setMode('main'); requestAnimationFrame(render);
    }
    async function camera() {
      if (closeOverlay) closeOverlay(false);
      document.querySelectorAll('dialog.lf-dialog[open]').forEach(d => d.close());
      const wide = wideQ.matches;
      // mode：live＝我們的相機；native＝用手機相機拍完回來加相框
      let facing = matchMedia('(pointer: coarse)').matches ? 'environment' : 'user', stream = null, track = null, caps = {}, fr = 'none', timer = 0, torch = false, shot = null, busy = false;
      let mode = 'live', baseImg = null, z = 1, zMin = 1, zMax = 5, hwZoom = false, flashModes = [], flash = 'auto';
      const TONE = 'saturate(1.25) contrast(1.08) brightness(1.06) sepia(.12)'; // 調色 D：鮮明暖調（偏 iPhone 鮮豔暖色）
      const COARSE = matchMedia('(pointer: coarse)').matches; let swB = 1;
      const mir = () => facing === 'user' || !COARSE; // 像照鏡子：手機自拍、電腦網路攝影機都左右相反顯示，拍出來也一樣
      const toneStr = () => TONE + (swB !== 1 ? ` brightness(${swB.toFixed(2)})` : ''), tone = () => { video.style.filter = toneStr(); };
      const I = (d, w = 24) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
      const v = h(`<div class="lfc-cam${wide ? ' wide' : ''}"><div class="lfc-cam-box">
        <div class="lfc-cam-view"><video playsinline muted autoplay></video><img class="lfc-cam-base" alt="" hidden><canvas class="lfc-cam-fr"></canvas><img class="lfc-cam-shotimg" alt="" hidden><b class="lfc-cam-count" hidden></b><i class="lfc-cam-focus" hidden></i></div>
        <button class="lfc-cam-x" data-a="x" aria-label="關閉">${I('<path d="M6 6l12 12M18 6L6 18"/>', 26)}</button>
        <div class="lfc-cam-side">
          <button data-a="flip" aria-label="切換鏡頭">${I('<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.7M20 4v4.7h-4.7M20 12a8 8 0 0 1-13.7 5.6L4 15.3M4 20v-4.7h4.7"/>')}</button>
          <button data-a="torch" aria-label="閃光燈" hidden>${I('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>')}<small hidden></small></button>
          <button data-a="timer" aria-label="倒數計時">${I('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>')}<small hidden></small></button>
          <button data-a="frames" class="on" aria-label="相框">${I('<circle cx="12" cy="8.5" r="4.5"/><circle cx="8.3" cy="15" r="4.5"/><circle cx="15.7" cy="15" r="4.5"/>')}</button>
        </div>
        <div class="lfc-cam-exp" hidden>☀<input type="range" aria-label="亮度"></div>
        <div class="lfc-cam-panel">
          <div class="lfc-cam-zoom"></div>
          <div class="lfc-cam-frs">${FRAMES.map(f => `<button data-fr="${f[0]}" class="${f[0] === 'none' ? 'on' : ''}"><span class="lfc-cam-th" data-th="${f[0]}">${f[0] === 'none' ? '🚫' : f[0] === 'polaroid' ? '<i class="lfc-cam-pol"></i>' : ''}</span>${f[1]}</button>`).join('')}</div>
          <div class="lfc-cam-bar">${matchMedia('(pointer: coarse)').matches ? `<button class="lfc-cam-native" data-a="native" aria-label="用預設相機拍">${I('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', 22)}<span>預設相機</span></button>` : '<span></span>'}
            <button class="lfc-cam-shot" data-a="shot" aria-label="拍照"></button><span></span></div>
        </div>
        <input type="file" accept="image/*" capture="environment" hidden data-native></div></div>`);
      document.body.append(v);
      v.querySelectorAll('[data-th]').forEach(t => { const a = frameArt(t.dataset.th); if (a) { t.style.background = a[0]; t.innerHTML = `<img src="${a[1][0]}" alt="">`; } });
      const q = s => v.querySelector(s), video = q('video'), cv = q('.lfc-cam-fr'), view = q('.lfc-cam-view'), baseEl = q('.lfc-cam-base');
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      let recognition = null, voiceRetry = 0, voiceUnavailable = false, nativePickerOpen = false;
      const canListen = () => v.isConnected && !document.hidden && !nativePickerOpen &&
        track?.readyState === 'live' && !video.paused && video.videoWidth > 0;
      function stopVoice() {
        clearTimeout(voiceRetry);
        voiceRetry = 0;
        const active = recognition;
        recognition = null;
        if (active) active.abort();
      }
      function startVoice() {
        if (!SpeechRecognition || voiceUnavailable || recognition || voiceRetry || !canListen()) return;
        try {
          const active = new SpeechRecognition();
          recognition = active;
          active.lang = 'en-US';
          active.continuous = true;
          active.onresult = e => {
            if (recognition !== active || !canListen() || busy) return;
            for (let i = e.resultIndex; i < e.results.length; i++) {
              const result = e.results[i];
              if (result.isFinal && /^smile[.!?]*$/i.test(result[0].transcript.trim())) {
                q('[data-a="shot"]').click();
                return;
              }
            }
          };
          active.onerror = e => {
            if (recognition !== active || e.error === 'no-speech') return;
            voiceUnavailable = true;
            stopVoice();
          };
          active.onend = () => {
            if (recognition !== active) return;
            recognition = null;
            if (canListen()) voiceRetry = setTimeout(() => {
              voiceRetry = 0;
              startVoice();
            }, 300);
          };
          active.start();
        } catch (_) {
          recognition = null;
          voiceUnavailable = true;
        }
      }
      function syncVoice() { if (canListen()) startVoice(); else stopVoice(); }
      if (SpeechRecognition) {
        video.addEventListener('playing', startVoice);
        document.addEventListener('visibilitychange', syncVoice);
      }
      const stop = () => { stopVoice(); if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; track = null; };
      const close = () => {
        stop(); v.remove(); removeEventListener('resize', paint);
        document.removeEventListener('visibilitychange', syncVoice);
        if (baseEl.src) URL.revokeObjectURL(baseEl.src);
      };
      const setTrack = c => { if (!track) return Promise.resolve(); return track.applyConstraints({ advanced: [c] }).catch(() => {}); };
      // 畫面上實際看得到的範圍：live 是 cover（裁切填滿），native 是 contain（整張）
      function shown() {
        const R = view.getBoundingClientRect(), live = mode === 'live';
        const sw = live ? video.videoWidth : baseImg.naturalWidth, sh = live ? video.videoHeight : baseImg.naturalHeight; if (!sw) return null;
        const sc = live ? Math.max(R.width / sw, R.height / sh) : Math.min(R.width / sw, R.height / sh);
        const W = Math.min(sw * sc, R.width), H = Math.min(sh * sc, R.height);
        return { R, W, H, x: (R.width - W) / 2, y: (R.height - H) / 2 };
      }
      let pid = 0;
      async function paint() {
        const s = shown(); if (!s) return;
        Object.assign(cv.style, { width: s.W + 'px', height: s.H + 'px', left: s.x + 'px', top: s.y + 'px' });
        const id = ++pid, c2 = document.createElement('canvas'); c2.width = Math.round(s.W * devicePixelRatio); c2.height = Math.round(s.H * devicePixelRatio);
        await drawFrame(c2.getContext('2d'), c2.width, c2.height, fr);
        if (id !== pid) return; cv.width = c2.width; cv.height = c2.height; cv.getContext('2d').drawImage(c2, 0, 0);
      }
      // ---- 縮放：鏡頭有變焦就用鏡頭（畫質好），沒有就裁切放大 ----
      function zoomUI() { // 倍率拉桿 1～5 倍
        const box = q('.lfc-cam-zoom'); box.hidden = mode !== 'live' || !!shot;
        if (!box.firstChild) { box.innerHTML = '<span></span><input type="range" min="1" max="5" step="0.05" aria-label="倍率"><b></b>'; box.querySelector('input').oninput = e => setZoom(+e.target.value); }
        const lo = zLo(), hi = Math.min(5, zMax); const rg = box.querySelector('input'); rg.min = lo; rg.max = hi; rg.value = z; box.querySelector('span').textContent = (Math.round(lo * 10) / 10) + '×'; box.querySelector('b').textContent = (Math.round(z * 10) / 10) + '×';
      }
      const zLo = () => hwZoom ? Math.max(.5, zMin) : 1;
      function setZoom(nz) {
        z = Math.min(Math.min(5, zMax), Math.max(zLo(), nz));
        if (hwZoom) setTrack({ zoom: z }); else video.style.transform = `${mir() ? 'scaleX(-1) ' : ''}scale(${z})`;
        zoomUI();
      }
      let pinch = null;
      view.addEventListener('touchstart', e => { if (e.touches.length === 2 && mode === 'live' && !shot) pinch = { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), z }; }, { passive: true });
      view.addEventListener('touchmove', e => { if (pinch && e.touches.length === 2) { e.preventDefault(); const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); setZoom(pinch.z * d / pinch.d); } }, { passive: false });
      view.addEventListener('touchend', e => { if (e.touches.length < 2) setTimeout(() => { pinch = null; }, 50); });
      view.addEventListener('wheel', e => { if (mode === 'live' && !shot) { e.preventDefault(); setZoom(z * (e.deltaY < 0 ? 1.1 : 0.9)); } }, { passive: false });
      // ---- 點一下對焦（有支援才真的對焦；都會顯示對焦框） ----
      view.addEventListener('click', e => {
        if (mode !== 'live' || shot || pinch) return;
        const R = view.getBoundingClientRect(), f = q('.lfc-cam-focus');
        f.style.left = (e.clientX - R.left) + 'px'; f.style.top = (e.clientY - R.top) + 'px'; f.hidden = false; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
        clearTimeout(f._t); f._t = setTimeout(() => { f.hidden = true; }, 1200);
        let x = (e.clientX - R.left) / R.width, y = (e.clientY - R.top) / R.height; if (mir()) x = 1 - x;
        if (caps.pointsOfInterest || (caps.focusMode || []).includes('single-shot'))
          setTrack({ pointsOfInterest: [{ x, y }], focusMode: (caps.focusMode || []).includes('single-shot') ? 'single-shot' : 'continuous' });
      });
      function flashUI() { // 閃光燈圖示：A＝自動、亮＝開、斜線＝關
        const b = q('[data-a="torch"]'), s = b.querySelector('small'); if (!flashModes.length) return;
        b.classList.toggle('on', flash === 'flash'); b.classList.toggle('off', flash === 'off'); s.hidden = flash !== 'auto'; s.textContent = 'A';
      }
      async function start() {
        stop(); torch = false; q('[data-a="torch"]').classList.remove('on'); mode = 'live'; baseEl.hidden = true; video.hidden = false;
        try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false }); }
        catch (e) { close(); toast(e && e.name === 'NotAllowedError' ? '沒有相機權限，改用相簿選照片' : '打不開相機，改用相簿選照片'); $('lfcFilePic').click(); return; }
        track = stream.getVideoTracks()[0]; caps = track && track.getCapabilities ? track.getCapabilities() : {};
        video.onloadedmetadata = () => { video.play().catch(() => {}); paint(); }; // 先接好再等其他設定，畫面不會卡黑
        video.srcObject = stream; video.classList.toggle('mirror', mir()); video.style.transform = ''; swB = 1; tone();
        q('[data-a="torch"]').hidden = !caps.torch;
        hwZoom = !!(caps.zoom && caps.zoom.max > 1); zMin = hwZoom ? caps.zoom.min : 1; zMax = hwZoom ? Math.min(caps.zoom.max, 10) : 5; z = 1;
        if (hwZoom) setTrack({ zoom: Math.max(zMin, 1) }); zoomUI();
        // 閃光燈：拍照模式支援「自動／開／關」就用它，不然只有手電筒開關
        flashModes = []; try { if (window.ImageCapture && COARSE) { const pc = await Promise.race([new ImageCapture(track).getPhotoCapabilities(), new Promise((_, no) => setTimeout(no, 1500))]); flashModes = (pc.fillLightMode || []).filter(m => ['auto', 'flash', 'off'].includes(m)); } } catch (_) {}
        const fb = q('[data-a="torch"]'); fb.hidden = !(flashModes.length > 1 || caps.torch); if (flashModes.length > 1 && !flashModes.includes(flash)) flash = 'off'; flashUI();
        const ex = q('.lfc-cam-exp'), ec = caps.exposureCompensation, em = ec ? Math.min(-ec.min, ec.max) : 0, rg = ex.querySelector('input'); ex.hidden = false;
        Object.assign(rg, { min: -1, max: 1, step: .05 }); rg.value = 0; // 每次回來都在中間
        if (em > 0) setTrack({ exposureCompensation: 0 });
        rg.oninput = () => { const x = +rg.value; if (em > 0) setTrack({ exposureMode: 'continuous', exposureCompensation: x * em }); else { swB = 1 + x * .45; tone(); } }; // 相機不能調就用軟體調亮暗
      }
      // 組合成照片：來源照片（裁成畫面看到的範圍）＋相框
      async function compose(src, sw, sh, crop, mirror) {
        let cw = sw, ch = sh;
        if (crop) { const R = view.getBoundingClientRect(), a = R.width / R.height; if (sw / sh > a) cw = sh * a; else ch = sw / a; if (!hwZoom) { cw /= z; ch /= z; } }
        const k = Math.min(1, 2000 / Math.max(cw, ch)), c = document.createElement('canvas'); c.width = Math.round(cw * k); c.height = Math.round(ch * k);
        const g = c.getContext('2d'); if (mirror) { g.translate(c.width, 0); g.scale(-1, 1); }
        if (crop) g.filter = toneStr();
        g.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, c.width, c.height); g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none';
        return new Promise(ok => c.toBlob(ok, 'image/jpeg', .92));
      }
      async function capture() {
        let bl = null;
        try { // 高畫質：用相機的拍照模式（Android Chrome），套用手機的降噪、HDR
          if (window.ImageCapture && COARSE && track && facing !== 'user') {
            const ph = await new ImageCapture(track).takePhoto(flashModes.length > 1 ? { fillLightMode: flash } : undefined), bm = await createImageBitmap(ph);
            bl = await compose(bm, bm.width, bm.height, true, false); bm.close && bm.close();
          }
        } catch (_) { bl = null; }
        if (!bl) { if (!video.videoWidth) return; bl = await compose(video, video.videoWidth, video.videoHeight, true, mir()); }
        if (!bl) return; v.classList.add('flash'); setTimeout(() => v.classList.remove('flash'), 300);
        toEditor(bl);
      }
      // 拍完 → 編輯畫面（可再選相框、裁切、貼圖、文字、畫畫）；‹ 回到相機
      function toEditor(file) { stop(); v.style.display = 'none'; photoEditor(file, { frame: fr, onBack: () => { v.style.display = ''; start(); }, onClose: close }); }
      // 用手機相機拍：Samsung 相機的人像、夜拍、變焦都能用，拍完回來一樣進編輯畫面
      const nativeInput = q('[data-native]');
      nativeInput.oncancel = () => { nativePickerOpen = false; startVoice(); };
      nativeInput.onchange = e => {
        nativePickerOpen = false;
        const f = e.target.files[0]; e.target.value = '';
        if (f) toEditor(f); else startVoice();
      };
      addEventListener('resize', paint);
      if (wide) v.addEventListener('click', e => { if (e.target === v) close(); });
      v.addEventListener('click', async e => {
        const b = e.target.closest('button'); if (!b) return;
        const a = b.dataset.a;
        if (b.dataset.fr) { fr = b.dataset.fr; v.querySelectorAll('[data-fr]').forEach(x => x.classList.toggle('on', x === b)); return paint(); }
        if (a === 'x') return close();
        if (a === 'native') {
          nativePickerOpen = true;
          stopVoice();
          return nativeInput.click();
        }
        if (a === 'flip') { facing = facing === 'user' ? 'environment' : 'user'; return start(); }
        if (a === 'frames') { const f = q('.lfc-cam-frs'); f.hidden = !f.hidden; b.classList.toggle('on', !f.hidden); return; }
        if (a === 'timer') { timer = timer === 0 ? 3 : timer === 3 ? 10 : 0; const s = b.querySelector('small'); s.hidden = !timer; s.textContent = timer + 's'; b.classList.toggle('on', !!timer); return; }
        if (a === 'torch') {
          if (!track) return;
          if (flashModes.length > 1) { const order = ['auto', 'flash', 'off'].filter(m => flashModes.includes(m)); flash = order[(order.indexOf(flash) + 1) % order.length]; return flashUI(); }
          torch = !torch; await setTrack({ torch }); b.classList.toggle('on', torch); return;
        }
        if (a === 'shot') {
          if (busy) return; busy = true;
          const cnt = q('.lfc-cam-count');
          for (let n = timer; n > 0; n--) { cnt.hidden = false; cnt.textContent = n; await new Promise(r => setTimeout(r, 1000)); if (!v.isConnected) return; }
          cnt.hidden = true; await capture(); busy = false;
        }
      });
      start();
    }
    function grow() { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; }
    function sendIcon() { const t = !!input.value.trim(), b = $('lfcSend'); if (b.dataset.t === String(t)) return; b.dataset.t = String(t); b.innerHTML = t ? IC.send : IC.mic; b.title = t ? '傳送' : '語音訊息'; b.classList.toggle('on', t); }
    input.addEventListener('input', () => { grow(); suggest(); sendIcon(); });
    input.addEventListener('focus', () => { $('lfcTools').hidden = true; $('lfcMore').hidden = false; });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(pointer:fine)').matches) { e.preventDefault(); sendText(); sendIcon(); } });
    $('lfcSend').onclick = () => { if (!input.value.trim()) return toast('語音訊息之後開放'); sendText(); sendIcon(); input.focus(); };
    $('lfcMore').onclick = () => { $('lfcTools').hidden = false; $('lfcMore').hidden = true; };
    $('lfcCam').onclick = () => (navigator.mediaDevices && navigator.mediaDevices.getUserMedia ? camera() : $('lfcFileCam').click());
    $('lfcPic').onclick = () => $('lfcFilePic').click();
    ['lfcFileCam', 'lfcFilePic'].forEach(id => $(id).onchange = e => { // 單張照片先進編輯畫面；多張直接傳
      const fs = Array.from(e.target.files || []); e.target.value = '';
      if (fs.length === 1 && /^image\/(jpeg|png|webp|gif|heic|heif)?/.test(fs[0].type) && !/gif/.test(fs[0].type)) photoEditor(fs[0]); else sendFiles(fs);
    });
    const stickerBox = $('lfcStks'), stickerToggle = $('lfcStk');
    let stickerTab = '貼圖', stickerPack = '最近使用', recentStickers = [];
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_STICKERS_KEY));
      if (Array.isArray(saved)) recentStickers = saved.filter(id => STICKERS.has(id)).slice(0, 24);
    } catch {}
    function closeStickers() {
      stickerBox.hidden = true;
      stickerToggle.setAttribute('aria-expanded', 'false');
    }
    function renderStickers() {
      const isEmoji = stickerTab === 'Emoji';
      stickerBox.innerHTML = `<div class="lfc-stk-tabs">
        ${['貼圖', 'Emoji'].map(tab => `<button type="button" data-sticker-tab="${tab}" aria-pressed="${tab === stickerTab}">${tab}</button>`).join('')}
        <button type="button" class="lfc-stk-close" aria-label="關閉">×</button>
      </div>
      ${isEmoji ? '' : `<div class="lfc-stk-packs">${['最近使用', ...Object.keys(STICKER_PACKS)].map(pack =>
        `<button type="button" data-sticker-pack="${pack}" aria-pressed="${pack === stickerPack}">${pack}</button>`).join('')}</div>`}
      <div class="lfc-stk-grid${isEmoji ? ' is-emoji' : ''}"></div>`;
      const grid = stickerBox.querySelector('.lfc-stk-grid');
      const ids = stickerPack === '最近使用' ? recentStickers :
        STICKER_PACKS[stickerPack];
      const items = isEmoji ? LEGACY_STICKERS : ids.map(id => ({ id, label: STICKERS.get(id) }));
      if (!items.length) grid.append(h('<p>還沒有最近使用的貼圖，選 Pinky 或 Bluezi 開始。</p>'));
      for (const { id, label } of items) {
        const button = h(`<button type="button" aria-label="${label}" title="${label}">${sticker(id)}</button>`);
        button.onclick = async () => {
          closeStickers();
          if (await send({ stk: id }) && !isEmoji) {
            recentStickers = [id, ...recentStickers.filter(item => item !== id)].slice(0, 24);
            try { localStorage.setItem(RECENT_STICKERS_KEY, JSON.stringify(recentStickers)); } catch {}
            if (!stickerBox.hidden && stickerTab === '貼圖' && stickerPack === '最近使用') renderStickers();
          }
        };
        grid.append(button);
      }
    }
    stickerToggle.setAttribute('aria-controls', 'lfcStks');
    stickerToggle.setAttribute('aria-expanded', 'false');
    stickerToggle.onclick = () => {
      if (!stickerBox.hidden) return closeStickers();
      renderStickers();
      stickerBox.style.bottom = (root.querySelector('.lfc-bar').offsetHeight + 6) + 'px';
      stickerBox.hidden = false;
      stickerToggle.setAttribute('aria-expanded', 'true');
    };
    stickerBox.onclick = e => {
      const button = e.target.closest('button');
      if (!button) return;
      if (button.classList.contains('lfc-stk-close')) {
        closeStickers();
        stickerToggle.focus();
      } else if (button.dataset.stickerTab || button.dataset.stickerPack) {
        const { stickerTab: tab, stickerPack: pack } = button.dataset;
        if (tab) stickerTab = tab;
        if (pack) stickerPack = pack;
        renderStickers();
        stickerBox.querySelector(tab ? '[data-sticker-tab][aria-pressed=true]' :
          '[data-sticker-pack][aria-pressed=true]').focus();
      }
    };
    document.addEventListener('pointerdown', e => {
      if (!stickerBox.hidden && !stickerBox.contains(e.target) && !stickerToggle.contains(e.target)) closeStickers();
    }, true);
    stickerBox.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeStickers();
        stickerToggle.focus();
      }
    });
    // @提及：輸入 @ 跳出成員
    function suggest() {
      const box = $('lfcSugg'), m = input.value.slice(0, input.selectionStart).match(/@([^\s@]*)$/);
      if (!m) { box.hidden = true; return; }
      const q = m[1].toLowerCase(), hits = Object.keys(members).filter(uid => uid !== me.uid && members[uid].name.toLowerCase().includes(q));
      const pk = 'pinky'.includes(q);
      if (!hits.length && !pk) { box.hidden = true; return; }
      const pick = name => { const pos = input.selectionStart, before = input.value.slice(0, pos).replace(/@[^\s@]*$/, '@' + name + ' ');
        input.value = before + input.value.slice(pos); input.focus(); input.selectionStart = input.selectionEnd = before.length; box.hidden = true; };
      const pb = h(`<button><span class="lfc-av">${face('pinky')}</span>Pinky（AI）</button>`); pb.onclick = () => pick('Pinky');
      box.replaceChildren(...(pk ? [pb] : []), ...hits.map(uid => { const b = h(`<button><span class="lfc-av">${face(members[uid].av)}</span>${esc(members[uid].name)}</button>`);
        b.onclick = () => { const pos = input.selectionStart, before = input.value.slice(0, pos).replace(/@[^\s@]*$/, '@' + members[uid].name + ' ');
          input.value = before + input.value.slice(pos); input.focus(); input.selectionStart = input.selectionEnd = before.length; box.hidden = true; }; return b; }));
      box.hidden = false;
    }
    function insertAt(name) { // 點頭像／個人頁的「@ 提及」：在輸入框游標處插入 @名字
      const pos = input.selectionStart ?? input.value.length, pre = input.value.slice(0, pos), add = (pre && !/\s$/.test(pre) ? ' ' : '') + '@' + name + ' ';
      input.value = pre + add + input.value.slice(pos); grow(); sendIcon(); input.focus(); input.selectionStart = input.selectionEnd = pos + add.length;
    }
    function setReply(m) {
      reply = m ? { id: m.id, name: m.bot === 'pinky' ? 'Pinky' : prof(m.uid).name, text: m.text ? m.text.slice(0, 60) : m.img ? '照片' : '貼圖' } : null;
      $('lfcReply').hidden = !reply; if (reply) { $('lfcReplyText').textContent = '回覆 ' + reply.name + '：' + reply.text; input.focus(); }
      fit();
    }
    $('lfcReplyX').onclick = () => setReply(null);

    // ---------- 點擊、長按 ----------
    function go(id) { const r = list.querySelector(`[data-id="${CSS.escape(id)}"]`); if (!r) return toast('這則訊息已經太舊或被收回'); r.scrollIntoView({ block: 'center', behavior: 'smooth' }); r.classList.remove('lfc-flash'); void r.offsetWidth; r.classList.add('lfc-flash'); }
    list.addEventListener('click', e => {
      if (menuOpen) return;
      const nm = e.target.closest('.lfc-name[data-at]'); if (nm) return insertAt(nm.dataset.at); // 點名字直接 @
      const av = e.target.closest('.lfc-av'); if (av) return av.dataset.uid ? profile(av.dataset.uid) : av.dataset.at ? insertAt(av.dataset.at) : undefined;
      const q = e.target.closest('[data-go]'); if (q) return go(q.dataset.go);
      const ph = e.target.closest('.lfc-photo'); if (ph) return viewer(ph.closest('.lfc-row').dataset.id);
      const em = e.target.closest('[data-emo]'); if (em) return react(em.closest('.lfc-row').dataset.id, em.dataset.emo);
    });
    let pressT = null, pressXY = null;
    list.addEventListener('touchstart', e => { const b = e.target.closest('.lfc-bub'); if (!b) return; pressXY = [e.touches[0].clientX, e.touches[0].clientY];
      pressT = setTimeout(() => { pressT = null; actions(b.closest('.lfc-row').dataset.id); }, 480); }, { passive: true });
    list.addEventListener('touchmove', e => { if (pressT && pressXY && Math.hypot(e.touches[0].clientX - pressXY[0], e.touches[0].clientY - pressXY[1]) > 10) { clearTimeout(pressT); pressT = null; } }, { passive: true });
    list.addEventListener('touchend', () => { clearTimeout(pressT); pressT = null; });
    list.addEventListener('contextmenu', e => { const b = e.target.closest('.lfc-bub'); if (!b) return; e.preventDefault(); if (!document.querySelector('.lfc-pop')) actions(b.closest('.lfc-row').dataset.id); });
    $('lfcPin').addEventListener('click', e => { if (e.target.id !== 'lfcUnpin' && pin) go(pin.id); });
    $('lfcUnpin').onclick = () => confirmInChat('取消這則公告？', '取消公告', () => {
      db.collection('lf_chat_meta').doc('pin').set({ id: '' }).catch(() => toast('無法取消公告'));
    });
    // 搜尋聊天內容（用分頁列的放大鏡）：打字時標出符合的訊息；Enter 跳到最新一則，再按 Enter 或 ˄ 往舊的找，˅ 往新的
    let findQ = '', findHits = [], findI = -1;
    function findMark() {
      list.querySelectorAll('.lfc-qhit').forEach(r => r.classList.remove('lfc-qhit'));
      findHits.forEach(id => { const r = list.querySelector(`[data-id="${CSS.escape(id)}"]`); if (r) r.classList.add('lfc-qhit'); });
      $('lfcFindBar').hidden = !findQ;
      $('lfcFindN').textContent = !findQ ? '' : !findHits.length ? '找不到符合的訊息' : findI < 0 ? findHits.length + ' 則符合，按 Enter 跳過去' : (findI + 1) + ' / ' + findHits.length;
    }
    function search(q) {
      findQ = (q || '').toLowerCase(); findI = -1;
      findHits = findQ ? msgs.filter(m => !m.unsent && !hidden.has(m.id) && ((m.text || '').toLowerCase().includes(findQ) || prof(m.uid).name.toLowerCase().includes(findQ))).map(m => m.id).reverse() : [];
      findMark();
    }
    function findStep(d) { if (!findHits.length) return; if (collapsed) setCollapsed(false); findI = Math.max(0, Math.min(findHits.length - 1, findI + d)); go(findHits[findI]); findMark(); }
    $('lfcFindUp').onclick = () => findStep(1);
    $('lfcFindDn').onclick = () => findStep(-1);

    function react(id, emo) {
      const m = msgs.find(x => x.id === id); if (!m) return;
      const cur = (m.reacts || {})[me.uid];
      db.collection('lf_chat_messages').doc(id).update({ ['reacts.' + me.uid]: cur === emo ? FV.delete() : emo }).catch(() => toast('無法加上表情'));
    }

    // ---------- 彈出層 ----------
    function overlay(html) {
      if (closeOverlay) closeOverlay(false);
      document.querySelectorAll('dialog.lf-dialog[open]').forEach(d => d.close()); // 一次只有一個彈窗
      const previousFocus = document.activeElement;
      const ov = h(`<div class="lfc-ov"><div class="lfc-card" role="dialog" aria-modal="true" tabindex="-1">${html}</div></div>`);
      const card = ov.firstElementChild;
      const close = (restoreFocus = true) => {
        if (closeOverlay !== close) return;
        ov.remove();
        closeOverlay = null;
        menuOpen = false;
        if (restoreFocus && box.contains(previousFocus)) previousFocus.focus();
      };
      const q = selector => ov.querySelector(selector);
      let downOut = false; // 按下和放開都在框外才關（選字拖出框外放開不會跳掉）
      ov.addEventListener('pointerdown', e => { downOut = e.target === ov; });
      ov.addEventListener('click', e => { if ((e.target === ov && downOut) || e.target.closest('[data-close]')) close(); downOut = false; });
      ov.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.stopPropagation(); close(); }
        if (e.key !== 'Tab') return;
        const controls = [...card.querySelectorAll('button, input, a[href]')];
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === card)) {
          e.preventDefault(); last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first?.focus();
        }
      });
      box.append(ov);
      menuOpen = true;
      closeOverlay = close;
      card.focus({ preventScroll: true });
      return { ov, close, q };
    }
    function confirmInChat(message, action, onConfirm) {
      const o = overlay(`<p id="lfcConfirmMessage">${esc(message)}</p><div class="lfc-confirm-buttons">
        <button type="button" class="lfc-gbtn" data-close>取消</button>
        <button type="button" class="lfc-pbtn" data-confirm>${esc(action)}</button>
      </div>`);
      o.q('[role=dialog]').setAttribute('aria-labelledby', 'lfcConfirmMessage');
      o.q('[data-close]').focus();
      o.q('[data-confirm]').onclick = () => { o.close(); onConfirm(); };
    }
    const MI = d => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const MENU = {
      reply: ['回覆', MI('<path d="M10 7 5 12l5 5"/><path d="M5 12h9a5 5 0 0 1 5 5v1"/>')],
      copy: ['複製', MI('<rect x="8" y="8" width="11" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h1"/>')],
      share: ['分享', MI('<circle cx="17" cy="5.5" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17" cy="18.5" r="2.5"/><path d="m8.7 10.8 6-3.9M8.7 13.2l6 3.9"/>')],
      note: ['記事本', MI('<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/>')],
      desktop: ['放到 Family 桌面', MI('<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M9 21h6m-3-4v4M12 7v7m-3.5-3.5h7"/>')],
      album: ['相簿', MI('<rect x="4" y="5" width="16" height="14" rx="2"/><path d="m4 16 4.5-4 3.5 3 2.5-2 5.5 4.5"/><path d="M15 9h3M16.5 7.5v3"/>')],
      pin: ['設為公告', MI('<path d="M4 10v4h3l7 4V6l-7 4z"/><path d="M17.5 9.5a3.5 3.5 0 0 1 0 5"/>')],
      unsend: ['收回', MI('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>')],
      del: ['刪除', MI('<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/><path d="M10.5 11v5.5M13.5 11v5.5"/>')]
    };
    async function share(m) {
      try {
        if (m.img) {
          const name = 'LinFamily-' + m.t + '.jpg', blob = await (await fetch(m.img)).blob(), f = new File([blob], name, { type: 'image/jpeg' });
          if (navigator.canShare && navigator.canShare({ files: [f] })) return await navigator.share({ files: [f] });
          const a = document.createElement('a'); a.href = m.img; a.download = name; a.click(); return;
        }
        if (navigator.share) return await navigator.share({ text: m.text });
        await navigator.clipboard.writeText(m.text); toast('已複製，可以貼到其他地方分享');
      } catch (e) { if (e && e.name !== 'AbortError') toast('無法分享'); }
    }
    function actions(id) {
      const m = msgs.find(x => x.id === id), row = list.querySelector(`[data-id="${CSS.escape(id)}"]`); if (!m || m.unsent || !row) return;
      if (navigator.vibrate) navigator.vibrate(15);
      const mine = m.uid === me.uid, canUnsend = mine && Date.now() - m.t < DAY;
      const keys = m.img ? ['reply', 'share', 'note', 'album', 'desktop'] : m.stk ? ['reply', 'note'] : ['reply', 'copy', 'share', 'note', 'pin'];
      if (canUnsend) keys.push('unsend'); keys.push('del');
      const bg = h('<div class="lfc-pop-bg"></div>');
      const pop = h(`<div class="lfc-pop"><div class="lfc-emos">${EMOS.map(e => `<button data-e="${e}">${e}</button>`).join('')}</div>
        <div class="lfc-menu">${keys.map(k => `<button data-a="${k}" class="${k === 'del' || k === 'unsend' ? 'danger' : ''}">${MENU[k][1]}<span>${MENU[k][0]}</span></button>`).join('')}</div></div>`);
      const close = () => { bg.remove(); pop.remove(); menuOpen = false; };
      bg.addEventListener('pointerdown', e => { e.preventDefault(); close(); });
      document.body.append(bg, pop); menuOpen = true;
      // 位置：訊息下方；放不下就放上方；再放不下貼齊畫面上緣。左右對齊訊息（自己的靠右）
      const r = row.querySelector('.lfc-bub').getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
      let top = r.bottom + 6; if (top + ph > innerHeight - 8) top = r.top - ph - 6; if (top < 8) top = Math.max(8, Math.min(innerHeight - ph - 8, r.top));
      let left = mine ? r.right - pw : r.left; left = Math.max(8, Math.min(innerWidth - pw - 8, left));
      pop.style.top = top + 'px'; pop.style.left = left + 'px';
      pop.addEventListener('click', e => {
        const em = e.target.closest('[data-e]'); if (em) { react(id, em.dataset.e); return close(); }
        const a = e.target.closest('[data-a]'); if (!a) return; close();
        const ref = db.collection('lf_chat_messages').doc(id), k = a.dataset.a;
        if (k === 'reply') setReply(m);
        if (k === 'copy') navigator.clipboard.writeText(m.text).then(() => toast('已複製'), () => toast('無法複製'));
        if (k === 'share') share(m);
        if (k === 'desktop') savePinnedPhoto(id, true);
        if (k === 'note' || k === 'album') toast(MENU[k][0] + '之後開放');
        if (k === 'pin') db.collection('lf_chat_meta').doc('pin').set({ id, name: prof(m.uid).name, text: m.text.slice(0, 120) }).then(() => toast('已設為公告'), () => toast('無法設為公告'));
        if (k === 'unsend') confirmInChat('收回這則訊息？所有人都會看不到。', '收回', () => {
          ref.update({ unsent: true, text: FV.delete(), img: FV.delete(), stk: FV.delete(), replyTo: FV.delete(), mentions: FV.delete(), reacts: FV.delete() }).catch(() => toast('無法收回'));
          if (pin && pin.id === id) db.collection('lf_chat_meta').doc('pin').set({ id: '' }).catch(() => toast('無法取消公告'));
        });
        if (k === 'del') confirmInChat('刪除這則訊息？只有你自己看不到，其他人還看得到。', '刪除', () => {
          hidden.add(id);
          try { localStorage.setItem('linfamily_chat_hidden', JSON.stringify([...hidden].slice(-500))); } catch {}
          render();
        });
      });
    }
    function profile(uid) {
      const p = prof(uid), ph = phones[uid] || '';
      const o = overlay(`<div class="lfc-big">${face(p.av)}</div><h3>${esc(p.name)}</h3><p>${ph ? esc(ph) : '尚未設定電話'}</p>
        ${ph ? `<a class="lfc-pbtn" href="tel:${esc(ph.replace(/[^\d+]/g, ''))}">📞 撥打電話</a>` : ''}
        ${isSuper() ? `<div class="lfc-field"><input id="lfcPh" type="tel" enterkeyhint="done" placeholder="手機號碼（只有 Superuser 能改）" value="${esc(ph)}"><button id="lfcPhSave">儲存</button></div>` : ''}
        ${uid !== me.uid ? '<button class="lfc-pbtn" id="lfcAtBtn" style="background:var(--btn);color:var(--text)">＠ 提及</button>' : ''}
        <button class="lfc-gbtn" data-close>關閉</button>`);
      if (uid !== me.uid) o.q('#lfcAtBtn').onclick = () => { o.close(); insertAt(p.name); };
      if (isSuper()) o.q('#lfcPh').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); o.q('#lfcPhSave').click(); } });
      if (isSuper()) o.q('#lfcPhSave').onclick = () => db.collection('lf_chat_phones').doc(uid).set({ phone: o.q('#lfcPh').value.trim() })
        .then(() => { toast('電話已儲存'); o.close(); }, () => toast('無法儲存（請確認 Firestore 規則已發布）'));
    }
    function memberList() {
      const ids = Object.keys(members).sort((a, b) => (a === me.uid ? -1 : b === me.uid ? 1 : members[a].name.localeCompare(members[b].name)));
      const o = overlay(`<h3 style="margin:0 0 8px">成員 (${ids.length})</h3>${ids.map(uid => `<button class="lfc-mem" data-uid="${esc(uid)}"><span class="lfc-av">${face(members[uid].av)}</span>${esc(members[uid].name)}${uid === me.uid ? '（我）' : ''}</button>`).join('')}<button class="lfc-gbtn" data-close>關閉</button>`);
      o.ov.addEventListener('click', e => { const b = e.target.closest('.lfc-mem'); if (b) { o.close(); profile(b.dataset.uid); } });
    }
    function avatarPicker(first) {
      const p = prof(me.uid); let pick = p.av;
      const o = overlay(`${first ? '<p style="margin-bottom:8px">歡迎來到 Lin Family！先選一個頭像吧</p>' : '<h3 style="margin:0 0 12px">帳號設定</h3>'}<div class="lfc-big" id="lfcCur">${face(pick)}</div>
        <div class="lfc-field"><input id="lfcName" maxlength="12" placeholder="顯示名稱" value="${esc(p.name)}"></div>
        <div class="lfc-src">${(() => { const S = window.clcImageSources ? window.clcImageSources() : { camera: true };
          return (S.camera ? '<button data-src="cam">📷 拍照</button>' : '') + '<button data-src="file">🖼️ 上傳圖片</button>'
            + (S.shot ? '<button data-src="shot">🖥️ 螢幕截圖</button>' : '') + (S.paste ? '<button data-src="paste">📋 貼上</button>' : ''); })()}
          <input type="file" accept="image/*" capture="user" hidden data-in="cam"><input type="file" accept="image/*" hidden data-in="file"></div>
        <div class="lfc-avs">${AV.map(a => `<button data-k="${a[0]}" class="${a[0] === pick ? 'on' : ''}"><span>${face(a[0])}</span>${a[1]}</button>`).join('')}</div>
        <button class="lfc-pbtn" id="lfcAvSave">儲存</button><button class="lfc-gbtn" data-close>取消</button>`);
      const crop = async src => { // 共用裁切（js/clc-icon-upload.js）：圓形、可拖曳縮放
        try { const d = await window.clcCropImage(src, { round: true, title: '調整頭像', tip: '拖曳移動、縮放調整<br>圓框內就是頭像' });
          if (d) { pick = d; o.q('#lfcCur').innerHTML = face(pick); o.ov.querySelectorAll('[data-k]').forEach(x => x.classList.remove('on')); } }
        catch (err) { if (!err || err.name !== 'NotAllowedError') toast(err && err.message || '圖片處理失敗'); }
      };
      o.ov.querySelectorAll('[data-in]').forEach(i => i.onchange = () => { if (i.files[0]) crop(i.files[0]); i.value = ''; });
      o.ov.addEventListener('click', e => { const sb = e.target.closest('[data-src]');
        if (sb) { const k = sb.dataset.src; return k === 'cam' || k === 'file' ? o.q(`[data-in="${k}"]`).click() : crop(k); }
        const b = e.target.closest('[data-k]'); if (!b) return; pick = b.dataset.k; o.q('#lfcCur').innerHTML = face(pick); o.ov.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('on', x === b)); });
      o.q('#lfcName').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); o.q('#lfcAvSave').click(); } }); // Enter 儲存（注音選字中不算）
      o.q('#lfcAvSave').onclick = () => {
        const name = o.q('#lfcName').value.trim() || p.name;
        db.collection('lf_chat_profiles').doc(me.uid).set({ name, av: pick, email: me.email.toLowerCase(), at: FV.serverTimestamp() }, { merge: true })
          .then(() => o.close(), () => toast('無法儲存頭像'));
      };
    }
    function viewer(id, pinnedPhoto) {
      const recent = chatPhotos();
      const pics = pinnedPhoto && !recent.some(m => m.id === id) ? [pinnedPhoto] : recent;
      const index = pics.findIndex(m => m.id === id);
      if (index < 0) return;
      let i = index;
      const v = h(`<div class="lfc-view"><div class="lfc-vbox"><img alt="照片"><span class="lfc-vcount"></span>
        <button class="lfc-vbtn" data-v="x" style="top:12px;right:12px" aria-label="關閉">✕</button>
        <a class="lfc-vbtn" data-v="dl" style="bottom:14px;right:14px" title="下載">⬇</a>
        <button class="lfc-vbtn" data-v="p" style="left:10px;top:calc(50% - 21px)">‹</button><button class="lfc-vbtn" data-v="n" style="right:10px;top:calc(50% - 21px)">›</button></div></div>`);
      const show = () => { const m = pics[i]; v.querySelector('img').src = m.img; v.querySelector('[data-v=dl]').href = m.img; v.querySelector('[data-v=dl]').download = 'LinFamily-' + m.t + '.jpg';
        v.querySelector('.lfc-vcount').textContent = (i + 1) + ' / ' + pics.length; };
      const step = d => { i = (i + d + pics.length) % pics.length; show(); };
      v.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) { if (e.target === v || e.target.classList.contains('lfc-vbox')) v.remove(); return; }
        if (b.dataset.v === 'x') v.remove(); if (b.dataset.v === 'p') step(-1); if (b.dataset.v === 'n') step(1); });
      let sx = null; v.addEventListener('touchstart', e => sx = e.touches[0].clientX, { passive: true });
      v.addEventListener('touchend', e => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1); });
      const key = e => { if (!document.body.contains(v)) return removeEventListener('keydown', key); if (e.key === 'Escape') v.remove(); if (e.key === 'ArrowLeft') step(-1); if (e.key === 'ArrowRight') step(1); };
      addEventListener('keydown', key);
      if (pics.length < 2) v.querySelectorAll('[data-v=p],[data-v=n]').forEach(b => b.hidden = true);
      document.body.append(v); show();
    }

    return {
      auth(u, r) {
        const was = me && me.uid; me = r ? u : null; role = r || '';
        if (was !== (me && me.uid)) {
          if (feature.open) feature.close();
          setOptions(false);
          members = {};
          msgs = [];
          updatePhotoPreview();
          let cachedCollapsed = false;
          try { cachedCollapsed = !!me && localStorage.getItem(collapsedKey(me.uid)) === '1'; } catch (_) {}
          applyCollapsed(cachedCollapsed);
          familyLayoutUid = null;
          syncPinnedPhotos();
          note = '';
          familyDesk.setLayout('desktop', null);
          familyDesk.setLayout('phone', null);
          updateName();
        }
        if (!me) { stop(); msgs = []; list.replaceChildren(); opt.tabDot && opt.tabDot(false); return; }
        if (was !== me.uid) start();
      },
      account() { if (me) avatarPicker(false); },
      _camera: () => camera(), _editor: (f, o) => photoEditor(f, o),
      closePopups() { if (closeOverlay) closeOverlay(false); },
      search, findNext: () => findStep(1),
      show(on) {
        visible = on; dot(); document.body.classList.toggle('lf-tab-family', on);
        if (!on) {
          if (feature.open) feature.close();
          familyDesk.closeMenu();
          setOptions(false);
          closeStickers();
          if (closeOverlay) closeOverlay(false);
          clearTimeout(noticeTimer); notice.textContent = '';
          return;
        }
        firstOpen = true; myRead = seenTs = me ? (reads[me.uid] || 0) : 0;
        familyDesk.relayout();
        fit(); render(); markRead();
        if (needPick) { needPick = false; avatarPicker(true); }
      }
    };
  };
})();
