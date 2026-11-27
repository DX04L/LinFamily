# LinFamily APP

現代化極簡 Apple iOS / macOS 風格家庭主畫面與數位入口網站（純靜態單頁版本）。

## 功能特色
1. **iPhone 主畫面 App 網格**：
   - 支援「貼上連結直接新增 App」、自動偵測名稱與網站圖示。
   - 登入管理員權限後，**長按任一 App 圖示**即可進入抖動編輯模式，支援自由拖曳移動順序、點擊編輯圖示與名稱、或點擊左上角 `−` 刪除。
   - 點擊 App 直接於同視窗開啟跳轉，無多餘頂部 Header 遮擋。
2. **無獨立 Header 的極簡懸浮控制列**：
   - 左上角 `LinFamily APP` 品牌標誌，右上角整合「安裝（PWA 加入主畫面）」、「登入與權限管理」與「明暗模式切換」。
3. **後台權限架構（前台就緒，可直接對接 Firebase）**：
   - 內建 `Superuser`、`Admin`（可編輯）與 `Viewer`（唯讀）三級權限模型。
   - 預設可測試登入帳號：`darren710404@gmail.com`（Superuser）、`family.member@gmail.com`（Admin）、`guest.viewer@gmail.com`（Viewer）。
4. **雙向互動家庭空間平面圖（零外部圖片依賴）**：
   - 切換至「家庭空間與成員」分頁時置頂顯示純程式碼繪製的 SVG 家庭空間配置與動線圖。
   - 深色模式下圖表底色自動維持純白高對比；點擊圖上標註或下方服務卡片可雙向聯動高亮，並支援「一鍵切換查看另一項職責」膠囊按鈕。
5. **內建高解析桌面圖示與單檔部署**：
   - 使用內嵌 SVG + Canvas 動態生成高解析 PNG Favicon 與 iOS/Android 加入主畫面桌面圖示。

## 部署方式
1. 解壓縮本 `.zip` 檔案。
2. 直接將 `index.html` 上傳至 **GitHub Pages**、**Cloudflare Pages**、**Vercel** 或任何靜態網頁主機即可一鍵上線。

## 新增 App 的共用 Home 按鈕

從 LinFamily 開啟的自家 App 使用 `open.html` 外層的共用 Home overlay。QT、HannahProjects 等 LF 子 App 保留自己的頁首，由外層載入 DX04 維護的 `lf-back.js`。Home 貼邊時顯示半個房子，拉出時顯示完整圖示。

新增自家 App 時，把 App 的直接網址登錄到 App Drawer，本站入口會自動使用外層 overlay。分享時使用 App 的直接網址。App 頁面不需要載入 Home 程式或另外製作按鈕。DX／YA／SR 仍沿用 Worker 的 `?lfhome=` 接法。

## 新增 App 的共用網址選單

自家 App 沿用 `js/lf-menu.js`。在頁首或空白處按右鍵（手機長按），會出現與 DX04 Header 一致的 **Copy link** 和 **Open in new window**。普通連結、按鈕和輸入欄保留原本的操作。

```html
<script defer src="../js/lf-menu.js?v=7"></script>
```

以上路徑適用於 LF 的第一層子 App。獨立部署的自家 App 改用 `https://linfamily.pages.dev/js/lf-menu.js?v=7`。若頁首的品牌連結也要開啟選單，可在該連結加 `data-lf-menu-trigger`，一般點擊仍會照常。新增 App 時請引用共用檔案，避免另寫一份選單。自家子頁分享 `linfamily.pages.dev` 的網址，主站分享 `clc-dx04.pages.dev/lf/`。透過 LinFamily 內嵌的外站，可以從外層標題列的「連結」選單複製原始入口網址。

## 離線導覽

四站共用固定版本的 Service Worker 導覽程式，依 LF → DX → SR → YA 逐站啟用。第一階段支援離線入口及 🏠 返回，後續再做子頁閱讀與離線同步。[開發原則與驗收方式](DEV-GUIDE.md)
