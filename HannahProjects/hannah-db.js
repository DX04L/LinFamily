/**
 * Hannah's Studio：登入（沿用 LinFamily 主站的 Firebase 與權限）＋ 上傳作品。
 * 作品存在 Firestore `hannah_artworks`：{ category, emoji, title, image(壓縮後的 JPEG dataURL), createdAt, createdBy }
 * 可上傳／刪除：Superuser 與 admin_users 裡 active 的 admin。viewer 與未登入只能看。
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const SUPERUSERS = ['darren710404@gmail.com', 'darren.lin@twclc.org'];
  const ICONS = ['👑','🏰','🐠','🌅','📿','🐱','🦄','🧁','🎨','✂️','🧱','💖','🌸','⭐','🐚','🌈','🦋','🐶','🍓','🎀','🌻','🐰','🚀','🧸'];
  const COL = 'hannah_artworks';

  function toast(msg) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
  }

  let auth = null, db = null;
  try {
    if (!firebase.apps.length) firebase.initializeApp({
      apiKey: "AIzaSyBPcURIjgwtEVi_nTaZT569e_nwJb4IsUs",
      authDomain: "linfamily-31cb6.firebaseapp.com",
      projectId: "linfamily-31cb6",
      storageBucket: "linfamily-31cb6.firebasestorage.app",
      messagingSenderId: "299667187224",
      appId: "1:299667187224:web:8df32264698caad761c56d"
    });
    auth = firebase.auth(); db = firebase.firestore();
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
  } catch (err) { console.warn('Firebase 無法啟動', err); return; }

  // ---------- 讀取作品（所有人都看得到） ----------
  db.collection(COL).orderBy('createdAt', 'desc').onSnapshot(snap => {
    dbItems = snap.docs.map(d => {
      const x = d.data(), t = x.createdAt && x.createdAt.toDate ? x.createdAt.toDate() : new Date();
      const date = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0');
      return { id: d.id, raw: x.title || '', title: x.title || t.toLocaleDateString('zh-TW'), category: x.category || 'other', emoji: x.emoji || '✨', image: x.image, date, note: '' };
    });
    render();
  }, err => console.warn('讀取作品失敗', err));

  // ---------- 登入與權限（同 LinFamily） ----------
  let user = null, role = '', roleUnsub = null;
  function applyRole(r) {
    role = r || '';
    window.canEdit = role === 'superuser' || role === 'admin';
    $('lfAuthIcon').textContent = role === 'viewer' ? '👁️' : role === 'user' ? '🙂' : role ? '👑' : '🔐';
    $('lfAuthDot').hidden = !role;
    $('lfMenuHead').textContent = role ? `${user.email} · ${role === 'superuser' ? 'Superuser' : role === 'admin' ? 'Admin' : role === 'user' ? 'User' : 'Viewer（唯讀）'}` : '';
    $('lfUsersItem').hidden = role !== 'superuser';
    if (role === 'user' && window.CLCSSO && window.CLCSSO.blockShare) window.CLCSSO.blockShare(); // User：登入不帶到 DX、YA、SR
    $('addBtn').hidden = !window.canEdit;
    if (!role) setMenu(false);
  }
  auth.onAuthStateChanged(u => {
    if (roleUnsub) { roleUnsub(); roleUnsub = null; }
    user = u && u.email && u.emailVerified ? u : null;
    if (!user) return applyRole('');
    const email = user.email.toLowerCase();
    if (SUPERUSERS.includes(email)) return applyRole('superuser');
    roleUnsub = db.collection('admin_users').doc(email).onSnapshot(snap => {
      const d = snap.exists ? snap.data() : null;
      applyRole(d && d.active !== false && ['admin', 'viewer', 'user'].includes(d.role) ? d.role : '');
    }, () => applyRole(''));
  });
  async function login() {
    try {
      const res = await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      const tok = res.credential && res.credential.idToken;
      const share = () => { if (window.CLCSSO && tok) window.CLCSSO.saveGoogleIdToken(tok); };
      const email = res.user.email.toLowerCase();
      if (SUPERUSERS.includes(email)) { share(); return toast('歡迎回來，' + (res.user.displayName || email)); }
      const snap = await db.collection('admin_users').doc(email).get();
      const d = snap.exists ? snap.data() : null;
      if (d && d.active !== false && d.role === 'user') { if (window.CLCSSO && window.CLCSSO.blockShare) window.CLCSSO.blockShare(); }
      else share(); // User 不保存共用憑證
      if (!(d && d.active !== false && ['admin', 'viewer', 'user'].includes(d.role))) { await auth.signOut(); toast('帳號【' + email + '】沒有權限。'); }
      else toast('歡迎，' + (res.user.displayName || email));
    } catch (err) {
      if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(err && err.code)) toast('登入未完成，請確認瀏覽器允許彈出視窗。');
    }
  }
  const menu = $('lfMenu'), authBtn = $('lfAuthBtn');
  function setMenu(open) { menu.hidden = !open; authBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  authBtn.addEventListener('click', () => { if (!role) login(); else setMenu(menu.hidden); });
  document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target) && !authBtn.contains(e.target)) setMenu(false); });
  menu.addEventListener('click', async e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    setMenu(false);
    if (b.dataset.act === 'logout') { if (confirm('確定要登出嗎？')) { await auth.signOut(); toast('已登出'); } }
    else if (b.dataset.act === 'users') location.href = '../admin-users.html?back=HannahProjects/home';
  });

  // ---------- Add Artwork：分類 → 圖示 → 拍照（網站內相機）→ 旋轉／裁切 → 上傳 ----------
  const dlg = $('addDlg'), vid = $('camVid'), cv = $('editCv'), box = $('editBox'), cropEl = $('crop');
  let pick = {}, editId = null, stream = null, facing = 'environment', cr = { x: 0, y: 0, w: 1, h: 1 };
  function step(n) {
    ['st1', 'st2', 'st3', 'st4'].forEach((id, i) => $(id).hidden = i !== n - 1);
    $('addGo').hidden = n !== 4;
    $('addGo').textContent = editId ? 'Save ✨' : 'Upload ✨';
    $('addBack').textContent = n === 1 || (editId && n === 4) ? 'Cancel' : '‹ Back';
    $('st4Step').textContent = editId ? 'Rotate or crop' : '4 / 4 · Rotate or crop';
    dlg.dataset.step = n;
    if (n === 3) startCam(); else stopCam();
  }
  $('iconPick').innerHTML = ICONS.map(i => `<button type="button" data-ic="${i}">${i}</button>`).join('');
  $('addBtn').addEventListener('click', () => { pick = {}; editId = null; $('titleIn').value = ''; step(1); dlg.showModal(); });
  dlg.addEventListener('close', stopCam);
  dlg.querySelector('.cats').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) { pick.category = b.dataset.cat; step(2); } });
  $('iconPick').addEventListener('click', e => {
    const b = e.target.closest('[data-ic]'); if (!b) return;
    pick.emoji = b.dataset.ic; $('chosen').textContent = pick.emoji + ' ' + labels[pick.category]; step(3);
  });
  $('addBack').addEventListener('click', () => { const n = +dlg.dataset.step; if (n > 1 && !(editId && n === 4)) step(n - 1); else dlg.close(); });

  // 相機
  async function startCam() {
    stopCam(); $('camMsg').hidden = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 } }, audio: false });
      vid.srcObject = stream; vid.classList.toggle('mirror', facing === 'user');
    } catch (_) { $('camMsg').hidden = false; }
  }
  function stopCam() { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } vid.srcObject = null; }
  $('flipCam').addEventListener('click', () => { facing = facing === 'user' ? 'environment' : 'user'; startCam(); });
  $('shutter').addEventListener('click', () => {
    if (!stream || !vid.videoWidth) return toast('相機還沒準備好');
    const c = document.createElement('canvas'); c.width = vid.videoWidth; c.height = vid.videoHeight;   // 直拍就是直的
    c.getContext('2d').drawImage(vid, 0, 0); toEditor(c); step(4);
  });
  $('albIn').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => { URL.revokeObjectURL(url); toEditor(img); step(4); };
    img.onerror = () => { URL.revokeObjectURL(url); toast('這張照片讀不到，請換一張。'); };
    img.src = url;
  });

  // 編輯：旋轉、裁切
  function toEditor(src) {
    const W = src.naturalWidth || src.width, H = src.naturalHeight || src.height, k = Math.min(1, 1600 / Math.max(W, H));
    cv.width = Math.round(W * k); cv.height = Math.round(H * k);
    cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height); setCrop({ x: 0, y: 0, w: 1, h: 1 });
  }
  function setCrop(c) { cr = c; Object.assign(cropEl.style, { left: c.x * 100 + '%', top: c.y * 100 + '%', width: c.w * 100 + '%', height: c.h * 100 + '%' }); }
  function rotate(dir) {
    const t = document.createElement('canvas'); t.width = cv.height; t.height = cv.width;
    const g = t.getContext('2d'); g.translate(t.width / 2, t.height / 2); g.rotate(dir * Math.PI / 2); g.drawImage(cv, -cv.width / 2, -cv.height / 2);
    cv.width = t.width; cv.height = t.height; cv.getContext('2d').drawImage(t, 0, 0); setCrop({ x: 0, y: 0, w: 1, h: 1 });
  }
  dlg.querySelector('.tools').addEventListener('click', e => {
    const t = e.target.closest('[data-t]'); if (!t) return;
    if (t.dataset.t === 'l') rotate(-1); else if (t.dataset.t === 'r') rotate(1); else setCrop({ x: 0, y: 0, w: 1, h: 1 });
  });
  let drag = null;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  box.addEventListener('pointerdown', e => {
    if (!e.target.closest('.crop')) return;
    drag = { hd: e.target.dataset.h || 'move', sx: e.clientX, sy: e.clientY, c: { ...cr }, W: box.clientWidth, H: box.clientHeight };
    box.setPointerCapture(e.pointerId); e.preventDefault();
  });
  box.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = (e.clientX - drag.sx) / drag.W, dy = (e.clientY - drag.sy) / drag.H, m = 0.1, hd = drag.hd;
    let { x, y, w, h } = drag.c;
    if (hd === 'move') { x = clamp(x + dx, 0, 1 - w); y = clamp(y + dy, 0, 1 - h); }
    else {
      if (hd.includes('w')) { const nx = clamp(x + dx, 0, x + w - m); w += x - nx; x = nx; }
      if (hd.includes('e')) w = clamp(w + dx, m, 1 - x);
      if (hd.includes('n')) { const ny = clamp(y + dy, 0, y + h - m); h += y - ny; y = ny; }
      if (hd.includes('s')) h = clamp(h + dy, m, 1 - y);
    }
    setCrop({ x, y, w, h });
  });
  ['pointerup', 'pointercancel'].forEach(ev => box.addEventListener(ev, () => { drag = null; }));

  // 輸出：裁切 → 長邊 1280px JPEG，控制在約 900KB 以內（Firestore 單筆上限 1MB）
  function exportImage() {
    const sx = cr.x * cv.width, sy = cr.y * cv.height, sw = cr.w * cv.width, sh = cr.h * cv.height;
    let max = 1280, out = '';
    for (let tries = 0; tries < 3; tries++) {
      const k = Math.min(1, max / Math.max(sw, sh)), c = document.createElement('canvas');
      c.width = Math.round(sw * k); c.height = Math.round(sh * k);
      c.getContext('2d').drawImage(cv, sx, sy, sw, sh, 0, 0, c.width, c.height);
      for (let q = 0.82; q >= 0.45; q -= 0.12) { out = c.toDataURL('image/jpeg', q); if (out.length < 900000) return out; }
      max = Math.round(max * 0.75);
    }
    return out;
  }

  $('addGo').addEventListener('click', async () => {
    if (!window.canEdit) return;
    const go = $('addGo'), label = go.textContent; go.disabled = true; go.textContent = 'Saving…';
    try {
      const image = exportImage(), title = $('titleIn').value.trim();
      if (editId) await db.collection(COL).doc(editId).update({ image, title });
      else await db.collection(COL).add({
        category: pick.category, emoji: pick.emoji, title, image,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: user.email
      });
      dlg.close(); toast(editId ? 'Saved! ✨' : 'Uploaded! 🎉');
      if (!editId) $('gallery-section').scrollIntoView({ behavior: 'smooth' });
    } catch (err) { console.warn(err); toast('儲存失敗：' + (err.code === 'permission-denied' ? '沒有權限' : '請再試一次')); }
    go.disabled = false; go.textContent = label;
  });

  window.editArtwork = p => {
    if (!window.canEdit) return;
    const img = new Image();
    img.onload = () => { editId = p.id; pick = { category: p.category, emoji: p.emoji }; $('titleIn').value = p.raw || ''; toEditor(img); step(4); dlg.showModal(); };
    img.src = p.image;
  };

  window.deleteArtwork = async p => {
    if (!window.canEdit || !confirm('Delete "' + p.title + '"?')) return;
    try { await db.collection(COL).doc(p.id).delete(); close(); toast('Deleted'); }
    catch (_) { toast('刪除失敗'); }
  };
})();
