# Notion 訂閱自動補帳 + 月報 Email

兩個排程：
- **每天**：檢查「訂閱產品」，把到期未記的「繳費紀錄」補上（照你跟 Notion AI 討論出的追平邏輯）
- **每月 10 號**：寄一封 email，列出「準備取消」但還沒去平台取消的訂閱、暫停中的訂閱、以及目前每月總花費

用 GitHub Actions 排程執行，不用自己顧一台伺服器，免費額度足夠這種輕量排程。

## 1. 建立 Notion Integration

1. 到 https://www.notion.so/my-integrations 建立一個新的 internal integration，複製它的 `token`（`secret_...`）
2. 分別打開「訂閱產品」「繳費紀錄」兩個資料庫 → 右上角 `...` → `Connections` → 把剛建立的 integration 加進去（沒授權的話 API 會查不到資料）

## 2. 取得 Database ID

打開資料庫的「完整頁面」，網址長這樣：
```
https://www.notion.so/xxxxx/1a2b3c4d5e6f...?v=...
```
`1a2b3c4d5e6f...` 那段 32 碼英數字就是 database ID，「訂閱產品」「繳費紀錄」各取一個。

## 3. 放上 GitHub

把這個資料夾整個 push 成一個（可以是 private）repo。

## 4. 設定 Secrets

Repo → `Settings` → `Secrets and variables` → `Actions` → `New repository secret`，新增：

| Secret | 說明 |
|---|---|
| `NOTION_TOKEN` | 步驟 1 拿到的 integration token |
| `NOTION_SUBS_DB_ID` | 「訂閱產品」database ID |
| `NOTION_PAYMENTS_DB_ID` | 「繳費紀錄」database ID |
| `RESEND_API_KEY` | Resend 的 API Key（[resend.com](https://resend.com) → Dashboard → API Keys） |
| `MAIL_TO` | 收月報的信箱 |
| `MAIL_FROM` | 選填。沒驗證網域前留空，會自動用 Resend 的 `onboarding@resend.dev`（只能寄給你註冊 Resend 那個信箱）；驗證完自己的網域後可填該網域下的地址，例如 `notify@yourdomain.com` |

## 5. 本地測試（建議先做這步再等排程）

```bash
npm install
cp .env.example .env   # 填入上面那些值
npm run catchup        # 測試補帳
npm run monthly-email  # 測試月報信
```

## 6. 排程

`.github/workflows/` 裡兩個 workflow 已經設定好時間（都會自動換算台北時間）。也可以到 GitHub 的 `Actions` 頁籤手動點 `Run workflow` 先測一次，確認正常再放著讓它自動跑。

## 之後如果要改欄位名稱

所有 Notion 欄位名稱都集中寫在 `src/notion.js` 最上面的 `SUB_PROPS` / `PAY_PROPS`，改欄位名稱不用動其他程式碼。

## 手動繳費按鈕要怎麼跟這套邏輯一致

你討論稿裡的做法 (1) 是對的：把「繳費」button property 改成「新增一筆繳費紀錄」，Notion 原生 button 就能做到（不用寫程式）：

1. 進「訂閱產品」資料庫，編輯「繳費」這個 button 欄位
2. Action 選 `Add page to` → 選「繳費紀錄」資料庫
3. 在建立的新頁面裡預先帶入：`產品` = 目前這頁（relation self-reference）、`繳費日期` = Today、`繳費金額` = 這頁的 `價格`（用 Notion button 的「複製屬性」功能）

這樣不管是自動腳本還是手動點按鈕，寫進「繳費紀錄」的欄位組合是一致的，之後對帳不會亂。

## 贈送時長的注意事項（你原本討論稿有提到）

如果「下次繳費時間」公式有把「贈送時長」算進去，追平迴圈跑很多期時，每一期都可能被 bonus 影響到，算出來的日期會跟預期不一樣。

建議照你原本想的做法：在「訂閱產品」加一個 `贈送已使用`（checkbox），公式改成「`贈送已使用` = false 時才加 bonus」，並且在第一次成功記帳後把它勾起來（可以先手動勾，之後要的話我可以幫你把這步也寫進 `catchup.js`，在第一次成功 `createPayment` 後自動把這個欄位設成 true）。
