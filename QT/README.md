# Daily QT · 每日靈修網站（成人文青版／兒童注音故事版）

## 專案目錄結構
- `index.html`：前端雙主題單頁網站（已填入 `linfamily-31cb6` Firebase 設定）
- `requirements.txt`：後端 Python 套件清單
- `scripts/daily_qt.py`：每日自動抓取《活潑的生命》（備援 YouTube 頻道）、信望愛聖經 API、Gemini AI 生成神學與兒童注音故事並寫入 Firestore 的主程式
- `.github/workflows/daily.yml`：GitHub Actions 每日凌晨 04:00 (UTC+8) 自動排程設定
- `firestore.rules`：LinFamily 專案最新 Firestore 安全規則備份

## 快速部署檢查清單
1. **Firebase Rules**：將 `firestore.rules` 內容貼至 Firebase Console → `linfamily-31cb6` → Firestore → 規則並發布。
2. **GitHub Secrets**：於 GitHub 倉庫 `Settings → Secrets and variables → Actions` 新增以下 4 個變數：
   - `LLM_API_KEY`：Google AI Studio API Key
   - `LLM_BASE_URL`：`https://generativelanguage.googleapis.com/v1beta/openai/`
   - `LLM_MODEL`：`gemini-2.5-flash`
   - `FIREBASE_SERVICE_ACCOUNT`：Firebase 服務帳戶私密金鑰 JSON 全部內容
3. **Cloudflare Pages**：連結此 GitHub 倉庫，建置命令與輸出目錄皆留白，直接部署上線。

### 英文閱讀偏好與今日補抓

- 重新發布根目錄的 `firestore.rules` 後，已驗證電子郵件的 LF 登入帳號會把英文經文偏好同步到自己的 `qt_preferences/{uid}` 文件。訪客的偏好儲存在瀏覽器。
- 在 LF 的 Cloudflare Pages 正式環境加入機密 `QT_WORKFLOW_TOKEN`。使用只授權 `DX04L/LinFamily` 且具有 Actions 讀寫權限的 fine-grained GitHub token。重新部署後，Super User 才能從缺少今日內容的頁面啟動 Daily QT 補抓工作。
