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
    let me = null, role = '', unsubs = [], visible = false, needPick = false;
    let msgs = [], members = {}, phones = {}, reads = {}, pin = null, myRead = 0, firstOpen = true, reply = null, menuOpen = false;
    const hidden = new Set(JSON.parse(localStorage.getItem('linfamily_chat_hidden') || '[]'));
    const isSuper = () => role === 'superuser';
    const prof = uid => members[uid] || { name: '家人', av: 'cat' };

    root.innerHTML = `
      <div class="lfc">
        <div class="lfc-head">
          <h2 class="lfc-title">林家群組<small id="lfcCount"></small></h2>
          <button class="lfc-hbtn" id="lfcMembers" title="成員">👥</button>
          <button class="lfc-hbtn" id="lfcMine" title="我的頭像"><span class="lfc-me-av" id="lfcMyAv"></span></button>
        </div>
        <div class="lfc-pin" id="lfcPin" hidden>📢<span id="lfcPinText"></span><button id="lfcUnpin" title="取消公告">✕</button></div>
        <div class="lfc-list" id="lfcList"></div>
        <div class="lfc-reply" id="lfcReply" hidden>↩︎<span id="lfcReplyText"></span><button id="lfcReplyX">✕</button></div>
        <div class="lfc-sugg" id="lfcSugg" hidden></div>
        <div class="lfc-stks" id="lfcStks" hidden></div>
        <div class="lfc-bar">
          <button class="lfc-ibtn" id="lfcCam" title="拍照">📷</button>
          <button class="lfc-ibtn" id="lfcPic" title="傳照片">🖼️</button>
          <button class="lfc-ibtn" id="lfcStk" title="貼圖">😊</button>
          <textarea class="lfc-in" id="lfcIn" rows="1" placeholder="輸入訊息" enterkeyhint="send"></textarea>
          <button class="lfc-ibtn lfc-send" id="lfcSend" title="傳送">➤</button>
        </div>
        <input type="file" id="lfcFileCam" accept="image/*" capture="environment" hidden>
        <input type="file" id="lfcFilePic" accept="image/*" multiple hidden>
      </div>`;
    const $ = id => root.querySelector('#' + id);
    const list = $('lfcList'), input = $('lfcIn');

    // ---------- 版面高度：聊天框填滿畫面剩下的高度 ----------
    function fit() {
      if (!visible) return;
      const box = root.firstElementChild, vh = window.visualViewport ? visualViewport.height : innerHeight;
      box.style.height = Math.max(420, vh - box.getBoundingClientRect().top - 14) + 'px';
    }
    addEventListener('resize', fit); if (window.visualViewport) visualViewport.addEventListener('resize', () => { const nb = nearBottom(); fit(); if (nb) toBottom(); });

    // ---------- 資料 ----------
    function stop() { unsubs.forEach(u => u()); unsubs = []; }
    function start() {
      stop(); firstOpen = true;
      const col = n => db.collection(n);
      unsubs.push(col('lf_chat_profiles').onSnapshot(s => {
        members = {}; s.forEach(d => members[d.id] = d.data());
        $('lfcCount').textContent = ' (' + s.size + ')';
        $('lfcMyAv').innerHTML = face(prof(me.uid).av);
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
    function err(e) { console.warn('留言板', e); if (e && e.code === 'permission-denied') list.innerHTML = '<p class="lfc-empty">留言板還沒開放（Firestore 規則尚未發布）。</p>'; }
    function markRead() {
      if (!visible || document.hidden || !me || !msgs.length) return;
      const last = msgs[msgs.length - 1].t;
      if ((reads[me.uid] || 0) >= last) return;
      reads[me.uid] = last;
      db.collection('lf_chat_reads').doc(me.uid).set({ at: FV.serverTimestamp() }).catch(() => {});
    }
    document.addEventListener('visibilitychange', markRead);
    function dot() { // Family 分頁紅點：別人有新訊息、我還沒看
      if (!opt.tabDot || !me) return;
      const mine = reads[me.uid] || 0;
      opt.tabDot(!visible && msgs.some(m => m.uid !== me.uid && m.t > mine));
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
      if (!me) return;
      const keep = nearBottom(), top = list.scrollTop;
      const frag = document.createDocumentFragment(); let lastDay = '', unreadMark = false;
      const shown = msgs.filter(m => !hidden.has(m.id));
      if (!shown.length) frag.append(h('<p class="lfc-empty">還沒有訊息，跟家人打聲招呼吧！</p>'));
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
      catch (e) { toast('傳送失敗，請檢查網路後再試'); console.warn(e); }
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
    input.addEventListener('input', () => { grow(); suggest(); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(pointer:fine)').matches) { e.preventDefault(); sendText(); } });
    $('lfcSend').onclick = () => { sendText(); input.focus(); };
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
    list.addEventListener('contextmenu', e => { const b = e.target.closest('.lfc-bub'); if (!b) return; e.preventDefault(); actions(b.closest('.lfc-row').dataset.id); });
    $('lfcPin').addEventListener('click', e => { if (e.target.id !== 'lfcUnpin' && pin) go(pin.id); });
    $('lfcUnpin').onclick = () => { if (confirm('取消這則公告？')) db.collection('lf_chat_meta').doc('pin').set({ id: '' }); };
    $('lfcMembers').onclick = memberList;
    $('lfcMine').onclick = () => avatarPicker(false);

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
    function actions(id) {
      const m = msgs.find(x => x.id === id); if (!m || m.unsent) return;
      if (navigator.vibrate) navigator.vibrate(15);
      const mine = m.uid === me.uid, canUnsend = mine && Date.now() - m.t < DAY;
      const o = overlay(`<div class="lfc-emos">${EMOS.map(e => `<button data-e="${e}">${e}</button>`).join('')}</div>
        <button class="lfc-act" data-a="reply">↩︎ 回覆</button>
        ${m.text ? '<button class="lfc-act" data-a="copy">📋 複製</button>' : ''}
        ${m.text ? '<button class="lfc-act" data-a="pin">📢 設為公告</button>' : ''}
        ${m.img ? `<a class="lfc-act" href="${m.img}" download="LinFamily-${m.t}.jpg" data-close>⬇️ 下載照片</a>` : ''}
        ${canUnsend ? '<button class="lfc-act danger" data-a="unsend">↶ 收回（大家都看不到）</button>' : ''}
        <button class="lfc-act danger" data-a="hide">🗑️ 刪除（只有我看不到）</button>
        <button class="lfc-act" data-close>取消</button>`, true);
      o.ov.addEventListener('click', e => {
        const em = e.target.closest('[data-e]'); if (em) { react(id, em.dataset.e); return o.close(); }
        const a = e.target.closest('[data-a]'); if (!a) return; o.close();
        const ref = db.collection('lf_chat_messages').doc(id);
        if (a.dataset.a === 'reply') setReply(m);
        if (a.dataset.a === 'copy') navigator.clipboard.writeText(m.text).then(() => toast('已複製'), () => toast('無法複製'));
        if (a.dataset.a === 'pin') db.collection('lf_chat_meta').doc('pin').set({ id, name: prof(m.uid).name, text: m.text.slice(0, 120) }).then(() => toast('已設為公告'));
        if (a.dataset.a === 'unsend' && confirm('收回這則訊息？所有人都會看不到。')) {
          ref.update({ unsent: true, text: FV.delete(), img: FV.delete(), stk: FV.delete(), replyTo: FV.delete(), mentions: FV.delete(), reacts: FV.delete() }).catch(() => toast('無法收回'));
          if (pin && pin.id === id) db.collection('lf_chat_meta').doc('pin').set({ id: '' });
        }
        if (a.dataset.a === 'hide') { hidden.add(id); try { localStorage.setItem('linfamily_chat_hidden', JSON.stringify([...hidden].slice(-500))); } catch (_) {} render(); }
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
      const o = overlay(`${first ? '<p style="margin-bottom:8px">歡迎來到林家群組！先選一個頭像吧</p>' : ''}<div class="lfc-big" id="lfcCur">${face(pick)}</div>
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
      const v = h(`<div class="lfc-view"><img alt="照片"><span class="lfc-vcount"></span>
        <button class="lfc-vbtn" data-v="x" style="top:calc(12px + env(safe-area-inset-top));right:12px">✕</button>
        <a class="lfc-vbtn" data-v="dl" style="bottom:calc(16px + env(safe-area-inset-bottom));right:16px" title="下載">⬇</a>
        <button class="lfc-vbtn" data-v="p" style="left:10px;top:50%">‹</button><button class="lfc-vbtn" data-v="n" style="right:10px;top:50%">›</button></div>`);
      const show = () => { const m = pics[i]; v.querySelector('img').src = m.img; v.querySelector('[data-v=dl]').href = m.img; v.querySelector('[data-v=dl]').download = 'LinFamily-' + m.t + '.jpg';
        v.querySelector('.lfc-vcount').textContent = (i + 1) + ' / ' + pics.length; };
      const step = d => { i = (i + d + pics.length) % pics.length; show(); };
      v.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) { if (e.target === v) v.remove(); return; }
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
        visible = on; dot();
        if (!on) return;
        firstOpen = true; myRead = me ? (reads[me.uid] || 0) : 0;
        fit(); render(); markRead();
        if (needPick) { needPick = false; avatarPicker(true); }
      }
    };
  };
})();
