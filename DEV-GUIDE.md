# LinFamily 開發準則（所有 App 共用）

之後新增或修改任何站（LF、DX、YA、SR 和以後的新站）都照這份。**LF 是範本**：新 App 從 LF 複製開始。

## 1. 架構與網址
- 全部站掛在同一個網域，用路徑區分，**不用子網域**（子網域會出現瀏覽器那一列、登入也無法共用）。
  - DX：`clc-dx04.pages.dev/`　LF：`/lf/`　YA：`/ya/`　SR：`/sr/`
  - 轉送設定在 DX04 的 `_worker.js` → `SITES`（新站加一行）。
- 層級：**LF（最高）→ DX → YA、SR**；之後的新站（2.2、2.3…）放在 LF 底下。
- 以後若換自己的網域，只要在 Cloudflare Pages（clc-dx04 專案）加 Custom domain，並把程式裡寫死的 `clc-dx04.pages.dev` 換掉。
- 新站程式一律用**相對路徑**（`images/a.png`），不要用 `/images/a.png`，才能掛在任何路徑底下。

## 2. 登入（單一登入，DX04 的 `clc-sso.js`）
- **登入只往下帶**：LF 登入 → DX、YA、SR 全部自動登入；DX 登入 → YA、SR；YA、SR 只登入自己。
- **登出：任一站登出，全部登出。**
- 層級表在 `clc-sso.js` 的 `PARENT`（例：`xx: 'lf'`）；有下層的站要在 `API_KEYS` 放它的 Firebase apiKey（公開值）。
- 每個站根目錄放 `clc-site.json`：`{ "name": "...", "firebase": { ...Firebase 設定... } }`。
- 新站 Firebase 要設定：
  1. Authentication → Settings → 已授權網域：加 `clc-dx04.pages.dev`
  2. Authentication → Sign-in method → Google → Safelist client IDs：加**所有上層站**的 Web client ID（至少 LF 的）
- 共用憑證為 Google 規定的 1 小時效期，超過要在該站自己按一次登入。

## 3. 權限
- Superuser 固定兩位（寫死在程式與 Firestore 規則）：`darren710404@gmail.com`、`darren.lin@twclc.org`。四站都是最高權限。
- 其他人存在 Firestore `admin_users/{email}`：`role: admin | viewer | user`（user：可登入 LF，不能開 DX／YA／SR，登入也不往下帶）、`active: true/false`。
- 權限管理是**獨立頁面**（不是彈出視窗），左上角「‹ 返回」；只有 Superuser 看得到內容。版面與字體大小照 DX 的 `admin-users.html`。

## 4. App 格子（主畫面）
- 沒登入時停在入口頁：海浪影片（`assets/entrance.v1.webm`／`.mp4`，4.4 秒無縫循環、無音軌）＋置中 LF Logo（`assets/lf-logo.v1.svg`），沒有任何提示文字與控制項；點一下、Enter、空白鍵才跳出 Google 登入。程式在 `css/entrance.css`、`js/entrance.js`。
  - 減少動態效果、低電量模式、自動播放被擋 → 只顯示 poster（`assets/entrance.poster.v1.webp`）；分頁在背景或已登入時影片暫停。
  - `assets/*` 由 `_headers` 設一年快取：換檔要改檔名版本（v2），不要覆蓋同名檔。
  - LINE／FB／IG 內建瀏覽器不能用 Google 登入：LINE 會自動加 `?openExternalBrowser=1` 重開；Android 改用 `intent://` 交給 Chrome；iPhone 的 FB／IG 只顯示「請用 Safari 或 Chrome 開啟」。**對外分享的 LF 連結請一律加 `?openExternalBrowser=1`**（程式會忽略這個參數）。⚠ 需在 iPhone 與 Android 各實機測一次。
- DX、YA、SR 的 App 只有 Superuser 看得到（其他人主畫面與 Apps 都不顯示）。
- **每人自己的桌面**：登入者都能長按編輯（排列、新增、移除、改圖示），存在 Firestore `linfamily_desktops/{email}`；沒有個人桌面時顯示預設桌面。
- 分頁：**Home**（主畫面）、**Family**（家庭空間配置）、**Apps**（只列還沒加到主畫面的 App，含從主畫面移除的，可「＋ 加到主畫面」）；搜尋是分頁右邊的放大鏡，點了才出現搜尋列，清空就收起。有新 App 時 Apps 分頁出現紅點，打開 Apps 就消失；看過的記在個人桌面的 `seen`。
- **App 櫃**＝`linfamily_settings/apps`（全部 App）。Superuser 也有自己的主畫面；Superuser 新增／修改 App 會同步到 App 櫃，在 Apps 分頁可「刪除」App 櫃裡的 App。之後「不同 App 給不同人」就在 App 櫃的 App 上加權限欄位。
- 長按進入編輯模式（像 iPhone）；拖曳排序、`−` 刪除、空格 `＋` 新增。共用 `js/clc-slot-grid.js`。
- **新增／修改 App 同一個畫面**，標題「新增 App」／「修改 App」，欄位順序固定：
  1. 網址　2. 名稱　3. 圖示（旁邊即時預覽）
- 貼上網址後自動抓名稱、圖示、能否內嵌（DX04 的 `/api/site-info`，已開放跨站呼叫）。使用者改過的值不會被自動抓取覆蓋。
- 圖示：自動抓取 → 抓不到或寬度 < 96px（會糊）→ **自動生成字母圖示**（彩色圓角方塊＋名稱第一個字）。**不使用 Google favicon 服務。**
- 開啟方式：
  - 同網域的站（DX、YA、SR、LF 子頁）：直接換頁（不會有那一列）。
  - 外部網站可內嵌：在 `open.html` 框內開（右上角 ↗ 直接開啟）。
  - 外部網站不可內嵌（Google 等）：直接開，接受那一列。
- 空白處按右鍵／手機長按：自訂選單「Copy link」「Open in new window」，外觀照 DX 的 Header 選單；Copy link 後面顯示網址，選單寬度固定，網址太長時跑馬灯流過去；複製的是各站**原本的網址**（DX 底下的 `/ya/`、`/sr/` 換回 YA、SR 自己的網域，`/lf/` 維持 DX 底下）（LF 的 `js/lf-menu.js`，DX、YA、SR 的 `header.js`）；新分頁盡量用預設瀏覽器開（Android 用 `intent://`、LINE 加 `openExternalBrowser=1`）。
- **回首頁鈕**：從 LF 開出來的所有站（DX、YA、SR、`open.html` 內的外部網站）左下角都有一顆**淡淡的圓形 🏠 浮動鈕**（平常幾乎透明，碰到才變清楚），按了回 LF 主畫面。不要再用「‹ LinFamily」文字鈕。
  - 自家站：LF 帶 `?lfhome=` 進入，由 DX04 的 `lf-back.js` 顯示（Worker 自動插入，各站不用改）。
  - `open.html`：直接寫在頁面裡（樣式相同）。
  - LF 自己的子 App（如 HannahProjects）：引用 LF 根目錄的 `linfamily-home.js`（樣式相同）。

## 5. 外觀
- 字型：英文 Arial（粗體用 Arial Bold）、中文微軟正黑體（`"CLC Arial", Arial, "Microsoft JhengHei", "PingFang TC", sans-serif`）。
- LF 色系：墨黑 #1C1C1C、松綠 #4E8B7E、鼠尾草綠 #8FBFB0、奶油米 #EADFC8、淺灰 #E6E7E9；深淺模式存在 `localStorage linfamily_theme`。
- localStorage key 加站名前綴（`linfamily_`、`clc_`…），同網域各站共用儲存空間，避免互蓋。

## 6. 工作方式
- 沒有特別指示時，用最省 AI token 的方式修改；需要大量測試的步驟交給 Darren 手動測。
- Firebase / Cloudflare 主控台由 Darren 自己設定，只要告訴他「去哪裡、填什麼」。
- Repo：LF＝`DX04L/LinFamily`；DX、YA、SR＝`CLC-Darren/clc-dx04`、`clc-ya-portal`、`clc-sr-portal`。

## 7. 檔案命名（每站一致）
- 主畫面：`index.html`。外部網站內嵌框：`open.html`。站台設定：`clc-site.json`（下層站才需要；DX 是最上層網域本身，不用）。
- **後台頁一律 `admin-xxx.html`**（前綴，不用後綴）：權限管理 `admin-users.html`、其他後台如 `admin-hymns.html`、`admin-venues.html`、`admin-members.html`、`admin-join.html`。
- **只給本站頁面用的 JS／CSS 放 `js/`**：`js/clc-slot-grid.js`、`js/home-apps.js`、`js/lf-menu.js`…
- **Worker 自動插入、或好幾站一起用的檔案留在根目錄不搬**：`header.js`、`clc-sso.js`、`lf-back.js`、`login-gate.js`、`_worker.js`、`sw.js`、`manifest.json`、圖示檔。
- 改名時舊檔名留一個轉址小檔（`location.replace` 到新檔名），舊連結、書籤、已寄出的信才不會壞。
- 不要把 `desktop.ini`、`.DS_Store` 這類系統檔放進 repo。
