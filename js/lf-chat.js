/* LF 家庭留言板（Family 分頁）— 操作照 LINE：群組聊天、照片、貼圖、回覆、收回、表情回應、@提及、公告、已讀、頭像、點頭像撥電話
   Firestore：
     lf_chat_messages/{id}  { uid, text, img, stk, replyTo:{id,name,text}, mentions:[uid], reacts:{uid:emoji}, unsent, ts }
     lf_chat_profiles/{uid} { name, av, email, at }（本人寫）   lf_chat_reads/{uid} { at }（本人寫，算已讀）
     lf_chat_phones/{uid}   { phone }（Superuser 寫）           lf_chat_meta/pin { id, name, text }（公告）
   用法：const chat = lfChatInit(rootEl, { db, toast, tabDot }); chat.auth(user, role); chat.show(true/false) */
(function () {
  const AV = [['cat', '小貓', '#f8c8d8', '#e58aa8'], ['bear', '小熊', '#e8c9a0', '#b98a5a'], ['rab', '兔兔', '#eef0f6', '#f2a7c0'], ['dog', '小狗', '#f3dcb5', '#a8774a'],
    ['pen', '企鵝', '#cfe3f7', '#2f3a4a'], ['chk', '小雞', '#fde9a0', '#f0a640'], ['frg', '青蛙', '#c9eab0', '#5a9a3a'], ['pnd', '熊貓', '#f4f4f4', '#333333']];
  const MOODS = ['', 'happy', 'love', 'wow']; // 貼圖：每個頭像 4 種表情
  function face(key, mood) {
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
    return `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true"><rect width="64" height="64" fill="${b}"/>${e}${fc}${eyes}${nose}${beak ? '' : mouth}<circle cx="19" cy="41" r="3" fill="#f39cb0" opacity=".6"/><circle cx="45" cy="41" r="3" fill="#f39cb0" opacity=".6"/></svg>`;
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
    const db = opt.db, toast = opt.toast || (m => alert(m)), FV = firebase.firestore.FieldValue;
    let me = null, role = '', unsubs = [], visible = false, needPick = false, denied = false;
    let msgs = [], members = {}, phones = {}, reads = {}, pin = null, myRead = 0, firstOpen = true, reply = null, menuOpen = false;
    const hidden = new Set(JSON.parse(localStorage.getItem('linfamily_chat_hidden') || '[]'));
    const isSuper = () => role === 'superuser';
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
        <div class="lfc-head" id="lfcHead">
          <button class="lfc-hbtn" id="lfcBack" title="回主畫面">${IC.back}</button>
          <h2 class="lfc-title">Lin Family<small id="lfcCount"></small></h2>
          <button class="lfc-hbtn" id="lfcFind" title="搜尋">${IC.search}</button>
          <button class="lfc-hbtn" id="lfcMenu" title="選單">${IC.menu}</button>
        </div>
        <div class="lfc-findbar" id="lfcFindBar" hidden><input id="lfcFindIn" placeholder="搜尋聊天內容" enterkeyhint="search"><span id="lfcFindN"></span><button id="lfcFindX">✕</button></div>
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

    // ---------- 版面：手機全寬貼底；寬螢幕（≥640，跟桌面引擎同一個分界）是浮在 Family 分頁上的卡片，可左右移動、調寬窄 ----------
    const box = root.firstElementChild, wideQ = matchMedia('(min-width:640px)');
    let lay = { x: null, w: 420 }, layLoaded = false, collapsed = false;
    root.setAttribute('data-lf-menu-ignore', ''); // 卡片裡不出現 LF 的 Copy link 選單
    root.addEventListener('contextmenu', e => { if (!e.target.closest('textarea, input, a')) e.preventDefault(); });
    const tab = h('<button class="lfc-tab" hidden>Lin Family<span class="lfc-tdot" hidden></span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg></button>');
    root.append(tab, h('<div class="lfc-rz l"></div>'), h('<div class="lfc-rz r"></div>'));
    const rzL = root.querySelector('.lfc-rz.l'), rzR = root.querySelector('.lfc-rz.r');
    function place() {
      const W = root.clientWidth, wide = wideQ.matches;
      let x = 0, w = W;
      if (wide) { w = Math.min(W, Math.max(360, lay.w || 420)); x = lay.x == null ? W - w - 24 : lay.x; x = Math.max(0, Math.min(W - w, x)); }
      box.style.left = x + 'px'; box.style.width = wide ? w + 'px' : '';
      rzL.style.left = (x - 5) + 'px'; rzR.style.left = (x + w - 5) + 'px'; rzL.hidden = rzR.hidden = !wide || collapsed;
      tab.style.left = (wide ? x + 16 : 12) + 'px';
      return { x, w, W };
    }
    function fit() {
      if (!visible) return;
      const vh = window.visualViewport ? visualViewport.height : innerHeight;
      box.style.height = Math.max(300, Math.min(root.clientHeight, vh - root.getBoundingClientRect().top)) + 'px';
      place();
    }
    addEventListener('resize', fit); if (window.visualViewport) visualViewport.addEventListener('resize', () => { const nb = nearBottom(); fit(); if (nb) toBottom(); });
    function setCollapsed(c) { collapsed = c; box.hidden = c; tab.hidden = !c; place(); if (!c) { fit(); toBottom(); markRead(); } dot(); }
    tab.onclick = () => setCollapsed(false);
    function saveLay() { if (me) db.collection('lf_chat_profiles').doc(me.uid).set({ layout: { x: Math.round(lay.x), w: Math.round(lay.w) } }, { merge: true }).catch(() => {}); }
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
    drag($('lfcHead'), (dx, st) => { if (wideQ.matches) lay.x = st.x + dx; }, () => setCollapsed(true));
    drag(rzR, (dx, st) => { lay.x = st.x; lay.w = Math.max(360, Math.min(st.W - st.x, st.w + dx)); });
    drag(rzL, (dx, st) => { const w = Math.max(360, Math.min(st.x + st.w, st.w - dx)); lay.x = st.x + st.w - w; lay.w = w; });
    wideQ.addEventListener && wideQ.addEventListener('change', fit);

    // ---------- 資料 ----------
    function stop() { unsubs.forEach(u => u()); unsubs = []; }
    function start() {
      stop(); firstOpen = true; denied = false;
      const col = n => db.collection(n);
      unsubs.push(col('lf_chat_profiles').onSnapshot(s => {
        members = {}; s.forEach(d => members[d.id] = d.data());
        if (!layLoaded && members[me.uid]) { layLoaded = true; const L = members[me.uid].layout; if (L && L.w) { lay = { x: L.x, w: L.w }; place(); } }
        $('lfcCount').textContent = ' (' + s.size + ')';
        if (!members[me.uid]) col('lf_chat_profiles').doc(me.uid).set({ name: me.displayName || me.email.split('@')[0], av: 'cat', email: me.email.toLowerCase(), at: FV.serverTimestamp() }).then(() => { needPick = true; if (visible) { needPick = false; avatarPicker(true); } });
        render();
      }, err));
      unsubs.push(col('lf_chat_phones').onSnapshot(s => { phones = {}; s.forEach(d => phones[d.id] = d.data().phone || ''); }, err));
      unsubs.push(col('lf_chat_reads').onSnapshot(s => {
        reads = {}; s.forEach(d => reads[d.id] = ms(d.data({ serverTimestamps: 'estimate' }).at));
        if (reads[me.uid] && firstOpen) myRead = reads[me.uid];
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
      const unread = msgs.some(m => m.uid !== me.uid && m.t > mine);
      opt.tabDot(!visible && unread); tab.querySelector('.lfc-tdot').hidden = !(collapsed && unread);
    }

    // ---------- 畫面 ----------
    const nearBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    const toBottom = () => { list.scrollTop = list.scrollHeight; };
    function textHtml(m) {
      let s = esc(m.text || '').replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
      (m.mentions || []).forEach(uid => { const n = esc('@' + prof(uid).name); s = s.split(n).join(`<span class="lfc-ment">${n}</span>`); });
      return s;
    }
    function readCount(m) { let n = 0; for (const uid in reads) if (uid !== me.uid && reads[uid] >= m.t) n++; return n; }
    function render() {
      if (!me || denied) return;
      const keep = nearBottom(), top = list.scrollTop;
      const frag = document.createDocumentFragment(); let lastDay = '', unreadMark = false;
      const shown = msgs.filter(m => !hidden.has(m.id));
      if (!shown.length) frag.append(h('<p class="lfc-empty">No messages yet — say hi to your family!</p>'));
      shown.forEach(m => {
        const dl = dayLabel(m.t);
        if (dl !== lastDay) { frag.append(h(`<div class="lfc-date"><span>${dl}</span></div>`)); lastDay = dl; }
        if (!unreadMark && firstOpen && myRead && m.t > myRead && m.uid !== me.uid) { unreadMark = true; frag.append(h('<div class="lfc-sys lfc-unread" id="lfcUnreadMark"><span>以下為尚未閱讀的訊息</span></div>')); }
        const p = prof(m.uid), mine = m.uid === me.uid;
        if (m.unsent) { frag.append(h(`<div class="lfc-sys"><span>${esc(mine ? '你' : p.name)}已收回訊息</span></div>`)); return; }
        let body;
        if (m.img) body = `<div class="lfc-bub lfc-media"><img class="lfc-photo" src="${m.img}" alt="照片" loading="lazy"></div>`;
        else if (m.stk) { const [k, mood] = m.stk.split(':'); body = `<div class="lfc-bub lfc-media"><div class="lfc-stk">${face(k, mood)}</div></div>`; }
        else body = `<div class="lfc-bub">${m.replyTo ? `<div class="lfc-quote" data-go="${esc(m.replyTo.id)}">${esc(m.replyTo.name)}：${esc(m.replyTo.text)}</div>` : ''}${textHtml(m)}</div>`;
        const rc = {}; Object.values(m.reacts || {}).forEach(e => rc[e] = (rc[e] || 0) + 1);
        const myE = (m.reacts || {})[me.uid];
        const reacts = Object.keys(rc).length ? `<div class="lfc-reacts">${Object.keys(rc).map(e => `<span data-emo="${e}" class="${e === myE ? 'mine' : ''}">${e}${rc[e] > 1 ? ' ' + rc[e] : ''}</span>`).join('')}</div>` : '';
        const n = mine ? readCount(m) : 0;
        const meta = `<div class="lfc-meta">${mine && n ? '已讀 ' + n + '<br>' : ''}${hm(m.t)}</div>`;
        const hit = !mine && (m.mentions || []).includes(me.uid);
        frag.append(h(`<div class="lfc-row${mine ? ' me' : ''}${hit ? ' hit' : ''}" data-id="${m.id}">
          ${mine ? '' : `<button class="lfc-av" data-uid="${esc(m.uid)}" aria-label="${esc(p.name)}">${face(p.av)}</button>`}
          <div class="lfc-col">${mine ? '' : `<p class="lfc-name">${esc(p.name)}</p>`}<div class="lfc-line">${body}${meta}</div>${reacts}</div></div>`));
      });
      list.replaceChildren(frag);
      if (firstOpen && visible) {
        const mk = list.querySelector('#lfcUnreadMark');
        if (mk) list.scrollTop = mk.offsetTop - 8; else toBottom();
        if (msgs.length) { firstOpen = false; myRead = 0; }
      } else if (keep) toBottom(); else list.scrollTop = top;
    }

    // ---------- 傳送 ----------
    async function send(data) {
      if (!me) return;
      const d = Object.assign({ uid: me.uid, ts: FV.serverTimestamp() }, data);
      if (reply) { d.replyTo = reply; setReply(null); }
      try { await db.collection('lf_chat_messages').add(d); setTimeout(toBottom, 50); }
      catch (e) { toast('傳送失敗：' + ((e && e.code) || e)); console.warn(e); }
    }
    function sendText() {
      const text = input.value.trim(); if (!text) return;
      const mentions = Object.keys(members).filter(uid => text.includes('@' + members[uid].name));
      input.value = ''; grow(); $('lfcSugg').hidden = true;
      send(mentions.length ? { text, mentions } : { text });
    }
    async function sendFiles(files) {
      for (const f of Array.from(files || []).slice(0, 10)) {
        const img = await shrink(f).catch(() => '');
        if (img) await send({ img }); else toast('這張照片無法讀取');
      }
    }
    function grow() { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; }
    function sendIcon() { const t = !!input.value.trim(), b = $('lfcSend'); if (b.dataset.t === String(t)) return; b.dataset.t = String(t); b.innerHTML = t ? IC.send : IC.mic; b.title = t ? '傳送' : '語音訊息'; b.classList.toggle('on', t); }
    input.addEventListener('input', () => { grow(); suggest(); sendIcon(); });
    input.addEventListener('focus', () => { $('lfcTools').hidden = true; $('lfcMore').hidden = false; });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(pointer:fine)').matches) { e.preventDefault(); sendText(); sendIcon(); } });
    $('lfcSend').onclick = () => { if (!input.value.trim()) return toast('語音訊息之後開放'); sendText(); sendIcon(); input.focus(); };
    $('lfcMore').onclick = () => { $('lfcTools').hidden = false; $('lfcMore').hidden = true; };
    $('lfcCam').onclick = () => $('lfcFileCam').click();
    $('lfcPic').onclick = () => $('lfcFilePic').click();
    ['lfcFileCam', 'lfcFilePic'].forEach(id => $(id).onchange = e => { sendFiles(e.target.files); e.target.value = ''; });
    $('lfcStk').onclick = () => {
      const box = $('lfcStks');
      if (!box.childElementCount) AV.forEach(a => MOODS.forEach(md => { const b = h(`<button title="${a[1]}">${face(a[0], md)}</button>`); b.onclick = () => { box.hidden = true; send({ stk: a[0] + ':' + md }); }; box.append(b); }));
      box.hidden = !box.hidden; fit();
    };
    // @提及：輸入 @ 跳出成員
    function suggest() {
      const box = $('lfcSugg'), m = input.value.slice(0, input.selectionStart).match(/@([^\s@]*)$/);
      if (!m) { box.hidden = true; return; }
      const q = m[1].toLowerCase(), hits = Object.keys(members).filter(uid => uid !== me.uid && members[uid].name.toLowerCase().includes(q));
      if (!hits.length) { box.hidden = true; return; }
      box.replaceChildren(...hits.map(uid => { const b = h(`<button><span class="lfc-av">${face(members[uid].av)}</span>${esc(members[uid].name)}</button>`);
        b.onclick = () => { const pos = input.selectionStart, before = input.value.slice(0, pos).replace(/@[^\s@]*$/, '@' + members[uid].name + ' ');
          input.value = before + input.value.slice(pos); input.focus(); input.selectionStart = input.selectionEnd = before.length; box.hidden = true; }; return b; }));
      box.hidden = false;
    }
    function setReply(m) {
      reply = m ? { id: m.id, name: prof(m.uid).name, text: m.text ? m.text.slice(0, 60) : m.img ? '照片' : '貼圖' } : null;
      $('lfcReply').hidden = !reply; if (reply) { $('lfcReplyText').textContent = '回覆 ' + reply.name + '：' + reply.text; input.focus(); }
      fit();
    }
    $('lfcReplyX').onclick = () => setReply(null);

    // ---------- 點擊、長按 ----------
    function go(id) { const r = list.querySelector(`[data-id="${CSS.escape(id)}"]`); if (!r) return toast('這則訊息已經太舊或被收回'); r.scrollIntoView({ block: 'center', behavior: 'smooth' }); r.classList.remove('lfc-flash'); void r.offsetWidth; r.classList.add('lfc-flash'); }
    list.addEventListener('click', e => {
      if (menuOpen) return;
      const av = e.target.closest('.lfc-av'); if (av) return profile(av.dataset.uid);
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
    $('lfcUnpin').onclick = () => { if (confirm('取消這則公告？')) db.collection('lf_chat_meta').doc('pin').set({ id: '' }); };
    $('lfcBack').onclick = () => opt.onBack && opt.onBack();
    $('lfcMenu').onclick = () => {
      const o = overlay(`<button class="lfc-mem" data-m="mine"><span class="lfc-av">${face(prof(me.uid).av)}</span>我的頭像與名稱</button><button class="lfc-act" data-m="mem">👥 成員（${Object.keys(members).length}）</button>${pin ? '<button class="lfc-act" data-m="pin">📢 查看公告</button>' : ''}<button class="lfc-act" data-close>取消</button>`, true);
      o.ov.addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; o.close(); if (b.dataset.m === 'mine') avatarPicker(false); if (b.dataset.m === 'mem') memberList(); if (b.dataset.m === 'pin') go(pin.id); });
    };
    // 預留：點標題列收合／展開聊天室（之後底下要放其他東西時再做）
    // 搜尋聊天內容：Enter 跳到下一則（由新到舊）
    let findHits = [], findI = -1;
    $('lfcFind').onclick = () => { $('lfcFindBar').hidden = !$('lfcFindBar').hidden; fit(); if (!$('lfcFindBar').hidden) $('lfcFindIn').focus(); };
    $('lfcFindX').onclick = () => { $('lfcFindBar').hidden = true; $('lfcFindIn').value = ''; $('lfcFindN').textContent = ''; fit(); };
    $('lfcFindIn').addEventListener('input', () => { const q = $('lfcFindIn').value.trim().toLowerCase(); findI = -1;
      findHits = q ? msgs.filter(m => !m.unsent && !hidden.has(m.id) && (m.text || '').toLowerCase().includes(q)).map(m => m.id).reverse() : [];
      $('lfcFindN').textContent = q ? findHits.length + ' 則' : ''; });
    $('lfcFindIn').addEventListener('keydown', e => { if (e.key !== 'Enter' || !findHits.length) return; e.preventDefault(); findI = (findI + 1) % findHits.length; go(findHits[findI]); $('lfcFindN').textContent = (findI + 1) + '/' + findHits.length; });

    function react(id, emo) {
      const m = msgs.find(x => x.id === id); if (!m) return;
      const cur = (m.reacts || {})[me.uid];
      db.collection('lf_chat_messages').doc(id).update({ ['reacts.' + me.uid]: cur === emo ? FV.delete() : emo }).catch(() => toast('無法加上表情'));
    }

    // ---------- 彈出層 ----------
    function overlay(html, sheet) {
      const ov = h(`<div class="lfc-ov${sheet ? ' lfc-sheet' : ''}"><div class="lfc-card">${html}</div></div>`);
      const close = () => { ov.remove(); menuOpen = false; };
      ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-close]')) close(); });
      document.body.append(ov); menuOpen = true; return { ov, close, q: s => ov.querySelector(s) };
    }
    const MI = d => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const MENU = {
      reply: ['回覆', MI('<path d="M10 7 5 12l5 5"/><path d="M5 12h9a5 5 0 0 1 5 5v1"/>')],
      copy: ['複製', MI('<rect x="8" y="8" width="11" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h1"/>')],
      share: ['分享', MI('<circle cx="17" cy="5.5" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17" cy="18.5" r="2.5"/><path d="m8.7 10.8 6-3.9M8.7 13.2l6 3.9"/>')],
      note: ['記事本', MI('<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/>')],
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
      const keys = m.img ? ['reply', 'share', 'note', 'album'] : m.stk ? ['reply', 'note'] : ['reply', 'copy', 'share', 'note', 'pin'];
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
        if (k === 'note' || k === 'album') toast(MENU[k][0] + '之後開放');
        if (k === 'pin') db.collection('lf_chat_meta').doc('pin').set({ id, name: prof(m.uid).name, text: m.text.slice(0, 120) }).then(() => toast('已設為公告'));
        if (k === 'unsend' && confirm('收回這則訊息？所有人都會看不到。')) {
          ref.update({ unsent: true, text: FV.delete(), img: FV.delete(), stk: FV.delete(), replyTo: FV.delete(), mentions: FV.delete(), reacts: FV.delete() }).catch(() => toast('無法收回'));
          if (pin && pin.id === id) db.collection('lf_chat_meta').doc('pin').set({ id: '' });
        }
        if (k === 'del' && confirm('刪除這則訊息？只有你自己看不到，其他人還看得到。')) { hidden.add(id); try { localStorage.setItem('linfamily_chat_hidden', JSON.stringify([...hidden].slice(-500))); } catch (_) {} render(); }
      });
    }
    function profile(uid) {
      const p = prof(uid), ph = phones[uid] || '';
      const o = overlay(`<div class="lfc-big">${face(p.av)}</div><h3>${esc(p.name)}</h3><p>${ph ? esc(ph) : '尚未設定電話'}</p>
        ${ph ? `<a class="lfc-pbtn" href="tel:${esc(ph.replace(/[^\d+]/g, ''))}">📞 撥打電話</a>` : ''}
        ${isSuper() ? `<div class="lfc-field"><input id="lfcPh" type="tel" placeholder="手機號碼（只有 Superuser 能改）" value="${esc(ph)}"><button id="lfcPhSave">儲存</button></div>` : ''}
        <button class="lfc-gbtn" data-close>關閉</button>`);
      if (isSuper()) o.q('#lfcPhSave').onclick = () => db.collection('lf_chat_phones').doc(uid).set({ phone: o.q('#lfcPh').value.trim() })
        .then(() => { toast('電話已儲存'); o.close(); }, () => toast('無法儲存（請確認 Firestore 規則已發布）'));
    }
    function memberList() {
      const ids = Object.keys(members).sort((a, b) => (a === me.uid ? -1 : b === me.uid ? 1 : members[a].name.localeCompare(members[b].name)));
      const o = overlay(`<h3 style="margin:0 0 8px">成員 (${ids.length})</h3>${ids.map(uid => `<button class="lfc-mem" data-uid="${esc(uid)}"><span class="lfc-av">${face(members[uid].av)}</span>${esc(members[uid].name)}${uid === me.uid ? '（我）' : ''}</button>`).join('')}<button class="lfc-gbtn" data-close>關閉</button>`, true);
      o.ov.addEventListener('click', e => { const b = e.target.closest('.lfc-mem'); if (b) { o.close(); profile(b.dataset.uid); } });
    }
    function avatarPicker(first) {
      const p = prof(me.uid); let pick = p.av;
      const o = overlay(`${first ? '<p style="margin-bottom:8px">歡迎來到 Lin Family！先選一個頭像吧</p>' : ''}<div class="lfc-big" id="lfcCur">${face(pick)}</div>
        <div class="lfc-field"><input id="lfcName" maxlength="12" placeholder="顯示名稱" value="${esc(p.name)}"></div>
        <div class="lfc-avs">${AV.map(a => `<button data-k="${a[0]}" class="${a[0] === pick ? 'on' : ''}"><span>${face(a[0])}</span>${a[1]}</button>`).join('')}</div>
        <button class="lfc-pbtn" id="lfcAvSave">儲存</button><button class="lfc-gbtn" data-close>取消</button>`);
      o.ov.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; pick = b.dataset.k; o.q('#lfcCur').innerHTML = face(pick); o.ov.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('on', x === b)); });
      o.q('#lfcAvSave').onclick = () => {
        const name = o.q('#lfcName').value.trim() || p.name;
        db.collection('lf_chat_profiles').doc(me.uid).set({ name, av: pick, email: me.email.toLowerCase(), at: FV.serverTimestamp() }, { merge: true })
          .then(() => o.close(), () => toast('無法儲存頭像'));
      };
    }
    function viewer(id) {
      const pics = msgs.filter(m => m.img && !m.unsent && !hidden.has(m.id)); let i = Math.max(0, pics.findIndex(m => m.id === id));
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
        if (!me) { stop(); msgs = []; list.replaceChildren(); opt.tabDot && opt.tabDot(false); return; }
        if (was !== me.uid) start();
      },
      show(on) {
        visible = on; dot(); document.body.classList.toggle('lf-tab-family', on);
        if (!on) return;
        firstOpen = true; myRead = me ? (reads[me.uid] || 0) : 0;
        if (collapsed) setCollapsed(false);
        fit(); render(); markRead();
        if (needPick) { needPick = false; avatarPicker(true); }
      }
    };
  };
})();
