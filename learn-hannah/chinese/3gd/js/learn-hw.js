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
      ctx.lineWidth = Math.max(6, size / 38); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const st of ink) {
        ctx.beginPath();
        st[0].forEach((x, i) => i ? ctx.lineTo(x, st[1][i]) : ctx.moveTo(x, st[1][i]));
        if (st[0].length === 1) ctx.lineTo(st[0][0] + .1, st[1][0]);
        ctx.stroke();
      }
    }
    function pos(e) { const r = cv.getBoundingClientRect(); return [Math.round(e.clientX - r.left), Math.round(e.clientY - r.top)]; }
    cv.addEventListener('pointerdown', e => {
      e.preventDefault(); cv.setPointerCapture(e.pointerId);
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

    async function recognize() {
      if (!ink.length) return [];
      const t0 = ink[0][2][0];
      const body = {
        options: 'enable_pre_space',
        requests: [{ writing_guide: { writing_area_width: size, writing_area_height: size },
          ink: ink.map(s => [s[0], s[1], s[2].map(t => t - t0)]), language: 'zh_TW' }]
      };
      try {
        const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const j = await r.json();
        if (j[0] !== 'SUCCESS') return null;
        return (j[1][0][1] || []).filter(c => c && c.length === 1);
      } catch (e) { return null; }
    }
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

  window.LearnHW = { pad, zhuyin, normZy };
})();
