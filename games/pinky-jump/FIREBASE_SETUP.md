# Pinky Jump｜全球 Top 10 與手機體感控制器

這個遊戲沿用 Firebase 專案 linfamily-31cb6，不需要 WebRTC。

## Firebase Console（必須手動確認）

1. Authentication → Sign-in method：啟用 Anonymous（匿名登入）。Auto cleanup 不需要為了遊戲特別啟用。
   https://console.firebase.google.com/project/linfamily-31cb6/authentication/providers
2. Firestore Database → Rules：把目前線上規則中 Pinky Jump 的兩段，更新為 GitHub 根目錄 firestore.rules 內的最新版本。
   https://console.firebase.google.com/project/linfamily-31cb6/firestore/rules
   - match /pinky_jump_rooms/{room}：允許房主回傳 phase / runScore，手機送出 start / jump / submit / skip 指令。
   - match /pinky_jump_scores/{entry}：全球公開讀取前十名，匿名登入後登記分數。

**請勿把 GitHub 的整份備份規則直接覆蓋 Firebase 線上的最新版**，除非你已確認兩份內容一致。只替換上述 Pinky Jump 專用的兩段，其他 LinFamily / QT 等規則不動。

GitHub 的 rules 不會自動發布到 Firebase；沒有這步，手機可能配對失敗、無法提交名字，也無法全球同步。

## 使用方法

1. 電腦開啟 Pinky Jump，點「🎮 手機控制」→ 產生六碼配對碼。
2. 手機開啟 controller.html，填代碼並連接（也可把電腦顯示的連結傳給手機）。
3. 連線成功後，手機配對表單隱藏，改顯示遊戲控制器。
4. 手機可開始遊戲、手動跳躍或啟用體感感應。感應預設為低靈敏度；握穩校準後再試。
5. 電腦端撞到障礙物後，手機會同步顯示 Game Over / 再玩一次；進入全球 Top 10 時，手機直接輸入名字登記。
6. 登記後返回同一頁的控制介面；若斷線按「重新連線」即可。
7. 全球榜單只顯示 Firebase 的前十名。網路失敗時會明確顯示未連線，不會把不同裝置的本機分數冒充全球名次。

## 測試版限制

- Firestore 的即時監聽延遲取決於網路，不保證與本機鍵盤一樣即時。
- 公開 Top 10 是全球前十名「查詢結果」，資料庫裡的舊分數不會自動刪除。
- 分數目前由客戶端提交，沒有防作弊或寫入頻率防護；正式競賽前應增加後端驗證、App Check、節流與資料清理。
- 配對碼有效期約一小時；匿名帳號沒有 LinFamily 原有管理員權限。
