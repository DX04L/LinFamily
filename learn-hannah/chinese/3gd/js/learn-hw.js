/**
 * 手寫板（Google 手寫辨識）＋ 注音鍵盤。
 * LearnHW.pad({ guide, onResult(cands|null) }) → { el, clear(), recognize() }
 * LearnHW.zhuyin({ onChange(str) }) → { el, value() }
 */
(function () {
  'use strict';
  const API = 'https://inputtools.google.com/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8';

  function h(tag, attrs, html) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }

  // 用過觸控筆（S Pen、Apple Pencil）之後，手指／手掌的觸碰不畫線（防誤觸）
  let penSeen = false;
  function palmReject(e) {
    if (e.pointerType === 'pen') { penSeen = true; return false; }
    return penSeen && e.pointerType === 'touch';
  }
  async function recognizeInk(strokes, w, h) {
    const t0 = strokes[0][2][0];
    const body = {
      options: 'enable_pre_space',
      requests: [{ writing_guide: { writing_area_width: Math.round(w), writing_area_height: Math.round(h) },
        ink: strokes.map(s => [s[0], s[1], s[2].map(t => t - t0)]), language: 'zh_TW' }]
    };
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (j[0] !== 'SUCCESS') return null;
      return (j[1][0][1] || []).filter(c => c && c.length === 1);
    } catch (e) { return null; }
  }

  function pad(opt) {
    opt = opt || {};
    const el = h('div', { class: 'hw' });
    const cv = h('canvas');
    const cands = h('div', { class: 'cands' });
    const bar = h('div', { class: 'row' });
    const bClear = h('button', { class: 'btn ghost', type: 'button' }, '重寫');
    const bUndo = h('button', { class: 'btn ghost', type: 'button' }, '↶');
    const bOk = h('button', { class: 'btn', type: 'button' }, opt.okText || '寫好了');
    bar.append(bUndo, bClear, bOk);
    el.append(cv, bar, cands);

    let ink = [], cur = null, size = 0, ctx;
    const dark = () => document.documentElement.classList.contains('dark');

    function setup() {
      const r = cv.getBoundingClientRect();
      size = Math.round(r.width) || 300;
      const dpr = window.devicePixelRatio || 1;
      cv.width = size * dpr; cv.height = size * dpr;
      ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    }
    function grid() {
      const s = size;
      ctx.save();
      ctx.strokeStyle = dark() ? '#3a3a3a' : '#E6DFD2'; ctx.lineWidth = 1; ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(s / 2, 0); ctx.lineTo(s / 2, s); ctx.moveTo(0, s / 2); ctx.lineTo(s, s / 2);
      ctx.moveTo(0, 0); ctx.lineTo(s, s); ctx.moveTo(s, 0); ctx.lineTo(0, s);
      ctx.stroke(); ctx.restore();
      if (opt.guide) {
        ctx.save();
        ctx.fillStyle = dark() ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.10)';
        ctx.font = `${Math.round(s * .78)}px "PingFang TC","Microsoft JhengHei","Noto Sans TC",sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(opt.guide, s / 2, s / 2 + s * .03);
        ctx.restore();
      }
    }
    function redraw() {
      ctx.clearRect(0, 0, size, size); grid();
      ctx.strokeStyle = dark() ? '#EDEDED' : '#1C1C1C';
      ctx.lineWidth = Math.max(3, size / 75); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const st of ink) {
        ctx.beginPath();
        st[0].forEach((x, i) => i ? ctx.lineTo(x, st[1][i]) : ctx.moveTo(x, st[1][i]));
        if (st[0].length === 1) ctx.lineTo(st[0][0] + .1, st[1][0]);
        ctx.stroke();
      }
    }
    function pos(e) { const r = cv.getBoundingClientRect(); return [Math.round(e.clientX - r.left), Math.round(e.clientY - r.top)]; }
    cv.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (palmReject(e)) return;
      cv.setPointerCapture(e.pointerId);
      const [x, y] = pos(e); cur = [[x], [y], [Date.now()]]; ink.push(cur); redraw();
    });
    cv.addEventListener('pointermove', e => {
      if (!cur) return; e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs) { const [x, y] = pos(ev); cur[0].push(x); cur[1].push(y); cur[2].push(Date.now()); }
      redraw();
    });
    const end = () => { cur = null; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);

    function clear() { ink = []; cands.innerHTML = ''; redraw(); }
    bClear.onclick = clear;
    bUndo.onclick = () => { ink.pop(); redraw(); };

    async function recognize() { return ink.length ? recognizeInk(ink, size, size) : []; }
    bOk.onclick = async () => {
      if (!ink.length) return window.LearnToast && LearnToast('先寫字喔');
      bOk.disabled = true;
      const c = await recognize();
      bOk.disabled = false;
      opt.onResult && opt.onResult(c);
    };
    function showCands(list, onPick) {
      cands.innerHTML = '';
      list.slice(0, 8).forEach(ch => {
        const b = h('button', { class: 'cand', type: 'button' }); b.textContent = ch;
        b.onclick = () => onPick(ch); cands.append(b);
      });
    }

    requestAnimationFrame(setup);
    window.addEventListener('resize', () => el.isConnected && setup());
    return { el, clear, recognize, showCands, setGuide(g) { opt.guide = g; redraw(); }, get empty() { return !ink.length; } };
  }

  const INITIALS = 'ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙ';
  const MEDIALS = 'ㄧㄨㄩ';
  const FINALS = 'ㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦ';
  const TONES = ['ˊ', 'ˇ', 'ˋ', '˙'];

  function zhuyin(opt) {
    opt = opt || {};
    const el = h('div');
    const out = h('div', { class: 'zyout' });
    const kb = h('div', { class: 'zykb' });
    let v = '';
    const set = s => { v = s; out.textContent = v || '　'; opt.onChange && opt.onChange(v); };
    [...INITIALS, ...MEDIALS, ...FINALS].forEach(k => {
      const b = h('button', { type: 'button' }); b.textContent = k; b.onclick = () => set(v + k); kb.append(b);
    });
    TONES.forEach(k => {
      const b = h('button', { type: 'button', class: 'tone' }); b.textContent = k === '˙' ? '˙ 輕' : k; b.onclick = () => set(v + k); kb.append(b);
    });
    const del = h('button', { type: 'button', class: 'tone' }, '⌫'); del.onclick = () => set([...v].slice(0, -1).join(''));
    kb.append(del);
    el.append(out, kb); set('');
    return { el, value: () => v };
  }

  // 比對注音：一聲不寫聲調；輕聲符號可在前或後
  function normZy(s) {
    s = (s || '').replace(/\s/g, '').replace(/ˉ/g, '');
    if (s.startsWith('˙')) s = s.slice(1) + '˙';
    return s;
  }

  // ---------- 全螢幕稿紙：直書、由右到左、一格一字；每格分開辨識再串成句子 ----------
  const SMALL_DOT = ['o', 'O', '0', '○', '°', '。', '口', '•', '·'];
  const SMALL_COMMA = [',', '，', '、', "'", '丶', '`', '.', '1', 'l', '|', '/', '\\'];
  function sheet(opt) {
    opt = opt || {};
    const ov = h('div', { class: 'sheet' });
    ov.innerHTML = '<div class="sheet-top"><div class="sheet-q"></div><div class="sheet-bar"></div></div><div class="sheet-grid"><canvas></canvas></div><div class="sheet-cands" hidden></div>';
    ov.querySelector('.sheet-q').innerHTML = opt.titleHtml || '';
    const bar = ov.querySelector('.sheet-bar'), wrap = ov.querySelector('.sheet-grid'), cv = ov.querySelector('canvas'), candBar = ov.querySelector('.sheet-cands');
    document.body.append(ov); document.body.classList.add('sheet-open');
    const fs = document.documentElement.requestFullscreen && window.matchMedia('(pointer: coarse)').matches;
    if (fs) document.documentElement.requestFullscreen().catch(() => {});
    const dark = () => document.documentElement.classList.contains('dark');

    let cols = 0, rows = 0, bs = 0, right = 0, top = 0, W = 0, H = 0, ctx;
    const pages = [[]];            // 每頁：[{ box, pts:[[x],[y],[t]] }]，座標以格子邊長為 1
    let pg = 0, mode = 'edit', cur = null, sel = -1, busy = false;
    const res = {};                // `${頁}-${格}` → { c, cands }
    const key = (p, i) => p + '-' + i;

    function layout() {
      const r = wrap.getBoundingClientRect(); W = r.width; H = r.height;
      if (!cols) {
        cols = W < 600 ? 3 : Math.max(3, Math.min(8, Math.floor(W / 170)));
        const b = Math.min((W - 16) / cols, (H - 16) / 2);
        rows = Math.max(2, Math.floor((H - 16) / b));
      }
      bs = Math.floor(Math.min((W - 16) / cols, (H - 16) / rows));
      right = Math.round((W + cols * bs) / 2); top = Math.round((H - rows * bs) / 2);
      const dpr = window.devicePixelRatio || 1;
      cv.width = W * dpr; cv.height = H * dpr; ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
    const boxXY = i => [right - (Math.floor(i / rows) + 1) * bs, top + (i % rows) * bs];
    function boxAt(x, y) {
      const c = Math.floor((right - x) / bs), r = Math.floor((y - top) / bs);
      return c < 0 || c >= cols || r < 0 || r >= rows ? -1 : c * rows + r;
    }
    const strokesOf = (p, i) => pages[p].filter(s => s.box === i);

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const line = dark() ? '#4a4a4a' : '#CFC6B5', soft = dark() ? '#333' : '#E8E1D3';
      for (let i = 0; i < cols * rows; i++) {
        const [x, y] = boxXY(i);
        ctx.setLineDash([5, 6]); ctx.strokeStyle = soft; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + bs / 2, y); ctx.lineTo(x + bs / 2, y + bs); ctx.moveTo(x, y + bs / 2); ctx.lineTo(x + bs, y + bs / 2); ctx.stroke();
        ctx.setLineDash([]); ctx.strokeStyle = i === sel ? '#E8836B' : line; ctx.lineWidth = i === sel ? 3 : 1.5;
        ctx.strokeRect(x + .5, y + .5, bs - 1, bs - 1);
      }
      ctx.strokeStyle = dark() ? '#EDEDED' : '#1C1C1C'; ctx.lineWidth = Math.max(2.5, bs / 34); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const s of pages[pg]) {
        const [x, y] = boxXY(s.box);
        ctx.beginPath();
        s.pts[0].forEach((px, k) => { const X = x + px * bs, Y = y + s.pts[1][k] * bs; k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
        if (s.pts[0].length === 1) ctx.lineTo(x + s.pts[0][0] * bs + .1, y + s.pts[1][0] * bs);
        ctx.stroke();
      }
      if (mode === 'review') {
        ctx.font = `700 ${Math.round(bs * .2)}px "PingFang TC","Microsoft JhengHei",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let i = 0; i < cols * rows; i++) {
          const r = res[key(pg, i)]; if (!r) continue;
          const [x, y] = boxXY(i), cx = x + bs * .16, cy = y + bs * .16;
          ctx.fillStyle = '#E8836B'; ctx.beginPath(); ctx.arc(cx, cy, bs * .14, 0, 7); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.fillText(r.c, cx, cy + 1);
        }
      }
    }

    function pos(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    cv.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (palmReject(e) || busy) return;
      const [x, y] = pos(e), i = boxAt(x, y);
      if (i < 0) return;
      if (mode === 'review') { pick(i); return; }
      cv.setPointerCapture(e.pointerId);
      const [bx, by] = boxXY(i);
      cur = { box: i, pts: [[(x - bx) / bs], [(y - by) / bs], [Date.now()]] };
      pages[pg].push(cur); delete res[key(pg, i)]; draw();
    });
    cv.addEventListener('pointermove', e => {
      if (!cur) return; e.preventDefault();
      const [bx, by] = boxXY(cur.box);
      for (const ev of (e.getCoalescedEvents ? e.getCoalescedEvents() : [e])) {
        const [x, y] = pos(ev); cur.pts[0].push((x - bx) / bs); cur.pts[1].push((y - by) / bs); cur.pts[2].push(Date.now());
      }
      draw();
    });
    const end = () => { cur = null; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);

    function btn(text, cls, fn, dis) { const b = h('button', { class: 'btn ' + (cls || ''), type: 'button' }); b.textContent = text; b.onclick = fn; if (dis) b.disabled = true; bar.append(b); return b; }
    function renderBar() {
      bar.innerHTML = '';
      if (mode === 'edit') {
        btn('取消', 'ghost', close);
        btn('↶', 'ghost', () => { const s = pages[pg].pop(); if (s) delete res[key(pg, s.box)]; draw(); });
        btn('清除', 'ghost', () => { pages[pg].forEach(s => delete res[key(pg, s.box)]); pages[pg] = []; draw(); });
        btn('‹', 'ghost', () => { pg--; renderBar(); draw(); }, pg === 0);
        const n = h('span', { class: 'sheet-pg' }); n.textContent = `${pg + 1}/${pages.length}`; bar.append(n);
        btn('›', 'ghost', () => { if (pg === pages.length - 1) { if (!pages[pg].length) return; pages.push([]); } pg++; renderBar(); draw(); });
        bar.append(h('span', { class: 'spacer' }));
        btn('辨識', '', recognizeAll);
      } else {
        btn('‹ 繼續寫', 'ghost', () => { mode = 'edit'; sel = -1; candBar.hidden = true; renderBar(); draw(); });
        bar.append(h('span', { class: 'spacer' }));
        btn('完成 ✓', '', finish);
      }
    }
    function textAll() {
      let t = '';
      pages.forEach((p, pi) => { for (let i = 0; i < cols * rows; i++) { const r = res[key(pi, i)]; if (r && r.c) t += r.c; } });
      return t;
    }
    function showText() {
      candBar.hidden = false;
      candBar.innerHTML = `<span class="sheet-res">讀到：<b>${textAll() || '（空白）'}</b></span><small>點格子可以換字</small>`;
    }
    function pick(i) {
      const r = res[key(pg, i)]; if (!r) return;
      sel = i; draw();
      candBar.hidden = false; candBar.innerHTML = '';
      [...new Set([r.c, ...r.cands])].slice(0, 8).forEach(c => {
        const b = h('button', { class: 'cand', type: 'button' }); b.textContent = c;
        b.onclick = () => { r.c = c; sel = -1; draw(); showText(); }; candBar.append(b);
      });
      const del = h('button', { class: 'btn ghost', type: 'button' }); del.textContent = '這格不要';
      del.onclick = () => { r.c = ''; sel = -1; draw(); showText(); }; candBar.append(del);
    }
    async function recognizeAll() {
      const jobs = [];
      pages.forEach((p, pi) => {
        const boxes = [...new Set(p.map(s => s.box))];
        boxes.forEach(i => {
          if (res[key(pi, i)]) return;
          const ss = strokesOf(pi, i), S = 200;
          const xs = ss.flatMap(s => s.pts[0]), ys = ss.flatMap(s => s.pts[1]);
          const small = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) < .38;
          const ink = ss.map(s => [s.pts[0].map(v => Math.round(v * S)), s.pts[1].map(v => Math.round(v * S)), s.pts[2]]);
          jobs.push(recognizeInk(ink, S, S).then(c => {
            if (c === null) throw new Error('net');
            let top = c[0] || '？';
            if (small && SMALL_DOT.includes(top)) top = '。';
            else if (small && SMALL_COMMA.includes(top)) top = '，';
            res[key(pi, i)] = { c: top, cands: c };
          }));
        });
      });
      if (!pages.some(p => p.length)) return window.LearnToast && LearnToast('先寫字喔');
      busy = true; bar.querySelectorAll('button').forEach(b => b.disabled = true);
      try { await Promise.all(jobs); mode = 'review'; showText(); }
      catch (e) { window.LearnToast && LearnToast('辨識服務連不上，請改用鍵盤輸入'); }
      busy = false; renderBar(); draw();
    }
    function finish() { const t = textAll(); close(); opt.onDone && opt.onDone(t); }
    function close() {
      window.removeEventListener('resize', layout);
      ov.remove(); document.body.classList.remove('sheet-open');
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
    window.addEventListener('resize', layout);
    renderBar();
    requestAnimationFrame(() => requestAnimationFrame(layout));
    return { close };
  }

  window.LearnHW = { pad, sheet, zhuyin, normZy };
})();
