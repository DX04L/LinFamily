/**
 * 三年級國語｜互動學習（learn-hannah/chinese/3gd）
 * 課程資料：lessons/index.json、lessons/<id>.json
 * 進度：localStorage linfamily_learn_3gd_<id>（第二階段改存 Firestore）
 * 闖關：答對升一級；答錯留在同級；連錯 2 題降一級；最高級的每一題都答對過＝單元完成。
 */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const app = $('#app');
  const SUPERUSERS = ['darren710404@gmail.com', 'darren.lin@twclc.org'];
  const MAX = 3;
  const KEY = id => 'linfamily_learn_3gd_' + id;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  // ---------- 小工具 ----------
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // {n}：破音字讀音（源泉注音圓體的 IVS，U+E01E0+n；{0} 不顯示注音）
  const vs = n => String.fromCodePoint(0xE01E0 + Number(n));
  const zy = s => esc(s).replace(/\{(\d)\}/g, (m, n) => vs(n));
  const clean = s => String(s).replace(/\{\d\}/g, '');
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = a => a[Math.random() * a.length | 0];
  const hanCount = s => (String(s).match(/[㐀-鿿]/g) || []).length;
  function toast(msg) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2400);
  }
  window.LearnToast = toast;
  const dlg = $('#dlg'), dlgBody = $('#dlgBody');
  function openDialog(html, bind) { dlgBody.innerHTML = html; bind && bind(dlgBody); dlg.showModal(); }

  // ---------- 頁首 ----------
  $('#themeBtn').onclick = () => {
    const dark = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('linfamily_theme', dark ? 'dark' : 'light'); } catch (e) {}
  };
  const zyBtn = $('#zyBtn');
  const syncZy = () => zyBtn.setAttribute('aria-pressed', String(!document.documentElement.classList.contains('nozy')));
  zyBtn.onclick = () => {
    const off = document.documentElement.classList.toggle('nozy');
    try { localStorage.setItem('linfamily_learn_zy', off ? 'off' : 'on'); } catch (e) {}
    syncZy();
  };
  syncZy();
  $('#backBtn').onclick = () => {
    const p = location.hash.replace(/^#\/?/, '').split('/');
    location.hash = p.length > 1 ? '#/' + p[0] : '#/';
  };
  let curL = null;
  function head(title, back) { $('#title').textContent = title; document.title = title + '｜三年級國語'; $('#backBtn').hidden = !back; $('#setBtn').hidden = !back || !curL; }
  $('#setBtn').onclick = () => curL && settingsDialog(curL);

  // ---------- 課程資料與進度 ----------
  const cache = {};
  async function loadLesson(id) {
    if (!cache[id]) cache[id] = fetch('lessons/' + id + '.json?v=20261124c').then(r => r.json());
    return cache[id];
  }
  function progress(L) {
    const p = store.get(KEY(L.id), null) || { read: [], readDone: false, units: {}, extend: {} };
    L.units.forEach(u => { if (u.id !== 'read' && !p.units[u.id]) p.units[u.id] = { lv: 1, wrong: 0, cov: [], done: false, last: '' }; });
    return p;
  }
  const save = (L, p) => store.set(KEY(L.id), p);
  const lessonDone = (L, p) => p.readDone && L.units.every(u => u.id === 'read' || p.units[u.id].done);

  // 題庫（生字單元由資料自動產生）
  function bank(L, unit, lv) {
    let list;
    if (unit === 'chars') list = charBank(L, lv);
    else list = ((L.bank[unit] || {})[lv] || []).map((q, i) => Object.assign({ id: `${unit}-${lv}-${i}` }, q));
    return list;
  }
  function charBank(L, lv) {
    const C = L.chars, out = [];
    const rads = [...new Set(C.map(c => c.rad))];
    C.forEach(c => {
      const w = clean(c.words[0]);
      const opts = [c.c, ...c.look.slice(0, 3)];
      if (lv === 1) {
        out.push({ id: 'chars-1-' + c.c, t: 'choice', big: true, plain: true, q: `選出正確的字：${w.replace(c.c, '＿')}（${c.zy}）`, opts, a: 0, ex: `${w}：${c.c}（${c.zy}）` });
        out.push({ id: 'chars-1r-' + c.c, t: 'choice', plain: true, q: `「${c.c}」的部首是什麼？`, opts: [c.rad, ...shuffle(rads.filter(r => r !== c.rad)).slice(0, 2)], a: 0, ex: `「${c.c}」的部首是「${c.rad}」，部首外 ${c.rs} 畫。` });
      } else if (lv === 2) {
        out.push({ id: 'chars-2-' + c.c, t: 'choice', big: true, q: c.blank, optsPlain: true, opts, a: 0, ex: `答案是「${c.c}」（${c.zy}）。` });
        const n = c.total;
        out.push({ id: 'chars-2s-' + c.c, t: 'choice', plain: true, q: `「${c.c}」總共有幾畫？`, opts: [String(n), String(n + 1), String(Math.max(1, n - 1))], a: 0, ex: `「${c.c}」總共 ${n} 畫。` });
      } else {
        out.push({ id: 'chars-3-' + c.c, t: 'write', q: `寫出「${c.zy}」：${c.blank}`, a: c.c, char: c });
      }
    });
    return out;
  }

  // ---------- 登入 ----------
  const FB = {
    apiKey: 'AIzaSyBPcURIjgwtEVi_nTaZT569e_nwJb4IsUs', authDomain: 'linfamily-31cb6.firebaseapp.com', projectId: 'linfamily-31cb6',
    storageBucket: 'linfamily-31cb6.firebasestorage.app', messagingSenderId: '299667187224', appId: '1:299667187224:web:8df32264698caad761c56d'
  };
  let allowed = false, isSuper = false;
  function gate() {
    if (!window.firebase) { app.innerHTML = '<p class="muted">無法載入登入元件，請檢查網路後重新整理。</p>'; return; }
    if (!firebase.apps.length) firebase.initializeApp(FB);
    const auth = firebase.auth();
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
    auth.onAuthStateChanged(async user => {
      if (!user) { allowed = false; return showLogin(auth); }
      const email = (user.email || '').toLowerCase();
      isSuper = SUPERUSERS.includes(email);
      if (isSuper) allowed = true;
      else {
        try {
          const d = await firebase.firestore().collection('admin_users').doc(email).get();
          allowed = d.exists && d.data().active !== false;
        } catch (e) { allowed = false; }
      }
      if (!allowed) { head('三年級國語', false); app.innerHTML = `<div class="card"><p>${esc(email)} 沒有使用權限，請找爸爸開通。</p><button class="btn ghost" id="out">換帳號</button></div>`; $('#out').onclick = () => auth.signOut(); return; }
      route();
    });
  }
  function showLogin(auth) {
    head('三年級國語', false);
    app.innerHTML = `<div class="hero"><h2>📚 三年級國語</h2><p>請先登入</p></div><div class="row" style="justify-content:center"><button class="btn" id="login">用 Google 登入</button></div>`;
    $('#login').onclick = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => toast('登入沒有完成：' + (e.code || '')));
  }

  // ---------- 路由 ----------
  window.addEventListener('hashchange', () => allowed && route());
  async function route() {
    window.speechSynthesis && speechSynthesis.cancel();
    const p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    try {
      if (!p.length) { curL = null; return listView(); }
      const L = curL = await loadLesson(p[0]);
      if (p[1] === 'read') return readView(L);
      if (p[1] === 'cards') return cardsView(L);
      if (p[1] === 'extend') return extendView(L);
      if (p[1] === 'u' && p[2]) return unitView(L, p[2]);
      return lessonView(L);
    } catch (e) { console.error(e); app.innerHTML = '<p class="muted">找不到這一課。</p>'; }
  }

  async function listView() {
    head('三年級國語', false);
    const list = await fetch('lessons/index.json?v=20261124c').then(r => r.json());
    app.innerHTML = `<div class="hero"><h2>📚 三年級國語</h2><p>選一課開始</p></div><div class="units">${list.map(l => {
      const p = store.get(KEY(l.id), null);
      return `<a class="unit" href="#/${l.id}" style="text-decoration:none;color:inherit"><span class="ic">${l.no}</span><span><b class="zy">${zy(l.title)}</b><small>第${l.no}課${p && p.done ? '・✅ 完成' : ''}</small></span></a>`;
    }).join('')}</div>`;
  }

  function lessonView(L) {
    const p = progress(L);
    head(`第${L.no}課`, true);
    const done = lessonDone(L, p);
    if (done && !p.done) { p.done = true; save(L, p); }
    app.innerHTML = `
      <div class="hero"><p>第${L.no}課</p><h2 class="zy">${zy(L.title)}</h2><p>${esc(L.author)}</p></div>
      ${done ? `<div class="card celebrate"><div class="big">🏆</div><p>這一課全部學會了！</p><div class="row" style="justify-content:center"><a class="btn" href="#/${L.id}/extend">延伸討論</a><button class="btn ghost" id="restart2">重新開始</button></div></div>` : ''}
      <div class="units">${L.units.map(u => unitCard(L, p, u)).join('')}</div>
      <div class="row" style="margin-top:18px"><a class="btn ghost" href="#/${L.id}/cards">字卡</a>${done ? '' : `<a class="btn ghost" href="#/${L.id}/extend">延伸討論</a>`}<span class="spacer"></span>${isSuper ? '<button class="btn ghost" id="testBtn">🧪 測試</button>' : ''}<button class="btn ghost" id="restart">⚙ 設定</button></div>`;
    app.querySelectorAll('.unit').forEach(b => b.onclick = () => {
      if (b.classList.contains('locked')) return toast('先把課文讀一遍喔');
      location.hash = b.dataset.u === 'read' ? `#/${L.id}/read` : `#/${L.id}/u/${b.dataset.u}`;
    });
    const rs = () => settingsDialog(L);
    if ($('#testBtn')) $('#testBtn').onclick = () => testDialog(L);
    $('#restart').onclick = rs; if ($('#restart2')) $('#restart2').onclick = rs;
  }
  function unitCard(L, p, u) {
    if (u.id === 'read') {
      return `<button class="unit ${p.readDone ? 'done' : ''}" data-u="read"><span class="ic">${u.icon}</span><span><b>${u.name}</b><small>${p.readDone ? '✅ 讀完了' : u.desc}</small></span></button>`;
    }
    const s = p.units[u.id];
    const dots = [1, 2, 3].map(i => `<i class="${s.done || i <= s.lv ? 'on' : ''}"></i>`).join('');
    return `<button class="unit ${p.readDone ? '' : 'locked'} ${s.done ? 'done' : ''}" data-u="${u.id}"><span class="ic">${u.icon}</span><span><b>${u.name}</b><small>${s.done ? '✅ 完成' : u.desc}</small><span class="lv">${dots}</span></span></button>`;
  }
  // ---------- 設定（重設、跳級）----------
  const LVN = ['', '初級', '中級', '高級'];
  function settingsDialog(L) {
    const draw = root => {
      const p = progress(L);
      const units = L.units.filter(u => u.id !== 'read');
      root.innerHTML = `<h3 style="margin-top:0">⚙ 設定｜第${L.no}課</h3>
        <p class="set-h">全部單元一起跳到</p>
        <div class="row">${[1, 2, 3].map(lv => `<button class="btn ghost" data-all="${lv}">${LVN[lv]}</button>`).join('')}</div>
        <p class="set-h">個別單元</p>
        <div class="set-list">${units.map(u => { const s = p.units[u.id]; return `<div class="set-row"><span>${u.icon} ${u.name}<small>${s.done ? '✅ 完成' : LVN[s.lv]}</small></span>
          <span class="seg">${[1, 2, 3].map(lv => `<button data-u="${u.id}" data-lv="${lv}" class="${!s.done && s.lv === lv ? 'on' : ''}">${LVN[lv][0]}</button>`).join('')}</span></div>`; }).join('')}</div>
        <p class="set-h">重設</p>
        <div class="row"><button class="btn ghost" id="rsAll">清除這一課所有紀錄</button><span class="spacer"></span><button class="btn" id="cx">完成</button></div>`;
      const setUnit = (p, id, lv) => p.units[id] = { lv, wrong: 0, cov: [], done: false, last: '' };
      root.querySelectorAll('[data-all]').forEach(b => b.onclick = () => {
        const p = progress(L); units.forEach(u => setUnit(p, u.id, +b.dataset.all)); p.done = false; save(L, p);
        toast(`全部單元跳到${LVN[b.dataset.all]}`); draw(root);
      });
      root.querySelectorAll('[data-u]').forEach(b => b.onclick = () => {
        const p = progress(L); setUnit(p, b.dataset.u, +b.dataset.lv); p.done = false; save(L, p); draw(root);
      });
      const rs = root.querySelector('#rsAll');
      rs.onclick = () => {
        if (!rs.dataset.sure) { rs.dataset.sure = 1; rs.textContent = '再按一次確定清除'; rs.classList.add('accent'); return; }
        store.set(KEY(L.id), null); try { localStorage.removeItem(KEY(L.id)); } catch (e) {}
        toast('已清除，從課文朗讀重新開始'); dlg.close(); location.hash = '#/' + L.id; route();
      };
      root.querySelector('#cx').onclick = () => { dlg.close(); route(); };
    };
    openDialog('', draw);
  }
  // 測試用（只有 Superuser 看得到）：直接跳到某單元的某一級，略過朗讀
  function testDialog(L) {
    const units = L.units.filter(u => u.id !== 'read');
    openDialog(`<h3 style="margin-top:0">🧪 測試｜直接跳到</h3>
      <div class="set-list">${units.map(u => `<div class="set-row"><span>${u.icon} ${u.name}</span><span class="seg">${[1, 2, 3].map(lv => `<button data-u="${u.id}" data-lv="${lv}">${LVN[lv][0]}</button>`).join('')}</span></div>`).join('')}</div>
      <p class="muted" style="text-align:left;font-size:14px">手寫題：生字「高」、句子醫生「高」；注音鍵盤：一字多音「高」。</p>
      <div class="row end"><button class="btn" id="cx">關閉</button></div>`, root => {
      root.querySelector('#cx').onclick = () => dlg.close();
      root.querySelectorAll('[data-u]').forEach(b => b.onclick = () => {
        const p = progress(L);
        p.readDone = true;
        p.units[b.dataset.u] = { lv: +b.dataset.lv, wrong: 0, cov: [], done: false, last: '' };
        save(L, p); dlg.close();
        location.hash = `#/${L.id}/u/${b.dataset.u}`;
      });
    });
  }
  function nextUnit(L, p, fromId) {
    const us = L.units.filter(u => u.id !== 'read');
    const i = us.findIndex(u => u.id === fromId);
    return us.slice(i + 1).find(u => !p.units[u.id].done) || us.find(u => !p.units[u.id].done) || null;
  }

  // ---------- 課文朗讀 ----------
  function markChars(L, text) {
    const set = new Set(L.chars.map(c => c.c));
    let html = '';
    for (const m of text.matchAll(/(.)(\{\d\})?/gsu)) {
      const piece = esc(m[1]) + (m[2] ? vs(m[2][1]) : '');
      html += set.has(m[1]) ? `<span class="ch" data-c="${esc(m[1])}">${piece}</span>` : piece;
    }
    return html;
  }
  function readView(L) {
    const p = progress(L);
    head('課文朗讀', true);
    const secOf = n => L.sections.find(s => s.paras.includes(n));
    app.innerHTML = `
      <div class="hero"><h2 class="zy">${zy(L.title)}</h2><p>${esc(L.author)}</p></div>
      <div class="row" style="margin-bottom:10px"><button class="btn" id="playAll">▶ 全文朗讀</button><button class="btn ghost" id="stop" hidden>■ 停止</button><span class="spacer"></span><small class="muted">點有底線的字看字卡</small></div>
      <div class="card">${L.paras.map((t, i) => {
        const n = i + 1, s = secOf(n);
        const tag = s && s.paras[0] === n ? `<div class="sec-tag">${s.name}</div>` : '';
        return `${tag}<div class="para ${p.read.includes(n) ? 'read' : ''}" data-n="${n}"><button class="n" aria-label="朗讀第${n}段">${n}</button><p class="zy">${markChars(L, t)}</p></div>`;
      }).join('')}</div>
      <div class="row" style="justify-content:center"><button class="btn accent" id="doneRead">${p.readDone ? '✅ 已經讀完了' : '我讀完一遍了'}</button></div>`;
    const markRead = n => {
      if (!p.read.includes(n)) { p.read.push(n); save(L, p); }
      const el = app.querySelector(`.para[data-n="${n}"]`); el && el.classList.add('read');
    };
    let queue = [];
    const stopBtn = $('#stop');
    function speak(n) {
      const el = app.querySelector(`.para[data-n="${n}"]`);
      app.querySelectorAll('.para.now').forEach(x => x.classList.remove('now'));
      if (!el || !window.speechSynthesis) return;
      el.classList.add('now'); el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const u = new SpeechSynthesisUtterance(clean(L.paras[n - 1]).replace(/[『』]/g, ''));
      u.lang = 'zh-TW'; u.rate = .85;
      const v = speechSynthesis.getVoices().find(v => /zh[-_]TW/i.test(v.lang)); if (v) u.voice = v;
      u.onend = () => { el.classList.remove('now'); markRead(n); const nx = queue.shift(); if (nx) speak(nx); else stopBtn.hidden = true; };
      speechSynthesis.speak(u); stopBtn.hidden = false;
    }
    if (!window.speechSynthesis) $('#playAll').hidden = true;
    $('#playAll').onclick = () => { speechSynthesis.cancel(); queue = L.paras.map((_, i) => i + 1); speak(queue.shift()); };
    stopBtn.onclick = () => { queue = []; speechSynthesis.cancel(); stopBtn.hidden = true; app.querySelectorAll('.para.now').forEach(x => x.classList.remove('now')); };
    app.querySelectorAll('.para .n').forEach(b => b.onclick = () => { speechSynthesis.cancel(); queue = []; speak(+b.parentNode.dataset.n); });
    app.querySelectorAll('.ch').forEach(s => s.onclick = () => charDialog(L, s.dataset.c));
    $('#doneRead').onclick = () => {
      L.paras.forEach((_, i) => markRead(i + 1));
      p.readDone = true; save(L, p); toast('讀完了！開始闖關'); const nx = nextUnit(L, p, 'read'); location.hash = nx ? `#/${L.id}/u/${nx.id}` : '#/' + L.id;
    };
  }

  // ---------- 字卡 ----------
  function charDialog(L, ch) {
    const c = L.chars.find(x => x.c === ch); if (!c) return;
    openDialog(`<div class="bigchar zy">${esc(c.c)}</div>
      <dl class="meta"><dt>注音</dt><dd class="plain">${esc(c.zy)}</dd><dt>部首</dt><dd class="plain">${esc(c.rad)}（部首外 ${c.rs} 畫）</dd><dt>總筆畫</dt><dd>${c.total} 畫</dd><dt>語詞</dt><dd class="zy">${c.words.map(zy).join('、')}</dd></dl>
      <p style="margin:0 0 8px;color:var(--sub)">照著淡淡的字寫寫看：</p><div id="pp"></div>
      <div class="row end" style="margin-top:12px"><button class="btn ghost" id="cl">關閉</button></div>`, root => {
      root.querySelector('#cl').onclick = () => dlg.close();
      const pd = LearnHW.pad({ guide: c.c, okText: '檢查', onResult: cands => {
        if (cands === null) return toast('辨識服務連不上，自己對照看看');
        toast(cands.slice(0, 3).includes(c.c) ? '寫對了！👍' : `看起來像「${cands[0] || '?'}」，再試一次`);
      } });
      root.querySelector('#pp').append(pd.el);
    });
  }
  function cardsView(L) {
    const p = progress(L);
    head('生字卡', true);
    const ok = new Set((p.units.chars.cov || []).map(id => id.split('-').pop()));
    app.innerHTML = `<p class="muted">點一個字看注音、部首、筆畫，還可以練習寫。綠框＝闖關時寫對過。</p>
      <div class="cards">${L.chars.map(c => `<button class="cardc plain ${ok.has(c.c) ? 'ok' : ''}" data-c="${esc(c.c)}">${esc(c.c)}</button>`).join('')}</div>`;
    app.querySelectorAll('.cardc').forEach(b => b.onclick = () => charDialog(L, b.dataset.c));
  }

  // ---------- 延伸討論 ----------
  function extendView(L) {
    const p = progress(L);
    head('延伸討論', true);
    app.innerHTML = `<p class="muted">沒有標準答案，想一想、寫下來，再和爸爸媽媽聊聊。</p>${L.extend.map((q, i) => `
      <div class="card"><p class="q zy" style="font-size:22px">${zy(q)}</p><textarea class="ans" data-i="${i}" placeholder="寫下你的想法…">${esc(p.extend[i] || '')}</textarea></div>`).join('')}`;
    app.querySelectorAll('textarea').forEach(t => t.oninput = () => { p.extend[t.dataset.i] = t.value; save(L, p); });
  }

  // ---------- 闖關 ----------
  function unitView(L, uid) {
    const u = L.units.find(x => x.id === uid); if (!u) return lessonView(L);
    const p = progress(L);
    if (!p.readDone) { toast('先把課文讀一遍喔'); location.hash = `#/${L.id}/read`; return; }
    head(u.name, true);
    const s = p.units[uid];
    if (s.done) return unitDone(L, u, true);
    const list = bank(L, uid, s.lv);
    let cand = list;
    if (s.lv === MAX) cand = list.filter(q => !s.cov.includes(q.id));
    else if (list.length > 1) cand = list.filter(q => q.id !== s.last);
    if (!cand.length) { s.done = true; save(L, p); return unitDone(L, u); }
    const q = pick(cand);
    s.last = q.id; save(L, p);
    const top = bank(L, uid, MAX).length;
    const info = s.lv === MAX ? `${LVN[MAX]}・完成 ${s.cov.length} / ${top}` : `${LVN[s.lv]}`;
    app.innerHTML = `<div class="card"><div class="qhead"><span>${u.icon} ${u.name}</span><span>${info}</span></div>
      ${s.lv === MAX ? `<div class="progress"><i style="width:${Math.round(s.cov.length / top * 100)}%"></i></div>` : ''}
      <div id="qbox"></div><div id="fb"></div></div>`;
    renderQ(L, q, $('#qbox'), result => finish(L, p, u, q, result));
  }

  // 第一次就答對＝過關（升級或完成一題）；需要提示才答對＝留在同級，之後再考；連兩題沒有一次答對＝降一級
  function finish(L, p, u, q, r) {
    const s = p.units[u.id];
    let msg = '';
    if (r.ok && r.first) {
      s.wrong = 0;
      if (s.lv < MAX) { s.lv++; msg = `<p class="levelup">⬆ 升到${LVN[s.lv]}！</p>`; }
      else if (!s.cov.includes(q.id)) s.cov.push(q.id);
      if (s.lv === MAX && bank(L, u.id, MAX).every(x => s.cov.includes(x.id))) s.done = true;
    } else {
      s.wrong++;
      if (s.wrong >= 2) { s.wrong = 0; if (s.lv > 1) { s.lv--; msg = `<p class="levelup">回到${LVN[s.lv]}，多練習幾題就會了。</p>`; } }
      if (r.ok) msg += '<p>這題用了提示，等一下還會再遇到類似的題目喔。</p>';
    }
    save(L, p);
    const title = r.ok ? (r.first ? '✔ 答對了！' : '✔ 找到答案了！') : '🤝 我們一起看看';
    const fb = $('#fb');
    fb.innerHTML = `<div class="fb ${r.ok ? 'ok' : 'bad'}"><b>${title}</b>
      ${!r.ok && r.show ? `<p class="${q.plain ? 'plain' : 'zy'}">${r.show}</p>` : ''}${r.ok && r.show ? `<p class="zy">${r.show}</p>` : ''}${q.ex ? `<p class="zy">${zy(q.ex)}</p>` : ''}${msg}</div>
      <div class="row end" style="margin-top:12px"><button class="btn" id="next">${s.done ? '完成 🎉' : '下一題 ›'}</button></div>`;
    fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    $('#next').onclick = () => s.done ? unitDone(L, u) : unitView(L, u.id);
  }

  function unitDone(L, u, already) {
    const p = progress(L);
    const all = lessonDone(L, p);
    if (all && !p.done) { p.done = true; save(L, p); }
    const nx = all ? null : nextUnit(L, p, u.id);
    app.innerHTML = `<div class="card celebrate"><div class="big">${all ? '🏆' : '🌟'}</div>
      <p>${already ? '這個單元已經完成了！' : `「${u.name}」全部過關！`}</p>${all ? '<p>整課都學會了，太厲害了！</p>' : ''}
      <div class="row" style="justify-content:center">
        ${nx ? `<a class="btn" href="#/${L.id}/u/${nx.id}">下一個：${nx.icon} ${nx.name} ›</a>` : ''}
        ${all ? `<a class="btn" href="#/${L.id}/extend">延伸討論 ›</a>` : ''}
        <a class="btn ghost" href="#/${L.id}">回到課程</a></div></div>`;
  }

  // ---------- 引導提示 ----------
  const MAXTRY = 3;
  function secHint(L, q) {
    const s = L.sections.find(x => x.id === q.sec); if (!s) return '';
    return `<p>回到課文「${s.name}」再讀一次：</p><blockquote class="zy">${s.paras.map(n => zy(L.paras[n - 1])).join('<br>')}</blockquote>`;
  }
  function charHint(L, ch) {
    const c = L.chars.find(x => x.c === ch); if (!c) return '';
    const w = clean(c.words[0]).replace(c.c, '＿');
    return `部首是「${esc(c.rad)}」，總共 ${c.total} 畫，可以組成「${esc(w)}」。`;
  }
  function hintFor(L, q, n, extra) {
    const out = [];
    if (extra && extra.hint) out.push(`<p>${extra.hint}</p>`);
    if (n === 1) {
      if (q.hint) out.push(`<p class="zy">${zy(q.hint)}</p>`);
      else if (q.sec) out.push(secHint(L, q));
      else if (!out.length) out.push('<p>再讀一次題目，慢慢想。</p>');
    } else {
      if (q.sec) out.push(secHint(L, q));
      else if (q.hint) out.push(`<p class="zy">${zy(q.hint)}</p>`);
      out.push('<p>最後一次機會，加油！</p>');
    }
    return out.join('');
  }

  // ---------- 題型 ----------
  // 每個題型呼叫 ctl.submit(ok, { hint, reveal })：答錯時回傳 true＝可以再試（題型自己恢復可作答）
  function renderQ(L, q, box, done) {
    const cls = q.plain ? 'plain' : 'zy';
    box.innerHTML = `<p class="q ${cls}">${zy(q.q)}</p><div id="qa"></div><div id="hint"></div>`;
    const qa = box.querySelector('#qa'), hint = box.querySelector('#hint');
    let tries = 0, over = false;
    const ctl = {
      L,
      submit(ok, extra) {
        if (over) return false;
        tries++;
        if (ok) { over = true; hint.innerHTML = ''; done({ ok: true, first: tries === 1, show: extra && extra.good }); return false; }
        if (tries < MAXTRY) {
          hint.innerHTML = `<div class="fb hint"><b>💡 再想想</b>${hintFor(L, q, tries, extra)}</div>`;
          hint.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          return true;
        }
        over = true; hint.innerHTML = '';
        done({ ok: false, first: false, show: extra && extra.reveal });
        return false;
      }
    };
    (TYPES[q.t] || TYPES.choice)(q, qa, ctl, cls);
  }

  const PUNCT = /^[，。、！？：；「」]$/;
  const TYPES = {
    choice(q, qa, ctl, cls) {
      const order = shuffle(q.opts.map((t, i) => i));
      const oc = q.optsPlain || q.plain ? 'plain' : cls;
      qa.innerHTML = `<div class="opts ${q.big ? 'big' : ''}">${order.map(i => `<button class="opt ${oc}" data-i="${i}">${zy(q.opts[i])}</button>`).join('')}</div>`;
      const reveal = `答案是：${zy(q.opts[q.a])}`;
      qa.querySelectorAll('.opt').forEach(b => b.onclick = () => {
        const ok = +b.dataset.i === q.a;
        if (ok) { b.classList.add('ok'); qa.querySelectorAll('.opt').forEach(x => x.disabled = true); return ctl.submit(true); }
        b.classList.add('bad'); b.disabled = true;
        if (!ctl.submit(false, { reveal })) qa.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (+x.dataset.i === q.a) x.classList.add('ok'); });
      });
    },

    order(q, qa, ctl) {
      const n = q.items.length, picked = Array(n).fill(null), lock = Array(n).fill(false);
      const items = shuffle(q.items.map((t, i) => i));
      qa.innerHTML = `<div class="slots">${q.items.map((_, i) => `<button class="slot zy" data-s="${i}">${i + 1}.</button>`).join('')}</div>
        <div class="chips">${items.map(i => `<button class="chip zy" data-i="${i}">${zy(q.items[i])}</button>`).join('')}</div>
        <div class="row end" style="margin-top:12px"><button class="btn" id="chk" disabled>檢查</button></div>`;
      const slots = [...qa.querySelectorAll('.slot')], chk = qa.querySelector('#chk');
      const draw = () => {
        slots.forEach((s, k) => { const i = picked[k]; s.innerHTML = `${k + 1}. ${i != null ? zy(q.items[i]) : ''}`; s.classList.toggle('filled', i != null); s.classList.toggle('ok', lock[k]); s.classList.remove('bad'); });
        qa.querySelectorAll('.chip').forEach(c => c.classList.toggle('used', picked.includes(+c.dataset.i)));
        chk.disabled = picked.includes(null);
      };
      qa.querySelectorAll('.chip').forEach(c => c.onclick = () => { const i = +c.dataset.i; const k = picked.indexOf(null); if (!picked.includes(i) && k > -1) { picked[k] = i; draw(); } });
      slots.forEach((s, k) => s.onclick = () => { if (!lock[k] && picked[k] != null) { picked[k] = null; draw(); } });
      chk.onclick = () => {
        let good = 0;
        picked.forEach((i, k) => { if (i === k) { lock[k] = true; good++; } });
        if (good === n) { draw(); chk.disabled = true; return ctl.submit(true); }
        const again = ctl.submit(false, { hint: `排對了 ${good} 個（綠色的不用動），把其他的再排一次。`, reveal: '正確順序：<br>' + q.items.map((t, i) => `${i + 1}. ${zy(t)}`).join('<br>') });
        picked.forEach((i, k) => { if (!lock[k]) picked[k] = null; });
        draw(); if (!again) chk.disabled = true;
      };
    },

    match(q, qa, ctl) {
      const R = shuffle(q.right.map((t, i) => i));
      qa.innerHTML = `<div class="match"><div class="col">${q.left.map((t, i) => `<button class="mi zy" data-l="${i}">${zy(t)}</button>`).join('')}</div>
        <div class="col">${R.map(i => `<button class="mi zy" data-r="${i}">${zy(q.right[i])}</button>`).join('')}</div></div>
        <div class="row end" style="margin-top:12px"><button class="btn" id="chk" disabled>檢查</button></div>`;
      const pairs = {}, lock = {}; let selL = null;
      const Lb = [...qa.querySelectorAll('[data-l]')], Rb = [...qa.querySelectorAll('[data-r]')], chk = qa.querySelector('#chk');
      const colors = ['#4E8B7E', '#E8836B', '#6C8EBF', '#C7A23A', '#9B6BB3'];
      const draw = () => {
        Lb.forEach(b => { const l = +b.dataset.l; b.classList.toggle('sel', selL === l); b.classList.toggle('ok', !!lock[l]); b.disabled = !!lock[l]; b.style.borderColor = !lock[l] && pairs[l] != null ? colors[l % 5] : ''; });
        Rb.forEach(b => { const r = +b.dataset.r; const l = Object.keys(pairs).find(k => pairs[k] === r); b.classList.toggle('ok', l != null && !!lock[l]); b.disabled = l != null && !!lock[l]; b.style.borderColor = l != null && !lock[l] ? colors[l % 5] : ''; });
        chk.disabled = Object.keys(pairs).length !== q.left.length;
      };
      Lb.forEach(b => b.onclick = () => { selL = +b.dataset.l; delete pairs[selL]; draw(); });
      Rb.forEach(b => b.onclick = () => {
        if (selL == null) return toast('先點左邊');
        const r = +b.dataset.r; Object.keys(pairs).forEach(k => { if (pairs[k] === r) delete pairs[k]; });
        pairs[selL] = r; selL = null; draw();
      });
      chk.onclick = () => {
        let good = 0;
        q.left.forEach((_, l) => { if (pairs[l] === l) { lock[l] = true; good++; } else delete pairs[l]; });
        if (good === q.left.length) { draw(); chk.disabled = true; return ctl.submit(true); }
        const again = ctl.submit(false, { hint: `配對了 ${good} 組（綠色的對了），其他的再想想。`, reveal: q.left.map((t, i) => `${zy(t)} → ${zy(q.right[i])}`).join('<br>') });
        draw(); if (!again) { chk.disabled = true; Lb.concat(Rb).forEach(b => b.disabled = true); }
      };
    },

    circle(q, qa, ctl, cls) {
      const toks = q.tokens.split('/');
      const sel = new Set();
      qa.innerHTML = `<div class="tokens ${cls}">${toks.map((t, i) => `<button class="tok ${PUNCT.test(t) ? 'punct' : ''}" data-i="${i}">${zy(t)}</button>`).join('')}</div>
        <div class="row end" style="margin-top:12px"><button class="btn" id="chk" disabled>檢查</button></div>`;
      const chk = qa.querySelector('#chk'), btns = [...qa.querySelectorAll('.tok')];
      btns.forEach(b => b.onclick = () => {
        const i = +b.dataset.i; sel.has(i) ? sel.delete(i) : sel.add(i); b.classList.toggle('sel'); chk.disabled = !sel.size;
      });
      chk.onclick = () => {
        const chosen = [...sel].map(i => clean(toks[i]));
        const extraSel = chosen.filter(t => !q.a.includes(t)), missing = q.a.filter(a => !chosen.includes(a));
        if (!extraSel.length && !missing.length) { btns.forEach(b => b.disabled = true); chk.disabled = true; return ctl.submit(true); }
        const hint = extraSel.length ? `「${extraSel.map(esc).join('、')}」不是喔。` : `還有沒圈到的。`;
        const again = ctl.submit(false, { hint, reveal: '答案：' + q.a.map(esc).join('、') });
        btns.forEach(b => { const i = +b.dataset.i; if (sel.has(i) && !q.a.includes(clean(toks[i]))) { sel.delete(i); b.classList.remove('sel'); } });
        chk.disabled = !sel.size;
        if (!again) { btns.forEach(b => b.disabled = true); chk.disabled = true; }
      };
    },

    fix(q, qa, ctl, cls) {
      const toks = q.tokens.split('/');
      let sel = null;
      qa.innerHTML = `<div class="tokens ${cls}">${toks.map((t, i) => `<button class="tok ${PUNCT.test(t) ? 'punct' : ''}" data-i="${i}">${zy(t)}</button>`).join('')}</div>
        <div class="row end" style="margin-top:12px"><button class="btn" id="chk" disabled>確定</button></div><div id="step2"></div>`;
      const chk = qa.querySelector('#chk'), btns = [...qa.querySelectorAll('.tok')];
      const target = q.a.join('」或「');
      const reveal = `生病的地方是「${esc(target)}」${q.write ? `，正確的字是「${esc(q.write)}」` : q.opts ? `，要改成「${esc(q.opts[q.fa])}」` : ''}。`;
      btns.forEach(b => b.onclick = () => {
        btns.forEach(x => x.classList.remove('sel'));
        b.classList.add('sel'); sel = +b.dataset.i; chk.disabled = false;
      });
      chk.onclick = () => {
        const t = clean(toks[sel]);
        if (!q.a.includes(t)) {
          const again = ctl.submit(false, { hint: `「${esc(t)}」沒有生病喔。`, reveal });
          btns[sel].classList.remove('sel'); btns[sel].classList.add('bad'); chk.disabled = true;
          if (!again) btns.forEach(b => b.disabled = true);
          return;
        }
        btns.forEach(b => b.disabled = true); chk.hidden = true;
        btns[sel].classList.remove('sel'); btns[sel].classList.add('ok');
        const s2 = qa.querySelector('#step2');
        if (q.opts) {
          s2.innerHTML = `<p class="q" style="font-size:20px;margin-top:16px">找到了！要改成哪一個？</p><div></div>`;
          TYPES.choice({ opts: q.opts, a: q.fa }, s2.lastChild, ctl, cls);
        } else if (q.write) {
          s2.innerHTML = `<p class="q" style="font-size:20px;margin-top:16px">找到了！寫出正確的字：</p><div></div>`;
          TYPES.write({ a: q.write }, s2.lastChild, ctl, cls);
        } else ctl.submit(true);
      };
    },

    write(q, qa, ctl) {
      const reveal = `正確的字是 <span class="plain" style="font-size:44px">${esc(q.a)}</span>`;
      let pd;
      pd = LearnHW.pad({ onResult: cands => {
        if (cands === null) {
          const box = document.createElement('div');
          box.innerHTML = `<p>辨識服務連不上，請爸爸媽媽幫忙看看寫得對不對：<span class="plain" style="font-size:44px">${esc(q.a)}</span></p>
            <div class="row"><button class="btn" data-k="1">寫對了</button><button class="btn ghost" data-k="0">寫錯了</button></div>`;
          qa.append(box);
          box.querySelectorAll('button').forEach(b => b.onclick = () => { box.remove(); if (b.dataset.k === '1') ctl.submit(true); else { if (ctl.submit(false, { hint: charHint(ctl.L, q.a), reveal })) pd.clear(); } });
          return;
        }
        if (cands.slice(0, 3).includes(q.a)) return ctl.submit(true);
        const again = ctl.submit(false, { hint: `看起來像「${esc(cands[0] || '？')}」。${charHint(ctl.L, q.a)}`, reveal });
        pd.clear();
        if (again && pd.tries++ >= 1) { pd.setGuide(q.a); toast('照著淡淡的字描描看'); }
      } });
      pd.tries = 0;
      qa.append(pd.el);
    },

    zhuyin(q, qa, ctl) {
      const kb = LearnHW.zhuyin({ onChange: v => chk.disabled = !v });
      qa.append(kb.el);
      const row = document.createElement('div'); row.className = 'row end'; row.style.marginTop = '12px';
      row.innerHTML = '<button class="btn" disabled>檢查</button>'; qa.append(row);
      const chk = row.querySelector('button');
      const tone = s => (s.match(/[ˊˇˋ˙]/) || [''])[0], base = s => s.replace(/[ˊˇˋ˙]/g, '');
      chk.onclick = () => {
        const v = LearnHW.normZy(kb.value()), a = LearnHW.normZy(q.a);
        if (v === a) { chk.disabled = true; return ctl.submit(true); }
        const hint = base(v) === base(a) ? '注音的符號對了，聲調再唸唸看。' : tone(v) === tone(a) ? '聲調對了，符號再聽聽看。' : '';
        if (!ctl.submit(false, { hint, reveal: `正確的注音是 ${esc(q.a)}` })) chk.disabled = true;
      };
    },

    open(q, qa, ctl) {
      qa.innerHTML = `<textarea class="ans" placeholder="用鍵盤或手寫寫下你的答案…"></textarea>
        <div class="row" style="margin-top:10px"><button class="btn ghost" id="hwb">✍️ 手寫輸入</button><span class="spacer"></span><button class="btn" id="chk">檢查</button></div><div id="hwbox"></div>`;
      const ta = qa.querySelector('textarea'), hwbox = qa.querySelector('#hwbox'), chk = qa.querySelector('#chk');
      qa.querySelector('#hwb').onclick = () => {
        if (hwbox.firstChild) { hwbox.innerHTML = ''; return; }
        const pd = LearnHW.pad({ okText: '辨識', onResult: cands => {
          if (!cands) return toast('辨識服務連不上，請用鍵盤輸入');
          pd.showCands(cands, ch => { ta.value += ch; pd.clear(); });
        } });
        hwbox.append(pd.el);
        const punct = document.createElement('div'); punct.className = 'row'; punct.style.justifyContent = 'center';
        punct.innerHTML = ['，', '。', '！', '？', '「', '」', '⌫'].map(x => `<button class="btn ghost" style="min-width:52px">${x}</button>`).join('');
        punct.querySelectorAll('button').forEach(b => b.onclick = () => { ta.value = b.textContent === '⌫' ? [...ta.value].slice(0, -1).join('') : ta.value + b.textContent; });
        hwbox.append(punct);
      };
      chk.onclick = () => {
        const v = ta.value.trim();
        if (!v) return toast('先寫答案喔');
        const miss = (q.any || []).filter(g => !g.some(k => v.includes(k)));
        const short = hanCount(v) < (q.min || 0);
        const sample = `參考答案：${zy(q.sample || '')}`;
        if (!miss.length && !short) { ta.readOnly = true; chk.disabled = true; hwbox.innerHTML = ''; return ctl.submit(true, { good: sample }); }
        const hint = short && !miss.length ? '意思對了！再多寫一點，說得更清楚。' : short ? '再多寫一點，把事情說清楚。' : '還少說了一個重點喔。';
        if (!ctl.submit(false, { hint, reveal: sample })) { ta.readOnly = true; chk.disabled = true; hwbox.innerHTML = ''; }
      };
    }
  };

  gate();
})();
