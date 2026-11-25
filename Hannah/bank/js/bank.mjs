const $ = id => document.getElementById(id);
const money = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' });
const form = $('entry-form'), entryDialog = $('entry-dialog');
const entryFields = form.elements;
const SUPERUSERS = ['darren710404@gmail.com', 'darren.lin@twclc.org'];
const defaultLabels = ['零用錢', '獎學金'];

function totals(rows) {
  return rows.reduce((sum, row) => {
    sum[row.kind] += row.amount;
    return sum;
  }, { income: 0, expense: 0 });
}

let db, auth, ref, unsubscribe, entries = [], recentLabels = [], editing;
let canEdit = false, editMode = false;
let session = 0;
function gate(message, canSignIn = false) {
  $('ledger').hidden = true;
  $('gate').hidden = false;
  $('gate-message').textContent = message;
  $('sign-in').hidden = !canSignIn;
}
function render() {
  const sum = totals(entries);
  $('balance').textContent = money.format(sum.income - sum.expense);
  for (const field of ['income', 'expense']) $(field).textContent = money.format(sum[field]);
  const list = entries.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.created - a.created);
  $('entries').replaceChildren(...list.map(row => {
    const li = document.createElement('li');
    li.innerHTML = '<div class="entry"><span><strong></strong><small></small></span><b></b></div>';
    const line = li.firstElementChild;
    line.querySelector('strong').textContent = row.label;
    line.querySelector('small').textContent = row.date || row.legacyDate + ' · 舊帳';
    const amount = line.querySelector('b');
    amount.className = row.kind;
    amount.textContent = (row.kind === 'income' ? '+' : '−') + money.format(row.amount);
    if (canEdit && editMode) {
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'quiet edit-entry';
      edit.setAttribute('aria-label', '修改 ' + row.label);
      edit.textContent = '修改';
      edit.onclick = () => openEntry(row);
      line.append(edit);
    }
    return li;
  }));
  $('empty').hidden = !!entries.length;
}

async function save(change) {
  const accountRef = ref;
  if (!accountRef) throw new Error('請先登入。');
  await db.runTransaction(async tx => {
    const snap = await tx.get(accountRef);
    const current = snap.data()?.hannahBank || { entries: [] };
    const next = change(current);
    if (!next) return;
    if (new TextEncoder().encode(JSON.stringify(next)).length > 420000) throw new Error('帳本容量已滿。');
    tx.set(accountRef, { hannahBank: next }, { mergeFields: ['hannahBank'] });
  });
}

function renderSuggestions() {
  const input = entryFields.label;
  const query = input.value.trim().toLowerCase();
  const previous = entries.slice().sort((a, b) => b.created - a.created).map(row => row.label);
  const labels = [...new Set([...defaultLabels, ...recentLabels, ...previous])]
    .filter(label => defaultLabels.includes(label) || label.toLowerCase().includes(query)).slice(0, 7);
  $('suggestions').replaceChildren(...labels.map(label => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.onclick = () => { input.value = label; input.focus(); renderSuggestions(); };
    return button;
  }));
}
entryFields.label.addEventListener('input', renderSuggestions);

function openEntry(row) {
  if (!ref || (row && (!canEdit || !editMode))) return;
  editing = row || null;
  form.reset();
  $('entry-heading').textContent = row ? '修改紀錄' : '新增一筆';
  $('save-entry').textContent = row ? '確認送出' : '儲存';
  if (row) entryFields.kind.value = row.kind;
  entryFields.label.value = row?.label || '';
  entryFields.amount.value = row?.amount ?? '';
  entryFields.date.value = row ? row.date || '' : dateFormat.format(new Date());
  entryFields.date.required = !row?.legacyDate;
  $('old-date').hidden = !row?.legacyDate;
  $('old-date').textContent = row?.legacyDate ? '原始日期：' + row.legacyDate : '';
  $('delete').hidden = !row;
  renderSuggestions();
  form.querySelector('.message').textContent = '';
  entryDialog.showModal();
}

async function changeEntry(remove = false) {
  const previous = editing;
  if (!ref || ((previous || remove) && (!canEdit || !editMode))) return;
  const row = {
    id: previous?.id || crypto.randomUUID(),
    kind: entryFields.kind.value,
    label: entryFields.label.value.trim(),
    amount: Number(entryFields.amount.value),
    date: entryFields.date.value,
    created: previous?.created ?? Date.now()
  };
  if (!row.date && previous?.legacyDate) row.legacyDate = previous.legacyDate;
  if (!remove && (!row.label || !Number.isInteger(row.amount) || row.amount < 1)) {
    form.querySelector('.message').textContent = '請填寫項目與有效金額。';
    return;
  }
  const active = session;
  const controls = Array.from(form.querySelectorAll('button'));
  controls.forEach(button => { button.disabled = true; });
  try {
    await save(current => {
      if (previous && !current.entries.some(entry => entry.id === row.id)) throw new Error('這筆紀錄已移除，請重新整理。');
      const next = current.entries.filter(entry => entry.id !== row.id);
      if (!remove) next.push(row);
      const history = current.recentLabels || [];
      const recent = remove ? history : [row.label, ...history.filter(label => label !== row.label)].slice(0, 30);
      return { ...current, entries: next, recentLabels: recent };
    });
    if (active === session) {
      entryDialog.close();
      $('notice').textContent = remove ? '紀錄已刪除。' : '已儲存。';
    }
  } catch (error) {
    if (active === session) form.querySelector('.message').textContent = error.message || '儲存失敗，請再試一次。';
  } finally {
    controls.forEach(button => { button.disabled = false; });
  }
}

function setEditMode(enabled) {
  editMode = canEdit && enabled;
  const button = $('edit-mode');
  button.hidden = !canEdit;
  button.setAttribute('aria-pressed', String(editMode));
  button.textContent = editMode ? '完成編輯' : '編輯';
}
$('edit-mode').onclick = () => {
  if (!canEdit || !ref) return;
  setEditMode(!editMode);
  render();
};
$('add').onclick = () => openEntry();
form.onsubmit = event => { event.preventDefault(); changeEntry(); };
$('delete').onclick = () => {
  if (confirm('確定刪除這筆記帳紀錄？')) changeEntry(true);
};
document.querySelectorAll('[data-close]').forEach(button => {
  button.onclick = () => button.closest('dialog').close();
});

async function start() {
  const config = await fetch('../../clc-site.json').then(response => {
    if (!response.ok) throw new Error('LinFamily 設定載入失敗。');
    return response.json();
  });
  firebase.initializeApp(config.firebase);
  auth = firebase.auth();
  db = firebase.firestore();
  $('sign-in').onclick = async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try { await auth.signInWithPopup(provider); }
    catch (_) { gate('登入未完成，請重試或先從 LinFamily 首頁登入。', true); }
  };
  auth.onAuthStateChanged(user => {
    const email = user?.emailVerified && user.email ? user.email.toLowerCase() : '';
    canEdit = SUPERUSERS.includes(email);
    setEditMode(false);
    watchLedger(email);
  });
}
function isOldTestPrize(row) {
  return row.label === 'Prize for Test' && (row.legacyDate || /^[a-f0-9]{64}-[0-9]+$/.test(row.id));
}
function renameOldTestPrizes(bank) {
  if (!bank.entries.some(isOldTestPrize)) return;
  return {
    ...bank,
    entries: bank.entries.map(row => isOldTestPrize(row) ? { ...row, label: '獎學金' } : row)
  };
}
function watchLedger(email) {
  const active = ++session;
  unsubscribe?.();
  ref = null;
  entries = [];
  recentLabels = [];
  entryDialog.close();
  $('entries').replaceChildren();
  $('notice').textContent = '';
  if (!email) {
    gate('使用 LinFamily 的 Google 帳號登入，就能開啟帳本。', true);
    return;
  }
  gate('正在讀取帳本…');
  const accountRef = db.collection('linfamily_desktops').doc(email);
  let renamingOldPrizes = false;
  unsubscribe = accountRef.onSnapshot(snap => {
    if (active !== session) return;
    const bank = snap.data()?.hannahBank;
    ref = accountRef;
    entries = bank?.entries || [];
    recentLabels = bank?.recentLabels || [];
    if (!renamingOldPrizes && entries.some(isOldTestPrize)) {
      renamingOldPrizes = true;
      save(renameOldTestPrizes).catch(() => {
        if (active === session) $('notice').textContent = '舊帳名稱同步未完成，重新開啟帳本時會重試。';
      }).finally(() => { renamingOldPrizes = false; });
    }
    render();
    $('gate').hidden = true;
    $('ledger').hidden = false;
  }, () => {
    if (active !== session) return;
    ref = null;
    entryDialog.close();
    gate('無法開啟帳本。請確認此帳號有 LinFamily 使用權限。', true);
  });
}
if (document.readyState === 'loading') await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
start().catch(() => gate('LinFamily 連線未完成，請重新整理。'));
