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
