# Daily QT · 每日靈修

## 第一階段｜靜態前端

直接開啟 `index.html`，或把 repo 根目錄作為 Cloudflare Pages 的靜態輸出目錄。頁面使用單檔 HTML、原生 JavaScript 與 CSS 主題變數，Google Fonts 連線失敗時使用系統字型。

- 成人版以米白紙張、墨綠森林、展開的書頁與襯線字體呈現。包含經文、前後文、歷史文化背景和神學重點。
- 兒童版以粉彩小羊繪本呈現，包含台灣直排注音、白話經文、故事與小禱告。
- 切換器使用「成人／兒童」，記住閱讀模式並保留日期。兩套 SVG favicon 與 180×180 PNG Apple Touch Icon 放在 `icons/`。iOS 主畫面圖示由系統在加入時選取，已加入的圖示可能使用快取。
- 日期可逐日切換，點網站標題回到起始日期。未設定 Firebase 時顯示 2026-11-18 的詩篇範例，其他日期顯示空狀態。範例前後文各展示一節。
- 延伸探討複製對應問題並開啟 ChatGPT 或 Claude。若瀏覽器阻擋剪貼簿或新分頁，頁面提供可選取的提問與備用連結。

## Firestore 讀取介面

填寫 `index.html` 內的 `firebaseConfig`（Firebase Web App 公開設定）。頁面會依台灣日期讀取 `devotionals/YYYY-MM-DD`，並依資料結果顯示內容、空狀態或讀取錯誤。

| 欄位 | 結構 |
| --- | --- |
| `date` | 台灣日期字串，與文件 ID 一致 |
| `source_channel`、`video_url` | 來源頻道與 YouTube 影片連結 |
| `scripture` | `reference`、`verses`（每筆含 `verse`、`text`）、`context_before`、`context_after` |
| `adult_content` | `book_background`（≤100 字）、`daily_context`（≤120 字）、`theology_points`（2–3 筆，每筆含 `title`、`summary`〔≤100 字〕、`deep_dive_prompt`） |
| `kids_content` | `plain_explanation_ruby`、`bible_story_title`、`bible_story_ruby`、可選的 `bible_story_title_ruby` 與 `prayer_ruby` |
| `theme_config` | 保留作為未來擴充 |

注音欄位接受純文字與 `<ruby>字<rt>ㄗˋ</rt></ruby>`。前端會轉義輸入，再還原符合格式的注音標籤。

## 後續階段｜每日內容管線

1. GitHub Actions 每天台灣時間 04:00 執行 Python，從指定 YouTube RSS 解析標題、說明和當日經文範圍，資料結構保留來源頻道。
2. 使用信望愛聖經 JSON API 讀取標準經文與前後各五節。保留 API 回傳經文作為成人版原文。
3. 用 Gemini Flash 生成簡明背景、大公教會共同信仰重點、延伸問題及適讀於 7–12 歲兒童的繁體中文故事。以 `openai` 套件搭配 `API_KEY`、`BASE_URL`、`MODEL_NAME`，可切換到相容的服務端點。
4. 用 Python `pypinyin` 與台灣破音詞表轉注音，校對專有名詞與多音字，再寫入以日期為 ID 的 Firestore 文件。
5. 使用 GitHub Actions、Firebase、Cloudflare Pages 與 Gemini 的可用免費額度，目標為冷啟動時固定月費 NT$0。
