/* Pinky Jump PWA installer — matches LF / DX installation flow. */
(() => {
  'use strict';
  const button = document.getElementById('pinky-install-btn');
  const dialog = document.getElementById('pinky-install-dialog');
  const close = document.getElementById('pinky-install-close');
  const stepsElement = document.getElementById('pinky-install-steps');
  const reasonElement = document.getElementById('pinky-install-reason');
  if (!button || !dialog || !close || !stepsElement) return;

  const KEY = 'pinky_jump_installed';
  const mode = window.matchMedia('(display-mode: standalone)');
  let promptEvent = window.__pinkyBIP || null;
  let pending = false;
  let installedHere = false;
  let knownInstalled = false;
  try { knownInstalled = localStorage.getItem(KEY) === '1'; } catch (_) {}

  function standalone() { return mode.matches || navigator.standalone === true; }
  function setInstalled(value) {
    knownInstalled = value;
    try { value ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch (_) {}
  }
  function refresh() {
    if (standalone() && !knownInstalled) setInstalled(true);
    const installed = standalone() || installedHere || knownInstalled;
    button.hidden = installed;
    button.disabled = pending;
    if (pending) button.setAttribute('aria-busy', 'true');
    else button.removeAttribute('aria-busy');
    if (installed && dialog.open) dialog.close();
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    promptEvent = event;
    window.__pinkyBIP = event;
    // Another install offer means the app is currently installable again.
    if (knownInstalled && !standalone()) setInstalled(false);
    refresh();
  });
  window.addEventListener('appinstalled', () => {
    installedHere = true;
    promptEvent = null;
    window.__pinkyBIP = null;
    setInstalled(true);
    refresh();
  });

  async function instructions() {
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios) return [
      '使用 Safari 或 Chrome 開啟目前這個 Pinky Jump 網址。',
      '點選瀏覽器的「分享」按鈕，再選擇「加入主畫面」。',
      '確認名稱後點選「新增」，之後即可從主畫面開啟 Pinky Jump。'
    ];
    if (/Android/i.test(ua)) return [
      '使用 Android Chrome 開啟目前這個 Pinky Jump 網址。',
      '點選右上角「⋮」選單，選擇「安裝應用程式」或「加入主畫面」。',
      '依畫面指示確認；完成後從主畫面或應用程式清單開啟 Pinky Jump。'
    ];
    let brave = false;
    try {
      brave = !!(navigator.brave && typeof navigator.brave.isBrave === 'function' && await navigator.brave.isBrave());
    } catch (_) {}
    if (brave) return [
      '在 Brave 網址列右側尋找安裝圖示；或開啟右上角主選單，尋找「安裝 Pinky Jump」或「安裝應用程式」。',
      '安裝項目可能位於「儲存與分享」或「投放、儲存與分享」子選單。',
      '若選單沒有安裝項目，可使用 Chrome 或 Edge 開啟目前這個 Pinky Jump 網址安裝。'
    ];
    if (/Edg\//.test(ua)) return [
      '在 Edge 網址列右側點選安裝圖示；或開啟右上角「⋯」選單。',
      '選擇「應用程式」→「將此網站安裝為應用程式」，再依畫面指示確認。',
      '完成後，從桌面或應用程式清單開啟 Pinky Jump。'
    ];
    if (/Chrome\//.test(ua)) return [
      '在 Chrome 網址列右側點選安裝圖示；或開啟右上角「⋮」選單。',
      '尋找「安裝 Pinky Jump」或「安裝網頁為應用程式」；安裝項目可能位於「投放、儲存與分享」內。',
      '依畫面指示確認後，從桌面或應用程式清單開啟 Pinky Jump。'
    ];
    return [
      '在目前瀏覽器的網址列或右上角選單，尋找「安裝應用程式」或「加入主畫面」。',
      '若沒有安裝項目，可使用 Chrome 或 Edge 開啟目前這個 Pinky Jump 網址安裝。'
    ];
  }

  async function showHelp(reason = '') {
    if (standalone() || installedHere || knownInstalled) return;
    const items = await instructions();
    stepsElement.replaceChildren();
    for (const item of items) {
      const li = document.createElement('li');
      PinkyLocale.set(li, item);
      stepsElement.appendChild(li);
    }
    PinkyLocale.set(reasonElement, reason || '目前瀏覽器未提供直接安裝提示。');
    if (!dialog.open) dialog.showModal();
    close.focus();
  }

  button.addEventListener('click', async () => {
    if (pending || standalone() || installedHere || knownInstalled) return;
    const event = promptEvent || window.__pinkyBIP;
    if (!event) { await showHelp(); return; }
    promptEvent = null;
    window.__pinkyBIP = null;
    pending = true;
    refresh();
    try {
      // Prompt must be called directly from the user's click.
      const result = await event.prompt();
      const choice = result && typeof result.outcome === 'string'
        ? result : await event.userChoice;
      // Only appinstalled confirms success. Dismissal is not an install.
      if (choice && choice.outcome === 'dismissed') return;
    } catch (err) {
      const message = err && err.name === 'NotAllowedError'
        ? '瀏覽器目前不允許直接安裝，請使用下方選單方式操作。'
        : '這次安裝提示未能開啟，請使用下方方式安裝。';
      await showHelp(message);
    } finally {
      pending = false;
      refresh();
    }
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

  if (typeof mode.addEventListener === 'function') mode.addEventListener('change', refresh);
  else if (typeof mode.addListener === 'function') mode.addListener(refresh);
  refresh();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .catch(error => console.warn('Pinky Jump SW:', error));
    });
  }
})();