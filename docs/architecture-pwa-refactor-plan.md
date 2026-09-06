# 台灣啦啦隊資料庫：網站架構與 PWA 重構任務

## 任務與狀態

- 需求：在保留既有資料與功能的前提下，將網站重構成易維護、可測試、可擴充的架構，並同步改善手機網頁及已安裝的 PWA。
- 專案：`AminoD701/TWCcheerleader`；正式站為 GitHub Pages 的 `/TWCcheerleader/` 子路徑。
- 審查日期：2026-09-06。
- 審查基準：`main` commit `df2dc6c91389a45c4353cf0e1991999ea4559840`。
- 本文件是原始碼抽查與架構審查結果，不是完整執行測試或已完成重構的聲明。沒有執行真機安裝、瀏覽器互動、Lighthouse 或正式站資料寫入測試。
- 本次初始提交僅建立實作任務文件。Codex 應先重新確認目前 HEAD 與本文件的差異，再實際修改與測試程式。
- 工作限定於此 repository；不要修改 `cpbl-girls-2`、`GPT` 或同帳號其他網站。
- 不直接推送 main、不自行合併 PR、不強制推送、不刪除使用者資料、不更改正式站網址與既有服務帳號。

## 已查證的問題與證據

### A. 頁面、樣式、資料與行為高度耦合

基準版 `index.html` 原始檔為 603,743 bytes，超過 8,000 行；這是單一原始檔大小，不是實測傳輸量或網站整體大小。

- 第 1–160 行含分析、廣告、CDN URL 轉換與大量 CSS。
- 第 1800–1920 行含篩選器、各功能容器、inline event handlers，以及直接讀取收藏與行程的 localStorage 初始化。
- 第 2160–2295 行同時處理多個試算表來源、JSON 來源、資料合併、日期轉換、初始化、投票重新整理與資料快取。
- 第 2800–2890 行賽事月曆直接依賴 `window` 狀態、拼接 HTML、inline styles 與 inline onclick。
- 第 8000 行以後仍有完整個人頁模板及再次覆蓋 `window.closeModal` 的行為。

只把內容搬到一個巨大 app.js，不算完成重構。應建立明確的功能邊界、資料邊界、樣式責任與初始化順序。

### B. 以文字補丁修改應用程式

`tools/patch_news_ui.py` 直接對 `index.html` 執行多次 `text.replace()` 並覆寫檔案。另有 `patch_auto_events.py`、`patch_auto_news.py`、`patch_news_categories.py`、`patch_pwa.py`，以及相關 workflows。

需逐一確認哪些是歷史一次性工具、哪些仍會執行。重構後的正常資料更新不得依靠比對首頁文字片段來修改前端程式。不要在尚未確認依賴前直接刪除所有工具。

### C. 重複入口檔

根目錄 `event-entry.js`、`form.js`、`manual-event.js`、`manual-form.js` 的內容 SHA 相同，均為 `1f9f0ea9f4bb18020b08ffbb768afb402a552926`，每個檔案 7,984 bytes。

先盤點 HTML、工具、外部引用及舊網址需求，再收斂成一份正式實作；必要的舊入口保留薄相容層，不要讓四份功能持續獨立維護。

### D. 資料失敗與空資料混淆，收藏初始化缺少防護

- `index.html` 第 2160–2295 行，多個 fetch 失敗被 `.catch(() => [])` 轉成空陣列，之後仍可能寫入整包 localStorage 快取。
- 第 1800–1920 行附近，`cheer_favorites` 與 `cheer_my_schedules` 直接 `JSON.parse(localStorage.getItem(...))`，初始化處沒有局部例外防護。
- `buildGirlMap()` 使用 realname 與 nickname 組合為 UID。更改模型時必須保留舊收藏的對應關係。

改成可辨識 loading / success / empty / stale / error 的資料狀態；來源失敗不得覆蓋最後成功資料。個別來源失敗不應讓整個網站无法使用，也不能無提示地假裝沒有資料。

### E. 現有 APP 是 PWA，需與網站同步重構

`pwa.js` 註冊 `./sw.js`、提供安裝按鈕；`manifest.json` 的 start_url / scope 都是 `./`，display 為 standalone，並提供 events / news query-string shortcuts。本次已查閱的結構沒有獨立 Android 或 iOS 原生工程；這不代表已排除其他 repository 另有封裝。

`sw.js` 的具體問題：

1. activate 會刪除所有名稱不等於 `tw-cheerleader-pwa-v1` 的 cache，沒有本專案名稱前綴篩選。在同 origin 多個 GitHub Pages 專案並存時，具有刪除其他專案 CacheStorage 的風險。
2. APP_SHELL 快取失敗仍 catch 後 `skipWaiting()`，可能讓不完整的新 worker 接管。
3. navigation 回應沒有先判斷成功狀態就覆蓋 index 快取。
4. 非 navigation 同源 GET 一律先回 cache；沒有處理 `request.cache === 'no-store'` 的 bypass，可能抵觸呼叫端更新資料的意圖。
5. 同源資料使用 timestamp query，而 worker 依完整 Request 快取；在未設容量及到期管理的情況下有累積不同快取項目的風險。
6. 部分背景更新與 cache.put promise 未納入 `event.waitUntil()`；需改善 worker 生命週期管理。
7. 未命中快取又斷線的資源沒有一致的離線回應策略。
8. 安裝介面存在，但 `pwa.js` 沒有完整的新版可用通知、使用者確認更新及 controllerchange 管理流程。

manifest 目前只有 SVG icon；補齊跨裝置 PNG、maskable 與 Apple touch icon，並實測而非僅以檔案存在判定通過。

### F. 測試偏向資料爬蟲，前端驗收不足

已查閱的 tests 目錄只有 `test_direct_crawler.py`、`test_priority_store_parsers.py`；`test-priority-parsers.yml` 執行這兩個 Python 測試。根目錄未見 package.json 或前端 build 設定。

不要宣稱專案完全沒有測試。保留現有 Python 測試，補上前端單元、主要流程、資料相容與 PWA 更新回歸測試。

## 建議目標架構

先採漸進式模組化，建議以 Vite + TypeScript 建立可重現的建置與檢查流程。是否導入 React / Vue，需以互動複雜度、團隊維護成本及遷移風險寫成簡短 ADR；不要為了看起來專業而同時導入新後端、資料庫、微服務或多套前端框架。

```text
index.html                    # 輕量頁面入口，不再承載完整業務程式
src/
  app/                        # bootstrap、route、應用狀態、全站 layout
  features/
    girls/                    # 名單、篩選、個人頁
    events/                   # 公開活動與行程
    schedules/                # 班表與應援名單
    matches/                  # 賽程與主題日
    news/                     # 消息與分類
    favorites/                # 收藏、個人行程、本命球隊
    engagement/               # 現有投票、遊戲、護照等；依實際盤點再細分
    feedback/                 # 現有回饋與表單
  services/                   # Sheets / JSON / 既有遠端端點 adapters
  shared/
    ui/                       # 共用卡片、按鈕、彈窗、載入與錯誤狀態
    utils/                    # 日期、正規化、URL、安全文字處理
    types/                    # 共用資料契約與驗證
  storage/                    # 使用者資料、版本、遷移、備份與復原
  styles/                     # tokens、基礎樣式、layout；功能樣式就近管理
  pwa/                        # worker 原始碼、更新流程、安裝與離線提示
public/                       # 靜態圖示及必要相容資產
 data/                        # 實際部署仍須保留既有 /data/... 路徑
 tools/                       # 現有 Python 來源擷取，與前端程式責任分離
 tests/                       # Python 測試保留，新增前端 / e2e / pwa 分類
 docs/                        # 架構、資料來源、維護、部署與回退
.github/workflows/            # 檢查、資料更新、部署；資料流程不改 UI 原始碼
```

上面是責任劃分示意，不要求照抄資料夾。`data/`、`tools/`、`tests/` 是根目錄既有目錄；是否搬移須同步更新所有部署與腳本引用。

設計約束：

- 網站、手機瀏覽器、standalone PWA 共用功能與資料邏輯，只針對導覽與呈現做響應式適配。
- 每個功能有自己的 renderer / component、state 與資料依賴，不可持續重複覆寫全域函式。
- 可在遷移中保留小型 legacy adapter，但需標明用途與移除條件。
- 保留目前 Google Sheets 編輯方式、欄位及 JSON 資料來源；先整合 adapter 與驗證，不要求站主改用新 CMS。
- 資料來源需集中設定；建立女孩、球隊、活動、班表、賽程、消息等資料契約。
- 日期處理明確採台灣時區與來源日期語意，測試跨日、跨月、跨年，不以裝置時區碰運氣。
- 收藏、行程、首頁球隊偏好與現有個人化資料列出所有 storage key；先備份與版本化，再作相容遷移。無法解析的資料保留復原機會，禁止 localStorage.clear()。
- 對外部文字與連結集中驗證；普通文字使用安全文字輸出，連結限制適當協定，需要 HTML 的欄位採明確允許規則。不要將外部資料直接插入事件屬性。

## 分階段實作與交付

### Phase 0：建立基準與風險清單

1. 完整讀取 repo 的所有入口、scripts、workflows、資料來源與 remote integrations，確認是否另有原生封裝；不憑文件猜測。
2. 列出所有現有功能、URL/query/hash、storage key、遠端讀寫端點、資料合併規則與排程。
3. 執行現有測試；記錄命令、通過數、失敗與環境限制，不能把未執行寫成通過。
4. 擷取桌面與手機主要流程基準截圖；量測相同環境的 HTML/JS/CSS 體積、請求數及可行的效能指標。沒有量測就不提供分數或改善百分比。
5. 提交 ADR、功能回歸清單與分階段遷移計畫，接著實作，不只交文件。

### Phase 1：先修穩定性與工程基礎

1. 對安全讀取 storage、資料驗證、日期與 dedupe 等關鍵行為建立特徵測試。
2. 修正 PWA cache namespace、錯誤快取、no-store bypass、安裝失敗與更新流程，加入自動化測試。
3. 建立 package.json、鎖檔、可重現的 lint / typecheck / test / build，以及對應 CI；使用執行環境適用的受維護版本並驗證，不盲目全部升級。
4. 抽出設定、資料 adapters、storage、日期、共用 UI 基礎；維持原畫面與既有資料契約可使用。
5. 提供可執行版本與實際 diff。不要一次把所有功能重寫或删除。

### Phase 2：逐功能遷移

按資料查詢核心先於互動周邊的順序，逐步遷移女孩/個人頁、活動、班表/賽事、消息、收藏/個人行程，再遷移投票、遊戲、護照及其他現有功能。每一模組須有回歸測試，不能在缺少相同功能時直接移除舊實作。

資料擷取、normalize、dedupe、顯示分開。資料失敗保留最後成功版本並顯示更新時間/過期狀態。讓當前頁先可用，再按需載入非必要功能，不以完整下載所有來源作為唯一進站條件。

收斂重複 JS 入口與歷史 patch 工具；正常資料 workflows 僅更新資料產物，不能對新 UI 原始碼做文字替換。

### Phase 3：資訊架構、介面與 PWA 體驗

保留現有品牌語言，但统一色彩、字級、間距、按鈕、卡片、彈窗、狀態與 z-index 規則。資訊架構以女孩查詢、行程、班表/賽程及個人收藏等主要任務為優先；遊戲與次要功能仍需可發現，不可藉整理導覽刪除。

手機優化涵蓋安全區、動態視窗高度、觸控目標、表格小螢幕替代表達、鍵盤與彈窗、返回行為、篩選保留及捲动位置。修正目前 viewport 禁用縮放的設定，驗證放大閱讀；支援鍵盤焦點管理與減少動態效果。

提供安裝說明、適合時機的更新通知、離線/過期提示。已安裝使用者不得被迫清除收藏或重新安裝才能使用新版。

### Phase 4：驗收、部署與回退

完整測試與預覽通過後才提出合併建議；保持人工合併，不自動合併或改正式站部署設定。README 說明本機啟動、修改資料、加入功能、測試、部署、排程與故障排除。回退方案同時涵蓋 Git commit、已發布資產及仍留在使用者裝置的 service worker；只回退 Git 不代表裝置端一定回復。

## PWA 遷移必要規格

- 保留 `/TWCcheerleader/` base path、worker URL/scope 與既有安裝身份；不要任意改動 manifest identity、start_url 或 scope。
- `?mode=events`、`?mode=news` 及盤點到的既有深連結需在一般瀏覽器與 standalone 正常開啟。引入路由時驗證 GitHub Pages 直接開啟及重新整理，不盲目改成需要伺服器 fallback 的 history routing。
- 僅清理由本專案擁有的 cache；辨識舊 `tw-cheerleader-pwa-v1`，禁止刪除同 origin 其他專案 cache。
- 新版核心資產快取未成功前不能以成功安裝流程接管。新版提示與使用者資料保存配合，避免未儲存操作被強制重整。
- 區分 versioned static assets、HTML navigation、即時資料；錯誤回應不能取代最後可用版本。
- no-store 請求不得由舊 cache 回應或寫入 runtime cache。其他資料需明確 TTL、上限與 URL key 規則；不可無差別移除具有實際語意的 query。
- 背景更新與寫入 cache 的 promise 納入生命週期管理；離線且無資料時顯示明確訊息。
- 為新建置產物建立一致的版本與快取策略，驗證舊 HTML / 新 chunk 與新 HTML / 舊 chunk 不混用。
- 補齊適當的 PNG 與 maskable icons、Apple touch icon；實測安裝、啟動、圖示及升級。
- 讀取資料、加入收藏、切換 tab、返回個人頁、斷線與恢復上線，在手機網頁與 PWA 使用同一套規則。

## 必須提供的驗收證據

- 現有 Python 測試與新增前端 lint/typecheck/unit/build 執行結果。
- 主要功能 smoke / e2e：搜尋、篩選、個人頁及返回、活動、班表、賽程、消息、收藏新增移除與刷新保留；其餘已存在互動功能列明測試結果。
- 舊版正常/損壞/缺失 storage fixtures 的相容與復原測試。
- Sheets/JSON 的成功、空回應、格式錯誤、逾時與單來源失敗測試，確保正常資料不被清空。
- PWA 舊版升新版、安裝失敗、no-store、離線首次/再次使用、恢復連線、異常 HTTP 回應，以及同 origin 其他專案 sentinel cache 不被刪除的測試。
- 至少 360、390、768、1366 CSS px 的版面檢查與 Chromium / WebKit 可行範圍；模擬器結果與實際 iOS/Android 真機結果分開記錄，不把 WebKit 模擬稱為真機安裝測試。
- 相同條件下的前後效能量測與前後截圖；若環境限制不能測，清楚標記未驗證及原因，不編造改善結果。
- 修改檔案清單、已完成階段、尚未完成項目、相容性風險、執行命令與回退方式。

## Codex 執行要求

此任務需要實際程式修改，不是只描述理想架構。請從本分支開始，先確認基準，再按階段提交小而可審查的變更。每階段均須可建置、可執行並保持既有核心功能。必要時建立相互依賴的小 PR，但不要合併到 main。

不要將某一階段完成寫成全面改版完成；不要把未執行測試寫成已通過；不要把 PWA 與原生 APP 混為一談。尚未取得的外部服務或真機驗證能力須明確列為限制，而不是用假資料掩蓋。
