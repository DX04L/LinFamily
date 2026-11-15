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
      return { id: d.id, title: x.title || t.toLocaleDateString('zh-TW'), category: x.category || 'other', emoji: x.emoji || '✨', image: x.image, date, note: '' };
    });
    render();
  }, err => console.warn('讀取作品失敗', err));

  // ---------- 登入與權限（同 LinFamily） ----------
  let user = null, role = '', roleUnsub = null;
  function applyRole(r) {
    role = r || '';
    window.canEdit = role === 'superuser' || role === 'admin';
    $('lfAuthIcon').textContent = role === 'viewer' ? '👁️' : role ? '👑' : '🔐';
    $('lfAuthDot').hidden = !role;
    $('lfMenuHead').textContent = role ? `${user.email} · ${role === 'superuser' ? 'Superuser' : role === 'admin' ? 'Admin' : 'Viewer（唯讀）'}` : '';
    $('lfUsersItem').hidden = role !== 'superuser';
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
      applyRole(d && d.active !== false && (d.role === 'admin' || d.role === 'viewer') ? d.role : '');
    }, () => applyRole(''));
  });
  async function login() {
    try {
      const res = await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      if (window.CLCSSO && res.credential && res.credential.idToken) window.CLCSSO.saveGoogleIdToken(res.credential.idToken);
      const email = res.user.email.toLowerCase();
      if (SUPERUSERS.includes(email)) return toast('歡迎回來，' + (res.user.displayName || email));
      const snap = await db.collection('admin_users').doc(email).get();
      const d = snap.exists ? snap.data() : null;
      if (!(d && d.active !== false && (d.role === 'admin' || d.role === 'viewer'))) { await auth.signOut(); toast('帳號【' + email + '】沒有權限。'); }
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
    else if (b.dataset.act === 'users') location.href = '../users.html?back=HannahProjects/home';
  });

  // ---------- Add Artwork：分類 → 圖示 → 拍照 → 上傳 ----------
  const dlg = $('addDlg');
  let pick = {}, imgData = '';
  function step(n) {
    ['st1', 'st2', 'st3'].forEach((id, i) => $(id).hidden = i !== n - 1);
    $('addGo').hidden = n !== 3 || !imgData;
    $('addBack').textContent = n === 1 ? 'Cancel' : '‹ Back';
    dlg.dataset.step = n;
  }
  $('iconPick').innerHTML = ICONS.map(i => `<button type="button" data-ic="${i}">${i}</button>`).join('');
  $('addBtn').addEventListener('click', () => {
    pick = {}; imgData = ''; $('prev').hidden = true; $('titleIn').value = ''; step(1); dlg.showModal();
  });
  dlg.querySelector('.cats').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) { pick.category = b.dataset.cat; step(2); } });
  $('iconPick').addEventListener('click', e => {
    const b = e.target.closest('[data-ic]'); if (!b) return;
    pick.emoji = b.dataset.ic; $('chosen').textContent = pick.emoji + ' ' + labels[pick.category]; step(3);
  });
  $('addBack').addEventListener('click', () => { const n = +dlg.dataset.step; if (n > 1) step(n - 1); else dlg.close(); });

  // 壓縮：長邊 1280px JPEG，控制在約 900KB 以內（Firestore 單筆上限 1MB）
  function compress(file) {
    return new Promise((ok, bad) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let max = 1280, out = '';
        for (let tries = 0; tries < 3; tries++) {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          for (let q = 0.82; q >= 0.45; q -= 0.12) { out = c.toDataURL('image/jpeg', q); if (out.length < 900000) return ok(out); }
          max = Math.round(max * 0.75);
        }
        ok(out);
      };
      img.onerror = () => { URL.revokeObjectURL(url); bad(new Error('bad image')); };
      img.src = url;
    });
  }
  async function onFile(e) {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { imgData = await compress(f); $('prev').src = imgData; $('prev').hidden = false; $('addGo').hidden = false; }
    catch (_) { toast('這張照片讀不到，請換一張。'); }
  }
  $('camIn').addEventListener('change', onFile);
  $('albIn').addEventListener('change', onFile);

  $('addGo').addEventListener('click', async () => {
    if (!imgData || !window.canEdit) return;
    const go = $('addGo'); go.disabled = true; go.textContent = 'Uploading…';
    try {
      await db.collection(COL).add({
        category: pick.category, emoji: pick.emoji, title: $('titleIn').value.trim(), image: imgData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: user.email
      });
      dlg.close(); toast('Uploaded! 🎉');
      document.getElementById('gallery-section').scrollIntoView({ behavior: 'smooth' });
    } catch (err) { console.warn(err); toast('上傳失敗：' + (err.code === 'permission-denied' ? '沒有權限' : '請再試一次')); }
    go.disabled = false; go.textContent = 'Upload ✨';
  });

  window.deleteArtwork = async p => {
    if (!window.canEdit || !confirm('Delete "' + p.title + '"?')) return;
    try { await db.collection(COL).doc(p.id).delete(); close(); toast('Deleted'); }
    catch (_) { toast('刪除失敗'); }
  };
})();
