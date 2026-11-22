# Pinky Jump 第一版：Firebase 設定（手機跨裝置 + 共用 Top 10）

程式已放在 games/pinky-jump/，沿用 Firebase 專案 linfamily-31cb6，不需要 WebRTC。

## Firebase Console 要手動完成的兩件事
1. 開啟 https://console.firebase.google.com/project/linfamily-31cb6/authentication/providers ，在 Authentication → Sign-in method 啟用 Anonymous（匿名登入）。遊戲使用獨立的 Firebase App 名稱，不會要求玩家輸入帳號。
2. 開啟 https://console.firebase.google.com/project/linfamily-31cb6/firestore/rules ，在目前正式運行的規則中，只合併 GitHub 專案根目錄 firestore.rules 最新加入的 match /pinky_jump_rooms/{room} 與 match /pinky_jump_scores/{entry} 兩段，然後按「發布」。

注意：GitHub 上更新 firestore.rules 不等於自動發布到 Firebase。切勿用 GitHub 備份整份覆寫 Firebase Console，因為線上規則可能包含其他較新的設定。

## 測試方法
1. 電腦開啟 Pinky Jump，點「🎮 手機控制」→「產生 6 碼配對碼」。
2. 手機開啟 controller.html、輸入代碼並「連接電腦」，或用電腦複製連結傳給手機。
3. 手機先按「跳躍測試」確認網路連線，再點「啟用動作感應」，校準約一秒。
4. 向上輕抬手機即可觸發跳躍；不需要真的跳高，避免拋接或甩動手機。
5. 玩到破榜後輸入名字，可登記本機 Top 10；開啟 Firebase 規則後也能使用共用 Top 10（測試版）。

## 安全與限制
- 手機體感使用加速度計，感應精度和手機型號、權限、握法有關。
- Firestore 的更新延遲受網路影響；這版不是 WebRTC 即時連線。
- 房間代碼有效期約 1 小時；房間不能被列舉，僅第一支配對手機能發送指令。
- 共用 Top 10 是公開測試榜，分數由前端送出，尚未做伺服器防作弊與審核；不適合直接作為有獎金的正式競賽。
- 若 Firebase 未完成上述設定：本機排行榜仍可用；同一瀏覽器的兩個分頁可用 BroadcastChannel 測試配對控制，但不同裝置不能連線。
