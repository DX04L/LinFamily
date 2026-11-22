/* Pinky Jump UI localization. */
(() => {
  const messages = {
    "正在連接全球排行榜…": "Connecting to the global leaderboard…",
    "連線失敗": "Connection failed",
    "Firebase 尚未啟用遊戲權限／匿名登入。可先試本機操作；跨裝置要先完成 Firebase 設定。": "Online play is unavailable. You can still play on this device.",
    "全球排行榜還沒有任何紀錄，歡迎成為第一位！": "No scores yet. Set the first record!",
    "🌐 全球共用 Top 10（即時同步）": "🌐 Global Top 10 · Live",
    "⚠️ 全球排行榜未連線：{0}": "⚠️ Leaderboard offline: {0}",
    "無法連線 Firebase（{0}）。可先試本機模式。": "Can't connect to Firebase ({0}). You can still play on this device.",
    "全球排行榜未連線，目前無法提交分數": "The leaderboard is offline. Scores can't be submitted right now.",
    "全球排行榜未連線，請稍後重試。": "The leaderboard is offline. Try again in a moment.",
    "正在登記…": "Saving score…",
    "正在等待 Firebase 伺服器確認全球名次": "Waiting for the live leaderboard…",
    "手機已配對，可從手機開始遊戲。": "Phone paired. Start the game from your phone.",
    "正在建立配對…": "Creating a pairing code…",
    "在手機輸入上方配對碼，或直接開啟連結。": "Enter this code on your phone.",
    "繼續遊戲": "Resume",
    "再玩一次": "Play Again",
    "登記失敗，請重新送出或略過。": "Couldn't save your score. Try again or skip.",
    "請輸入有效的 6 碼配對碼。": "Enter a valid 6-character pairing code.",
    "正在連線…": "Connecting…",
    "配對碼不存在，請在電腦重新建立": "Pairing code not found. Get a new code on the computer.",
    "請在另一台手機或平板輸入配對碼": "Enter the code on a different phone or tablet.",
    "配對碼已過期": "That pairing code has expired.",
    "這組配對碼已由另一台裝置使用": "Another device is already using that code.",
    "配對已中斷，請重新連線。": "Connection lost. Pair your phone again.",
    "已連線": "Connected",
    "此裝置不支援體感。": "Motion controls aren't supported on this device.",
    "需要動作感應權限。": "Motion access is required.",
    "無法取得動作感應權限。": "Couldn't get motion access.",
    "可切到「手機控制」跳躍。": " Switch to Phone Control to jump with a button.",
    "仍可點畫面跳躍。": " You can still tap the screen to jump.",
    "請先握穩裝置，等待體感校準。": "Hold your device steady to calibrate.",
    "未收到感應資料，請確認瀏覽器權限。": "No motion data received. Check your browser permissions.",
    "體感跳躍已就緒。": "Motion Jump is ready.",
    "已中斷配對。": "Phone disconnected.",
    "網路已中斷，請重新配對。": "You're offline. Reconnect before pairing again.",
    "✅ 已複製網址，傳到手機即可。": "✅ Link copied. Send it to your phone.",
    "已選取網址，請手動複製。": "Link selected. Copy it manually.",
    "使用 Safari 或 Chrome 開啟目前這個 Pinky Jump 網址。": "Open this Pinky Jump page in Safari or Chrome.",
    "點選瀏覽器的「分享」按鈕，再選擇「加入主畫面」。": "Tap Share, then choose Add to Home Screen.",
    "確認名稱後點選「新增」，之後即可從主畫面開啟 Pinky Jump。": "Tap Add. Then launch Pinky Jump from your home screen.",
    "使用 Android Chrome 開啟目前這個 Pinky Jump 網址。": "Open this Pinky Jump page in Chrome for Android.",
    "點選右上角「⋮」選單，選擇「安裝應用程式」或「加入主畫面」。": "Tap the three-dot menu, then choose Install app or Add to Home screen.",
    "依畫面指示確認；完成後從主畫面或應用程式清單開啟 Pinky Jump。": "Follow the prompts, then open Pinky Jump from your home screen or app drawer.",
    "在 Brave 網址列右側尋找安裝圖示；或開啟右上角主選單，尋找「安裝 Pinky Jump」或「安裝應用程式」。": "Look for the install icon in Brave's address bar, or open the main menu and look for Install Pinky Jump or Install app.",
    "安裝項目可能位於「儲存與分享」或「投放、儲存與分享」子選單。": "The install option may be under Save and Share or Cast, Save, and Share.",
    "若選單沒有安裝項目，可使用 Chrome 或 Edge 開啟目前這個 Pinky Jump 網址安裝。": "If you don't see an install option, open this page in Chrome or Edge.",
    "在 Edge 網址列右側點選安裝圖示；或開啟右上角「⋯」選單。": "Click the install icon in Edge's address bar, or open the three-dot menu.",
    "選擇「應用程式」→「將此網站安裝為應用程式」，再依畫面指示確認。": "Choose Apps, then Install this site as an app, and follow the prompts.",
    "完成後，從桌面或應用程式清單開啟 Pinky Jump。": "Then launch Pinky Jump from your desktop or app list.",
    "在 Chrome 網址列右側點選安裝圖示；或開啟右上角「⋮」選單。": "Click the install icon in Chrome's address bar, or open the three-dot menu.",
    "尋找「安裝 Pinky Jump」或「安裝網頁為應用程式」；安裝項目可能位於「投放、儲存與分享」內。": "Look for Install Pinky Jump or Install page as app, sometimes under Cast, Save, and Share.",
    "依畫面指示確認後，從桌面或應用程式清單開啟 Pinky Jump。": "Follow the prompts, then launch Pinky Jump from your desktop or app list.",
    "在目前瀏覽器的網址列或右上角選單，尋找「安裝應用程式」或「加入主畫面」。": "Look in your browser's address bar or main menu for Install app or Add to Home Screen.",
    "若沒有安裝項目，可使用 Chrome 或 Edge 開啟目前這個 Pinky Jump 網址安裝。": "If you don't see an install option, open this page in Chrome or Edge.",
    "瀏覽器目前不允許直接安裝，請使用下方選單方式操作。": "Your browser blocked the install prompt. Try the menu steps below.",
    "這次安裝提示未能開啟，請使用下方方式安裝。": "The install prompt didn't open. Try the steps below.",
    "複製網址": "Copy link",
    "在新視窗開啟": "Open in new window",
    "已複製網址": "Link copied",
    "無法複製網址": "Couldn't copy link",
    "暫停遊戲": "Pause",
    "開始遊戲": "Start Game",
    "目前瀏覽器未提供直接安裝提示。": "Your browser didn't show an install prompt."
  };

  const storageKey = 'pinky_jump_language';
  let language = 'en';
  try {
    if (localStorage.getItem(storageKey) === 'zh-Hant') language = 'zh-Hant';
  } catch (_) {}

  const attributes = ['title', 'alt', 'aria-label', 'placeholder', 'content'];
  const staticText = [...document.querySelectorAll('[data-zh]')].map(node => [node, node.textContent]);
  const staticAttributes = attributes.flatMap(name =>
    [...document.querySelectorAll('[data-zh-'+name+']')].map(node => [node, name, node.getAttribute(name)])
  );
  const liveText = new WeakMap();
  const message = (key, ...args) => ({key, args});
  const has = key => Object.prototype.hasOwnProperty.call(messages, key);

  function translate(value) {
    const {key, args} = typeof value === 'string' ? {key:value,args:[]} : value;
    const template = language === 'en' && has(key) ? messages[key] : key;
    return template.replace(/\{(\d+)\}/g, (match, index) =>
      index in args ? translate(args[index]) : match);
  }

  function set(node, value) {
    liveText.set(node, value);
    node.setAttribute('data-pinky-live', '');
    node.textContent = translate(value);
  }

  const toggle = document.getElementById('pinky-language');
  function apply() {
    document.documentElement.lang = language;
    const chinese = language === 'zh-Hant';
    for (const [node, english] of staticText) {
      if (!liveText.has(node)) node.textContent = chinese ? node.dataset.zh : english;
    }
    for (const [node, name, english] of staticAttributes) {
      node.setAttribute(name, chinese ? node.getAttribute('data-zh-'+name) : english);
    }
    for (const node of document.querySelectorAll('[data-pinky-live]')) {
      if (liveText.has(node)) node.textContent = translate(liveText.get(node));
    }
    if (toggle) {
      const label = chinese ? 'Switch to English' : '切換為中文 / Switch to Traditional Chinese';
      toggle.title = label;
      toggle.setAttribute('aria-label', label);
    }
  }

  toggle?.addEventListener('click', () => {
    language = language === 'en' ? 'zh-Hant' : 'en';
    try { localStorage.setItem(storageKey, language); } catch (_) {}
    apply();
    document.dispatchEvent(new Event('pinky-language-change'));
  });

  window.PinkyLocale = {translate, set, message, has};
  apply();
})();
