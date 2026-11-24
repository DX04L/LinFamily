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
  const APP_VER = '20261124s';
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

  // ---------- 朗讀：先用裝置的中文語音；沒有中文語音、出錯或沒出聲時，改用 Google 線上語音 ----------
  // 線上語音走 LF 自己的伺服器 /api/tts（在 /lf 底下時加前綴）
  const TTS_API = (/^\/lf(\/|$)/.test(location.pathname) ? '/lf' : '') + '/api/tts';
  const TTS = (() => {
    const ss = window.speechSynthesis;
    let voice = null, keep = null, audio = null, token = 0;
    const find = () => { if (!ss) return null; const v = ss.getVoices(); return v.find(x => /zh[-_]TW/i.test(x.lang)) || v.find(x => /zh[-_](HK|Hant)/i.test(x.lang)) || v.find(x => /^(zh|cmn)/i.test(x.lang)) || null; };
    const ready = new Promise(res => {
      voice = find(); if (voice || !ss) return res();
      const t = setTimeout(res, 1500);
      ss.addEventListener('voiceschanged', () => { voice = find(); if (voice) { clearTimeout(t); res(); } });
    });
    function stop() { token++; if (ss) ss.cancel(); if (audio) { audio.pause(); audio = null; } }
    function online(text, rate, onend, my) {
      const parts = text.match(/[^。！？]{1,140}[。！？]?/g) || [text];
      let i = 0;
      const next = () => {
        if (my !== token) return;
        if (i >= parts.length) return onend && onend();
        audio = new Audio(`${TTS_API}?q=${encodeURIComponent(parts[i++])}${rate < .7 ? '&slow=1' : ''}`);
        audio.onended = next;
        audio.onerror = () => { if (my === token) toast('播放不出聲音：請檢查網路和媒體音量'); };
        audio.play().catch(() => toast('請再按一次播放'));
      };
      next();
    }
    async function say(text, opt) {
      opt = opt || {}; stop(); const my = token;
      await ready; if (my !== token) return;
      if (!voice) return online(text, opt.rate || .85, opt.onend, my);
      setTimeout(() => {
        if (my !== token) return;
        const u = new SpeechSynthesisUtterance(text); keep = u;
        u.voice = voice; u.lang = voice.lang; u.rate = opt.rate || .85;
        let started = false; u.onstart = () => { started = true; };
        u.onend = () => { if (my === token && opt.onend) opt.onend(); };
        u.onerror = e => { if (my !== token || e.error === 'interrupted' || e.error === 'canceled') return; online(text, opt.rate || .85, opt.onend, my); };
        ss.speak(u);
        if (ss.paused) ss.resume();   // 有些 Android 會卡在暫停狀態
        setTimeout(() => { if (my === token && !started && !ss.speaking) { ss.cancel(); online(text, opt.rate || .85, opt.onend, my); } }, 1800);
      }, 80);
    }
    // 聲音測試：回報每一步的狀況，方便找出哪裡出問題
    async function test(kind, log) {
      stop(); const my = token;
      log('版本 ' + APP_VER);
      if (kind === 'device') {
        if (!ss) return log('❌ 這個瀏覽器不支援語音朗讀');
        await ready;
        const all = ss.getVoices();
        log(`語音數量：${all.length}，中文語音：${voice ? `${voice.name}（${voice.lang}）` : '沒有'}`);
        if (!voice) return log('❌ 手機沒有中文語音，會改用線上語音');
        const u = new SpeechSynthesisUtterance('你好，我是語音測試。'); keep = u; u.voice = voice; u.lang = voice.lang;
        let st = false;
        u.onstart = () => { st = true; log('✅ 開始唸了（如果還是沒聲音，請調高「媒體音量」）'); };
        u.onerror = e => log('❌ 錯誤：' + e.error);
        u.onend = () => log('結束');
        ss.speak(u); if (ss.paused) ss.resume();
        setTimeout(() => { if (my === token && !st) log('❌ 等了 2 秒還沒開始唸'); }, 2000);
      } else {
        log('連線到 ' + TTS_API + ' …');
        const a = new Audio(TTS_API + '?q=' + encodeURIComponent('你好，這是線上語音測試。'));
        audio = a;
        a.onplaying = () => log('✅ 線上語音開始播放（如果沒聲音，請調高「媒體音量」）');
        a.onerror = () => log('❌ 線上語音載入失敗（可能被擋或沒網路）');
        a.play().catch(e => log('❌ 無法播放：' + e.name));
      }
    }
    return { say, stop, test };
  })();

  // 手寫判斷：嚴格＝辨識第一名就是正確的字；寬鬆＝前三名裡有就算對
  // 手寫標準：1 寬鬆（辨識前三名有就對）2 標準（第一名＋字形 ≥ 55 分）3 嚴格（第一名＋字形 ≥ 70 分）
  const hwLevel = () => { try { return +(localStorage.getItem('linfamily_learn_hwlv') || 3); } catch (e) { return 3; } };
  const SHAPE_MIN = [0, 0, 50, 65];
  // 只收課本上的繁體字：辨識給出簡體時，比字形看比較像繁體還是簡體
  const SIMP = { 髮: '发', 圍: '围', 視: '视', 籃: '篮', 誤: '误', 數: '数', 經: '经', 機: '机', 會: '会', 鏡: '镜', 齊: '齐', 響: '响', 開: '开', 說: '说', 頭: '头', 還: '还', 長: '长', 難: '难', 過: '过', 麼: '么', 們: '们', 來: '来', 這: '这', 讓: '让', 魔: '魔', 師: '师', 聲: '声', 帶: '带', 輸: '输', 顆: '颗', 準: '准', 誰: '谁', 剛: '刚', 層: '层', 幾: '几', 燃: '燃' };
  const TRAD_OF = Object.fromEntries(Object.entries(SIMP).filter(([t, s]) => t !== s).map(([t, s]) => [s, t]));
  const realStrokes = ink => ink.filter(st => { const xs = st[0], ys = st[1]; return st[0].length > 2 || Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys) > 4; }).length;
  function judgeChar(cands, ans, ink) {
    const lv = hwLevel();
    const simp = SIMP[ans] && SIMP[ans] !== ans ? SIMP[ans] : null;
    let top = cands[0];
    if (simp && ink && cands.slice(0, 3).includes(simp)) {
      // 簡體出現在候選裡：字形比較像繁體就當作寫的是繁體
      top = LearnHW.shapeScore(ink, ans) >= LearnHW.shapeScore(ink, simp) + 3 ? ans : (cands[0] === simp ? simp : top);
      if (top === simp) return { ok: false, why: 'simp', got: simp };
    }
    if (lv === 1) return { ok: top === ans || cands.slice(0, 3).includes(ans), why: 'wrong' };
    // 標準、嚴格：辨識第一名一定要是課本的字（例如寫成「藍」就不能算「籃」）
    if (top !== ans) return { ok: false, why: TRAD_OF[top] ? 'simp' : lookAlike(ans).includes(top) ? 'look' : 'wrong', got: top };
    // 筆畫數：少寫、多寫或兩筆連成一筆都不算對
    const total = curL && ((curL.strokes || {})[ans] || ((curL.chars.find(x => x.c === ans)) || {}).total);
    if (total && ink) { const n = realStrokes(ink); if (n !== total) return { ok: false, why: 'strokes', n, total }; }
    // 樣子：和辨識出的其他候選字比，寫得比較像別的字（例如把「失」寫得像「生」）就不算對
    const score = ink ? LearnHW.shapeScore(ink, ans) : 100;
    if (ink) {
      const others = [...new Set([...cands.slice(1, 6), ...lookAlike(ans)])].filter(c => c && c !== ans && c.length === 1 && /[\u3400-\u9fff]/.test(c));
      const rival = others.find(c => LearnHW.shapeScore(ink, c) >= score + 2);
      if (rival) return { ok: false, why: 'look', got: rival };
    }
    return score >= SHAPE_MIN[lv] ? { ok: true, score } : { ok: false, why: 'shape', score };
  }
  // 易混淆字：生字表的形近字＋圈詞常見的寫錯字
  const LOOK = { 籃: '藍監濫', 框: '筐眶匡', 視: '祝現示', 近: '折听', 眼: '根很跟', 圍: '偉違衛', 巾: '中市布', 愉: '偷輸', 快: '決塊', 全: '金合',
    數: '樓屢', 垃: '拉啦', 圾: '級及吸', 桶: '捅通痛', 剪: '前煎', 刀: '力刁', 曾: '層增會', 經: '輕徑', 機: '幾磯譏', 會: '曾含', 鏡: '境竟',
    子: '了孑', 整: '正', 齊: '濟擠齋', 果: '菓裸課', 然: '燃燒', 魔: '麼磨摩', 法: '去怯', 理: '裡里埋', 髮: '發廢', 店: '點占站', 失: '矢夫先', 誤: '悟娛務' };
  const lookAlike = ans => [...(LOOK[ans] || ''), ...(((curL && curL.chars.find(c => c.c === ans)) || {}).look || [])];
  function judgeMsg(j, k, L, got, ans) {
    if (j.why === 'look') {
      const r1 = (L.rads || {})[ans], m = RADM[r1] || [r1, ''];
      const look = lookAlike(ans).includes(j.got);
      return `${k != null ? `第 ${k + 1} 個字` : '這個字'}寫得比較像「${esc(j.got)}」。${look ? '它和正確的字長得很像，但部首不一樣。' : '再看看每一筆的位置和長短。'}${r1 ? `正確的字部首是「${esc(m[0])}」${m[1] ? '，' + m[1] : ''}。` : ''}`;
    }
    const who = k != null ? `第 ${k + 1} 個字` : '這個字';
    if (j.why === 'shape') return shapeMsg(k, j.score);
    if (j.why === 'strokes') return `${who}的筆畫數不對：你寫了 ${j.n} 畫，這個字有 ${j.total} 畫。檢查看看有沒有少寫，或把兩筆連在一起。`;
    if (j.why === 'simp') return `${who}寫成簡體字「${esc(j.got)}」了，要寫課本上的繁體字。`;
    return k != null ? whyChar(L, got, ans, k) : `看起來像「${esc(got || '？')}」，再想想這個字怎麼寫。`;
  }
  const charOk = (cands, ans, ink) => judgeChar(cands, ans, ink).ok;
  const shapeMsg = (k, sc) => `${k != null ? `第 ${k + 1} 個字` : '這個字'}寫對了，可是不夠工整（字形 ${sc} 分）：筆畫要連好、寫端正，再寫一次。`;

  // ---------- 頁首 ----------
  // 畫面顏色：淺色／深色／護眼（像紙一樣的暖色底，減少藍光）
  function setTheme(m) {
    const H = document.documentElement;
    H.classList.toggle('dark', m === 'dark'); H.classList.toggle('paper', m === 'paper');
    try { localStorage.setItem('linfamily_theme', m === 'dark' ? 'dark' : 'light'); localStorage.setItem('linfamily_learn_paper', m === 'paper' ? '1' : '0'); } catch (e) {}
  }
  const curTheme = () => document.documentElement.classList.contains('dark') ? 'dark' : document.documentElement.classList.contains('paper') ? 'paper' : 'light';
  $('#themeBtn').onclick = () => {
    const opts = [['light', '☀️ 淺色'], ['dark', '🌙 深色'], ['paper', '📜 護眼（紙張色）']];
    openDialog(`<h3 style="margin-top:0">畫面顏色</h3><div class="opts">${opts.map(([k, t]) => `<button class="opt ${curTheme() === k ? 'sel' : ''}" data-m="${k}">${t}</button>`).join('')}</div>
      <div class="row end" style="margin-top:14px"><button class="btn ghost" id="cx">關閉</button></div>`, root => {
      root.querySelector('#cx').onclick = () => dlg.close();
      root.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { setTheme(b.dataset.m); dlg.close(); if (location.hash.includes('/u/')) route(); });
    });
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
    if (!cache[id]) cache[id] = fetch('lessons/' + id + '.json?v=20261124s').then(r => r.json());
    return cache[id];
  }
  function progress(L) {
    const p = store.get(KEY(L.id), null) || { read: [], readDone: false, units: {}, extend: {} };
    L.units.forEach(u => {
      if (u.id === 'read') return;
      p.units[u.id] = Object.assign(newUnit(1), p.units[u.id] || {});
      if (p.units[u.id].lv > levelsOf(L, u.id)) p.units[u.id].lv = levelsOf(L, u.id);
    });
    return p;
  }
  const newUnit = lv => ({ lv, wrong: 0, set: null, cov: [], best: Math.max(0, lv - 1), done: false, last: '' });
  const levelsOf = (L, uid) => (L.units.find(u => u.id === uid) || {}).levels || 3;
  const PER = 5;   // 每一級 5 題，5 題都第一次就答對才過這一級
  function levelSet(L, s, uid) {
    const list = bank(L, uid, s.lv);
    const ids = new Set(list.map(q => q.id));
    if (!s.set || !s.set.length || s.set.some(id => !ids.has(id))) { s.set = (list.length <= PER ? list : shuffle(list).slice(0, PER)).map(q => q.id); s.cov = []; }
    return s.set.map(id => list.find(q => q.id === id));
  }
  const save = (L, p) => store.set(KEY(L.id), p);
  const lessonDone = (L, p) => p.readDone && L.units.every(u => u.id === 'read' || p.units[u.id].done);

  // 題庫（生字、圈詞由資料自動產生）
  function bank(L, unit, lv) {
    if (unit === 'chars') return charBank(L, lv);
    if (unit === 'ci') return ciBank(L, lv);
    return ((L.bank[unit] || {})[lv] || []).map((q, i) => Object.assign({ id: `${unit}-${lv}-${i}` }, q));
  }
  // 生字 5 級：1 選字與部首；2 句中選字與筆畫；3–5 看注音手寫（每級 5 個字，15 個字都要寫過）
  function charBank(L, lv) {
    const C = L.chars, out = [];
    const rads = [...new Set(C.map(c => c.rad))];
    C.forEach((c, k) => {
      const w = clean(c.words[0]);
      const opts = [c.c, ...c.look.slice(0, 3)];
      if (lv === 1) {
        out.push({ id: 'chars-1-' + c.c, t: 'choice', big: true, plain: true, q: `選出正確的字：${w.replace(c.c, '＿')}（${c.zy}）`, opts, a: 0, hint: `想一想「${w.replace(c.c, '＿')}」的意思，部首是「${c.rad}」。`, ex: `${w}：${c.c}（${c.zy}）` });
        out.push({ id: 'chars-1r-' + c.c, t: 'choice', plain: true, q: `「${c.c}」的部首是什麼？`, opts: [c.rad, ...shuffle(rads.filter(r => r !== c.rad)).slice(0, 2)], a: 0, hint: '部首常在字的左邊、上面或外框，看看是哪一部分？', ex: `「${c.c}」的部首是「${c.rad}」，部首外 ${c.rs} 畫。` });
      } else if (lv === 2) {
        out.push({ id: 'chars-2-' + c.c, t: 'choice', big: true, q: c.blank, optsPlain: true, opts, a: 0, hint: `這個字的部首是「${c.rad}」。`, ex: `答案是「${c.c}」（${c.zy}）。` });
        const n = c.total;
        out.push({ id: 'chars-2s-' + c.c, t: 'choice', plain: true, q: `「${c.c}」總共有幾畫？`, opts: [String(n), String(n + 1), String(Math.max(1, n - 1))], a: 0, hint: `用手指在空中寫一次「${c.c}」，一邊寫一邊數。`, ex: `「${c.c}」總共 ${n} 畫。` });
      } else if (Math.floor(k / 5) === lv - 3) {
        out.push({ id: 'chars-3-' + c.c, t: 'write', q: `寫出「${c.zy}」：${c.blank}`, a: c.c, char: c });
      }
    });
    return out;
  }
  // 圈詞 9 級：1–3 聽寫（國字＋注音）；4–6 課文填空；7 看解釋寫詞；8–9 找錯字改正
  function ciBank(L, lv) {
    const W = L.ci || [];
    const grp = g => W.map((w, i) => ({ w, i })).filter(o => Math.floor(o.i / 5) === g);
    if (lv <= 3) return grp(lv - 1).map(o => ({ id: 'ci-d-' + o.i, t: 'ci-dict', wi: o.i, q: '聽一聽，寫出這個圈詞（國字和注音都要寫）' }));
    if (lv <= 6) return grp(lv - 4).map(o => ({ id: 'ci-f-' + o.i, t: 'ci-fill', wi: o.i, q: '把課文缺的圈詞寫出來' }));
    if (lv === 7) return W.map((w, i) => ({ id: 'ci-m-' + i, t: 'ci-mean', wi: i, q: '看解釋和注音，寫出圈詞' }));
    return W.map((w, i) => ({ id: `ci-w${lv}-` + i, t: 'ci-wrong', wi: i, plain: true, q: '句子裡的圈詞有一個錯字，點出來，再寫出正確的字' }));
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
    TTS.stop();
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
    const list = await fetch('lessons/index.json?v=20261124s').then(r => r.json());
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
      location.hash = b.dataset.u === 'read' ? `#/${L.id}/read` : `#/${L.id}/u/${b.dataset.u}`;
    });
    const rs = () => settingsDialog(L);
    if ($('#testBtn')) $('#testBtn').onclick = () => testDialog(L);
    $('#restart').onclick = rs; if ($('#restart2')) $('#restart2').onclick = rs;
  }
  function unitCard(L, p, u) {
    if (u.id === 'read') {
      return `<button class="unit ${p.readDone ? 'done' : ''}" data-u="read"><span class="ic">${u.icon}</span><span class="ut"><b>${u.name}</b><small>${p.readDone ? '✅ 讀完了' : u.desc}</small></span></button>`;
    }
    const s = p.units[u.id], max = levelsOf(L, u.id);
    const heart = s.best ? `<span class="heart" title="完成 ${s.best} 級"><svg viewBox="0 0 24 22" aria-hidden="true"><path d="M12 21.3S2.4 15.6.9 9.4C-.3 4.6 2.6 1 6.4 1c2.4 0 4.2 1.4 5.6 3.3C13.4 2.4 15.2 1 17.6 1c3.8 0 6.7 3.6 5.5 8.4C21.6 15.6 12 21.3 12 21.3z"/></svg><b>${s.best}</b></span>` : '';
    return `<button class="unit ${s.done ? 'done' : ''}" data-u="${u.id}"><span class="ic">${u.icon}</span><span class="ut"><b>${u.name}</b><small>${s.done ? `✅ ${max} 級全部完成` : `第 ${s.lv} 級 / ${max}`}</small></span>${heart}</button>`;
  }
  // ---------- 設定（重設、跳級）----------
  const LVN = ['', '初級', '中級', '高級'];
  const lvName = (L, uid, lv) => levelsOf(L, uid) === 3 ? LVN[lv] : `第 ${lv} 級`;
  const tierLv = (L, uid, t) => { const m = levelsOf(L, uid); return m === 3 ? t : t === 1 ? 1 : t === 2 ? Math.ceil(m / 3) + 1 : Math.floor(m * 2 / 3) + 1; };
  function segBtns(L, uid, on) {
    const m = levelsOf(L, uid);
    return `<span class="seg ${m > 3 ? 'many' : ''}" style="--n:${m}">${Array.from({ length: m }, (_, i) => i + 1).map(lv => `<button data-u="${uid}" data-lv="${lv}" class="${on === lv ? 'on' : ''}">${m === 3 ? LVN[lv][0] : lv}</button>`).join('')}</span>`;
  }
  function settingsDialog(L) {
    const draw = root => {
      const p = progress(L);
      const units = L.units.filter(u => u.id !== 'read');
      root.innerHTML = `<div class="row" style="margin-bottom:4px"><h3 style="margin:0">⚙ 設定｜第${L.no}課</h3><span class="spacer"></span><button class="btn" id="cx">完成</button></div>
        <p class="muted" style="text-align:left;font-size:13px;margin:0">版本 ${APP_VER}</p>
        <p class="set-h">全部單元一起跳到</p>
        <div class="row">${[1, 2, 3].map(lv => `<button class="btn ghost" data-all="${lv}">${LVN[lv]}</button>`).join('')}</div>
        <p class="set-h">個別單元</p>
        <div class="set-list">${units.map(u => { const s = p.units[u.id]; return `<div class="set-row"><span>${u.icon} ${u.name}<small>${s.done ? '✅ 完成' : lvName(L, u.id, s.lv)}${s.best ? `・❤ ${s.best}` : ''}</small></span>
          ${segBtns(L, u.id, s.done ? 0 : s.lv)}</div>`; }).join('')}</div>
        <p class="set-h">✍️ 國字手寫標準</p>
        <div class="seg" id="hwlv">${[[1, '寬鬆'], [2, '標準'], [3, '嚴格']].map(([v, t]) => `<button data-s="${v}" class="${hwLevel() === v ? 'on' : ''}">${t}</button>`).join('')}</div>
        <p class="muted" style="text-align:left;font-size:14px;margin:6px 0 0">寬鬆：認得出是這個字就對。標準：辨識第一名要是這個字、筆畫數要對，字形 50 分以上。嚴格（預設）：字形 65 分以上，像考試的標準。注音一律只看符號和聲調方向。</p>
        <p class="set-h">🔊 聲音測試</p>
        <div class="row"><button class="btn ghost" id="t1">測試手機語音</button><button class="btn ghost" id="t2">測試線上語音</button></div>
        <div id="tlog" class="tlog"></div>
        <p class="set-h">重設</p>
        <div class="row"><button class="btn ghost" id="rsAll">清除這一課所有紀錄</button></div>`;
      root.querySelectorAll('#hwlv button').forEach(b => b.onclick = () => { try { localStorage.setItem('linfamily_learn_hwlv', b.dataset.s); } catch (e) {} draw(root); });
      const tlog = root.querySelector('#tlog');
      const log = m => { tlog.insertAdjacentHTML('beforeend', `<div>${esc(m)}</div>`); };
      root.querySelector('#t1').onclick = () => { tlog.innerHTML = ''; TTS.test('device', log); };
      root.querySelector('#t2').onclick = () => { tlog.innerHTML = ''; TTS.test('online', log); };
      const setUnit = (p, id, lv) => p.units[id] = newUnit(lv);
      root.querySelectorAll('[data-all]').forEach(b => b.onclick = () => {
        const p = progress(L); units.forEach(u => setUnit(p, u.id, tierLv(L, u.id, +b.dataset.all))); p.done = false; save(L, p);
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
      <div class="set-list">${units.map(u => `<div class="set-row"><span>${u.icon} ${u.name}</span>${segBtns(L, u.id, 0)}</div>`).join('')}</div>
      <p class="muted" style="text-align:left;font-size:14px">手寫：生字 3–5 級、圈詞全部、句子醫生「高」；注音鍵盤：一字多音「高」。</p>
      <div class="row end"><button class="btn" id="cx">關閉</button></div>`, root => {
      root.querySelector('#cx').onclick = () => dlg.close();
      root.querySelectorAll('[data-u]').forEach(b => b.onclick = () => {
        const p = progress(L);
        p.readDone = true;
        p.units[b.dataset.u] = newUnit(+b.dataset.lv);
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
      if (!el) return;
      el.classList.add('now'); el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      stopBtn.hidden = false;
      TTS.say(clean(L.paras[n - 1]).replace(/[『』]/g, ''), { rate: .85, onend: () => { el.classList.remove('now'); markRead(n); const nx = queue.shift(); if (nx) speak(nx); else stopBtn.hidden = true; } });
    }
    $('#playAll').onclick = () => { queue = L.paras.map((_, i) => i + 1); speak(queue.shift()); };
    stopBtn.onclick = () => { queue = []; TTS.stop(); stopBtn.hidden = true; app.querySelectorAll('.para.now').forEach(x => x.classList.remove('now')); };
    app.querySelectorAll('.para .n').forEach(b => b.onclick = () => { queue = []; speak(+b.parentNode.dataset.n); });
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
      const pd = LearnHW.pad({ guide: c.c, okText: '檢查', onResult: (cands, inkCopy) => {
        if (cands === null) return toast('辨識服務連不上，自己對照看看');
        const j = judgeChar(cands, c.c, inkCopy);
        toast(j.ok ? `寫對了！👍${j.score != null ? `（字形 ${j.score} 分）` : ''}` : j.why === 'wrong' ? `看起來像「${cands[0] || '?'}」，再試一次` : judgeMsg(j, null, L, cands[0], c.c));
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

  // ---------- 過關小動畫：Pinky 和 Blues 輪流跳出來（貼圖共用 LF 的 assets/chat-stickers）----------
  const STK = '../../../assets/chat-stickers/';
  const CHEERS = ['Good job!', 'Excellent!', '太棒了！', '好厲害！', 'Great!', '過關了！'];
  function celebrate(big) {
    document.querySelectorAll('.cb-ov').forEach(x => x.remove());
    const ov = document.createElement('div'); ov.className = 'cb-ov' + (big ? ' big' : '');
    const pk = pick(['pinky-4', 'pinky-6']), bl = pick(['blues-4', 'blues-6', 'blues-new-3']);
    const stars = Array.from({ length: 14 }, (_, i) => `<i style="left:${Math.round(Math.random() * 92)}%;animation-delay:${(Math.random() * .9).toFixed(2)}s">${pick(['✨', '⭐', '🌟', '💖'])}</i>`).join('');
    ov.innerHTML = `<div class="cb-stars">${stars}</div><div class="cb-text">${big ? '🏆 ' : ''}${pick(CHEERS)}</div>
      <img class="cb-chr cb-pinky" src="${STK}${pk}.webp" alt=""><img class="cb-chr cb-blues" src="${STK}${bl}.webp" alt="">`;
    document.body.append(ov);
    const off = () => ov.remove();
    ov.onclick = off; setTimeout(off, big ? 4200 : 3200);
  }

  // ---------- 闖關 ----------
  function unitView(L, uid) {
    const u = L.units.find(x => x.id === uid); if (!u) return lessonView(L);
    const p = progress(L);
    head(u.name, true);
    const s = p.units[uid], max = levelsOf(L, uid);
    if (s.done) return unitDone(L, u, true);
    const set = levelSet(L, s, uid);
    let cand = set.filter(q => !s.cov.includes(q.id));
    if (cand.length > 1) cand = cand.filter(q => q.id !== s.last);
    const q = pick(cand);
    s.last = q.id; save(L, p);
    window.scrollTo(0, 0);
    app.innerHTML = `<div class="card"><div class="qhead"><span>${u.icon} ${u.name}</span><button class="lvbtn" id="lvBtn">${lvName(L, uid, s.lv)}${max > 3 ? ` / ${max}` : ''}・${s.cov.length} / ${set.length} ▾</button></div>
      <div class="progress"><i style="width:${Math.round(s.cov.length / set.length * 100)}%"></i></div>
      <div id="qbox"></div><div id="fb"></div></div>`;
    $('#lvBtn').onclick = () => levelDialog(L, u);
    renderQ(L, q, $('#qbox'), result => finish(L, p, u, q, result));
  }
  // 單元裡選級數：從第 1 級重新開始，或從中間開始；已拿到的愛心保留
  function levelDialog(L, u) {
    const p = progress(L), s = p.units[u.id], max = levelsOf(L, u.id);
    openDialog(`<h3 style="margin-top:0">${u.icon} ${u.name}｜從第幾級開始？</h3>
      <div class="lvgrid">${Array.from({ length: max }, (_, i) => i + 1).map(lv => `<button class="opt ${lv === s.lv ? 'sel' : ''}" data-lv="${lv}">${lvName(L, u.id, lv)}${lv <= (s.best || 0) ? ' ❤' : ''}</button>`).join('')}</div>
      <div class="row" style="margin-top:14px"><button class="btn ghost" data-lv="1">↺ 從頭開始</button><span class="spacer"></span><button class="btn ghost" id="cx">取消</button></div>`, root => {
      root.querySelector('#cx').onclick = () => dlg.close();
      root.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => {
        const best = s.best || 0;
        p.units[u.id] = Object.assign(newUnit(+b.dataset.lv), { best });
        save(L, p); dlg.close(); toast(`從${lvName(L, u.id, +b.dataset.lv)}開始`); unitView(L, u.id);
      });
    });
  }

  // 第一次就答對＝這題過關；一級 5 題都過關＝完成這一級（❤ 加一）並升級
  // 需要提示才答對＝這題之後再考；連兩題沒有一次答對＝降一級
  function finish(L, p, u, q, r) {
    const s = p.units[u.id], max = levelsOf(L, u.id);
    let msg = '', levelDone = false;
    if (r.ok && r.first) {
      s.wrong = 0;
      if (!s.cov.includes(q.id)) s.cov.push(q.id);
      if (s.set.every(id => s.cov.includes(id))) {
        levelDone = true; s.best = Math.max(s.best || 0, s.lv);
        msg = `<p class="levelup">❤ ${lvName(L, u.id, s.lv)}完成！</p>`;
        if (s.lv < max) { s.lv++; s.set = null; s.cov = []; msg += `<p class="levelup">⬆ 接下來是${lvName(L, u.id, s.lv)}</p>`; }
        else s.done = true;
      }
    } else {
      s.wrong++;
      if (s.wrong >= 2) { s.wrong = 0; if (s.lv > 1) { s.lv--; s.set = null; s.cov = []; msg = `<p class="levelup">回到${lvName(L, u.id, s.lv)}，多練習幾題就會了。</p>`; } }
      if (r.ok) msg += '<p>這題用了提示，等一下還會再考一次喔。</p>';
    }
    save(L, p);
    if (levelDone) celebrate(s.done);
    const title = r.ok ? (r.first ? '✔ 答對了！' : '✔ 找到答案了！') : '🤝 我們一起看看';
    const fb = $('#fb');
    fb.innerHTML = `<div class="fb ${r.ok ? 'ok' : 'bad'}"><b>${title}</b>
      ${!r.ok && r.show ? `<p class="${q.plain ? 'plain' : 'zy'}">${r.show}</p>` : ''}${r.ok && r.show ? `<p class="zy">${r.show}</p>` : ''}${q.ex ? `<p class="zy">${zy(q.ex)}</p>` : ''}${msg}</div>
      <div class="row end" style="margin-top:12px"><button class="btn" id="next">${s.done ? '完成 🎉' : levelDone ? '下一級 ›' : '下一題 ›'}</button></div>`;
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
        <button class="btn ghost" id="again">↺ 重新練習</button>
        <a class="btn ghost" href="#/${L.id}">回到課程</a></div></div>`;
    $('#again').onclick = () => levelDialog(L, u);
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
      L, hinted: false,
      submit(ok, extra) {
        if (over) return false;
        tries++;
        if (ok) { over = true; hint.innerHTML = ''; done({ ok: true, first: tries === 1 && !ctl.hinted, show: extra && extra.good }); return false; }
        if (tries < MAXTRY) {
          hint.innerHTML = `<div class="fb hint"><b>💡 再想想</b>${hintFor(L, q, tries, extra)}<div class="row end"><button class="btn ghost" type="button">知道了</button></div></div>`;
          hint.querySelector('.fb.hint .btn').onclick = () => { hint.innerHTML = ''; };
          return true;
        }
        over = true; hint.innerHTML = '';
        done({ ok: false, first: false, show: extra && extra.reveal });
        return false;
      }
    };
    (TYPES[q.t] || CI_TYPES[q.t] || TYPES.choice)(q, qa, ctl, cls);
  }

  // ---------- 圈詞 ----------
  const RADM = {
    玉: ['王', '和玉石有關'], 髟: ['髟', '和頭髮有關'], 广: ['广', '和房子有關'], 囗: ['囗', '大口框，和圍起來有關'], 巾: ['巾', '和布有關'],
    辵: ['辶', '走馬旁，和走路、遠近有關'], 見: ['見', '和看有關'], 目: ['目', '和眼睛有關'], 竹: ['⺮', '竹字頭，和竹子有關'], 木: ['木', '木字旁，和木頭有關'],
    大: ['大', ''], 言: ['言', '言字旁，和說話有關'], 心: ['忄', '豎心旁，和心情有關'], 入: ['入', ''], 攴: ['攵', '反文旁，和動作有關'],
    土: ['土', '土字旁，和泥土有關'], 刀: ['刀', '和刀子、剪切有關'], 日: ['日', ''], 糸: ['糸', '糸字旁，和絲線有關'], 曰: ['曰', ''],
    金: ['金', '金字旁，和金屬有關'], 子: ['子', ''], 齊: ['齊', ''], 火: ['灬', '四點火，和火有關'], 鬼: ['鬼', '和鬼怪、神祕有關'], 水: ['氵', '三點水，和水有關']
  };
  const say = (text, rate) => TTS.say(text, { rate: rate || .8 });
  // 為什麼錯：不直接給答案，說出部首和意思
  function whyChar(L, got, ans, k) {
    const r = (L.rads || {})[ans], m = RADM[r] || [r, ''];
    const look = ((L.chars.find(c => c.c === ans) || {}).look || []).includes(got);
    if (TRAD_OF[got]) return `第 ${k + 1} 個字寫成簡體字「${esc(got)}」了，要寫課本上的繁體字。`;
    const head = got && got !== '？' ? `第 ${k + 1} 個字寫成「${esc(got)}」了。` : `第 ${k + 1} 個字看不太清楚，再寫一次。`;
    return head + (look ? '它和正確的字長得很像，可是部首不一樣喔。' : '') + (r ? `提示：正確的字部首是「${esc(m[0])}」${m[1] ? '，' + m[1] : ''}。` : '');
  }
  function whyZy(r, k) {
    if (!r) return `第 ${k + 1} 個字的注音還沒寫。`;
    const seen = r.guess && r.guess !== '？' ? `（看起來像「${esc(r.guess)}」）` : '';
    if (!r.symOk && !r.toneOk) return `第 ${k + 1} 個字的注音再聽一次${seen}。`;
    if (r.symOk && !r.toneOk) return `第 ${k + 1} 個字的注音符號對了，聲調再聽聽看（聲調寫在虛線右邊，輕聲點寫在最上面）。`;
    if (!r.symOk && r.toneOk) return `第 ${k + 1} 個字的聲調對了，注音符號再聽聽看${seen}。`;
    return `第 ${k + 1} 個字的注音再聽一次。`;
  }
  // 檢查格子：對的格子鎖住變綠，錯的清掉重寫；第二次錯就給淡淡的字描
  function ciWrite(L, w, qa, ctl, withZy, chk, onAgainExtra) {
    const box = LearnHW.cells({ n: w.w.length, zhuyin: withZy });
    qa.append(box.el);
    const btn = document.createElement('button'); btn.className = 'btn'; btn.type = 'button'; btn.textContent = '寫好了';
    box.bar.append(btn);
    const okC = Array(w.w.length).fill(false), okZ = Array(w.w.length).fill(!withZy), scores = Array(w.w.length).fill(null);
    let round = 0;
    btn.onclick = async () => {
      btn.disabled = true; btn.textContent = '辨識中…';
      const res = await box.read(withZy ? w.zy : null);
      btn.textContent = '寫好了';
      if (res === null) { btn.disabled = false; return toast('辨識服務連不上，請稍後再試'); }
      // 只看還沒過的格子：國字沒過要有寫、注音沒過要有寫
      const nothing = res.every((x, k) => (okC[k] || x.empty) && (okZ[k] || x.zyEmpty));
      if (nothing) { btn.disabled = false; return toast('先把字寫進格子裡'); }
      const why = [];
      res.forEach((x, k) => {
        if (!okC[k]) {
          const j = x.empty ? { ok: false, why: 'empty' } : judgeChar(x.cands, w.w[k], x.ink);
          okC[k] = j.ok; if (j.score != null) scores[k] = j.score;
          if (okC[k]) box.mark(k, 'c', 'ok'); else { box.mark(k, 'c', 'bad'); why.push(j.why === 'empty' ? `第 ${k + 1} 個字還沒寫。` : judgeMsg(j, k, L, x.c, w.w[k])); }
        }
        if (!okZ[k]) {
          okZ[k] = !!(x.zyRes && x.zyRes.ok);
          if (okZ[k]) box.mark(k, 'z', 'ok'); else { box.mark(k, 'z', 'bad'); if (!(x.empty && x.zyEmpty)) why.push(whyZy(x.zyRes, k)); }
        }
      });
      const sc = scores.map((v, k) => v != null ? `${esc(w.w[k])} ${v}` : '').filter(Boolean).join('、');
      if (okC.every(Boolean) && okZ.every(Boolean)) return ctl.submit(true, { good: `${zy(w.w)}（${esc(w.zy.join(' '))}）${sc ? `<br><small>字形分數：${sc}</small>` : ''}` });
      round++;
      const again = ctl.submit(false, { hint: why.join('<br>') + (onAgainExtra ? onAgainExtra(round) : ''), reveal: `正確的是：<span style="font-size:1.4em">${zy(w.w)}</span>（${esc(w.zy.join(' '))}）` });
      if (!again) return;
      setTimeout(() => {
        okC.forEach((ok, k) => { if (!ok) { box.clearCell(k, 'c'); if (round >= 2) box.setGuide(k, w.w[k]); } });
        okZ.forEach((ok, k) => { if (!ok) box.clearCell(k, 'z'); });
        if (round >= 2 && okC.some(x => !x)) toast('照著淡淡的字描描看');
        btn.disabled = false;
      }, 900);
    };
  }
  const blankOf = w => '＿'.repeat(w.w.length);
  const CI_TYPES = {
    'ci-dict'(q, qa, ctl) {
      const w = ctl.L.ci[q.wi];
      const speak = r => say(`${w.w}。${w.w}。`, r);
      const top = document.createElement('div');
      top.innerHTML = `<div class="row"><button class="btn accent" type="button">🔊 再聽一次</button><button class="btn ghost" type="button">🐢 慢慢唸</button></div>
        <p class="ci-mean zy">解釋：${zy(w.mean)}</p>`;
      const [b1, b2] = top.querySelectorAll('button'); b1.onclick = () => speak(.8); b2.onclick = () => speak(.5);
      qa.append(top); setTimeout(() => speak(.8), 300);
      ciWrite(ctl.L, w, qa, ctl, true, null, round => round === 1 ? '<br>按「🔊 再聽一次」仔細聽。' : '');
    },
    'ci-fill'(q, qa, ctl) {
      const w = ctl.L.ci[q.wi];
      const top = document.createElement('div');
      top.innerHTML = `<p class="ci-sent zy">${zy(w.sent).replace('[]', `<span class="ci-blank">${blankOf(w)}</span>`)}</p>
        <div class="row"><button class="btn ghost ci-q" type="button" aria-label="提示">？</button><span class="ci-tip zy"></span></div>`;
      let n = 0; const tip = top.querySelector('.ci-tip');
      top.querySelector('.ci-q').onclick = () => {
        n++; ctl.hinted = true;
        tip.innerHTML = n === 1 ? `意思是：${zy(w.mean)}` : `意思是：${zy(w.mean)}<br>注音：<span class="plain">${esc(w.zy.join(' '))}</span>`;
      };
      qa.append(top);
      ciWrite(ctl.L, w, qa, ctl, false);
    },
    'ci-mean'(q, qa, ctl) {
      const w = ctl.L.ci[q.wi];
      const top = document.createElement('div');
      top.innerHTML = `<p class="ci-mean zy">解釋：${zy(w.mean)}</p><p class="ci-zy plain">${esc(w.zy.join('　'))}</p>`;
      qa.append(top);
      ciWrite(ctl.L, w, qa, ctl, false);
    },
    'ci-wrong'(q, qa, ctl) {
      const w = ctl.L.ci[q.wi];
      const bad = w.w.slice(0, w.wrong.i) + w.wrong.c + w.w.slice(w.wrong.i + 1);
      const sent = clean(w.sent).replace('[]', `\u0000${bad}\u0000`);
      const [pre, mid, post] = sent.split('\u0000');
      const toks = [...pre].map(c => ({ c })).concat([...mid].map((c, k) => ({ c, wrong: k === w.wrong.i }))).concat([...post].map(c => ({ c })));
      qa.innerHTML = `<div class="tokens plain">${toks.map((t, i) => `<button class="tok ${PUNCT.test(t.c) ? 'punct' : ''}" data-i="${i}">${esc(t.c)}</button>`).join('')}</div><div id="s2"></div>`;
      const btns = [...qa.querySelectorAll('.tok')];
      btns.forEach(b => b.onclick = () => {
        const t = toks[+b.dataset.i];
        if (!t.wrong) {
          b.classList.add('bad'); b.disabled = true;
          const again = ctl.submit(false, { hint: `「${esc(t.c)}」沒有錯喔。再慢慢讀一次句子，有一個字長得很像，但意思不對。`, reveal: `錯字是「${esc(w.wrong.c)}」，正確是「${esc(w.w[w.wrong.i])}」，圈詞是「${esc(w.w)}」。` });
          if (!again) btns.forEach(x => x.disabled = true);
          return;
        }
        btns.forEach(x => x.disabled = true); b.classList.add('ok');
        const s2 = qa.querySelector('#s2');
        s2.innerHTML = `<p class="q" style="font-size:20px;margin-top:16px">找到了！寫出正確的字：</p>`;
        ciWrite(ctl.L, { w: w.w[w.wrong.i], zy: [w.zy[w.wrong.i]] }, s2, ctl, false);
      });
    }
  };

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
      pd = LearnHW.pad({ onResult: (cands, inkCopy) => {
        if (cands === null) {
          const box = document.createElement('div');
          box.innerHTML = `<p>辨識服務連不上，請爸爸媽媽幫忙看看寫得對不對：<span class="plain" style="font-size:44px">${esc(q.a)}</span></p>
            <div class="row"><button class="btn" data-k="1">寫對了</button><button class="btn ghost" data-k="0">寫錯了</button></div>`;
          qa.append(box);
          box.querySelectorAll('button').forEach(b => b.onclick = () => { box.remove(); if (b.dataset.k === '1') ctl.submit(true); else { if (ctl.submit(false, { hint: charHint(ctl.L, q.a), reveal })) pd.clear(); } });
          return;
        }
        const j = judgeChar(cands, q.a, inkCopy);
        if (j.ok) return ctl.submit(true, j.score != null ? { good: `<small>字形分數：${j.score}</small>` } : null);
        if (j.why !== 'wrong') { const again2 = ctl.submit(false, { hint: judgeMsg(j, null, ctl.L, cands[0], q.a) + ' ' + charHint(ctl.L, q.a), reveal }); pd.clear(); return again2; }
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
      qa.querySelector('#hwb').onclick = () => LearnHW.sheet({
        titleHtml: `<span class="zy">${zy(q.q)}</span>`,
        onDone: text => { if (text) { ta.value += text; ta.focus(); } }
      });
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
