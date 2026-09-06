# 第一階段 PWA／手機導覽：獨立審查與修復要求

日期：2026-09-06。結論：**原始成果已取回，但本版不建議合併或部署。**

## 1. 成果已保存，不必再追找舊提交

原始 patch 已保存於本分支：`deliverables/pwa-mobile-foundation-1be477f.patch`。
保存提交：`449510297b20619abfdd62a73ba8a54a79fadc19`。

- 大小：30,113 bytes。
- SHA-256：`619dc9dc58b5d4571a3388690baca4c7d63cea332397c0411c292253ee7c5400`。
- Git blob SHA：`feeb0b6944462f03f396302bbc75629cec563f1e`。已由 GitHub 讀回比對，與本地計算一致。
- 使用者上傳的是 Markdown 包裹的 patch；移除最外層程式碼圍欄並補回最後一個 LF 後，大小與上述 SHA-256 完全一致。沒有改動 patch 程式內容。
- `git apply --stat` / `--numstat` 能解析全部 15 檔：350 行新增、48 行刪除。
- 此次只歸檔 patch、審查資料與診斷測試，**沒有把 patch 套用到正式 app、没有合併 main、沒有部署**。
- 先前的雲端短 SHA 或成果 SHA 不存在，不再是阻擋原因：實際完整 patch 已在遠端可讀取的分支中。

## 2. 這次確實執行與未執行的項目

已執行：

- 從 patch 還原 12 個新增檔案及完整 `sw.js`，並以基準版 `pwa.js` 還原其更新，共 14 個完整檔案；每個檔案的 Git blob SHA 均符合 patch 標示。
- 基準 `pwa.js` blob 已核對為 `e5e5c632ff7fa76348ae4d8ee0bcbd49a56c1210`；套用後 blob 為 `8560a181a86567947fc1fec8dbba42d8ee9f4ac6`。
- Node v22.16.0 下執行 patch 自帶的 `npm run lint`、`npm run typecheck`、`npm test`；兩個語法檢查腳本成功、6 個原附測試全部通過。
- 另外執行 9 個針對性回歸案例，9 個預期行為均未達成。這是刻意檢查邊界與整合行為的測試，不是隨機抽樣或通過率估計。
- 導覽案例使用 Node VM 執行原樣的 navigation 模組，並以小型 DOM／history／legacy setter 模擬基準首頁的相關行為；PWA 與 storage 案例使用原樣程式及受控 mock。不是完整網站 E2E 或真機測試。

未執行／限制：

- 本地 GitHub clone 因 DNS 無法解析而失敗；透過 GitHub connector 讀取了基準首頁相關區段，但沒有在本地完整重建 8,000 多行首頁。因此未宣稱完成整包 patch 的基準套用／整棵 Git tree 比對。
- 未在本輪執行 Python 測試或整站 build；原 patch 的 Python 測試聲明仍屬先前 Codex 回報。
- Chromium 可以啟動，但本地測試頁與離線測試站導覽被執行環境管理政策阻擋，回報 `ERR_BLOCKED_BY_ADMINISTRATOR`；沒有修改政策或取得成功的瀏覽器 E2E、版面截圖。
- 未執行 iOS／Android 已安裝 PWA、真機安全區、效能與跨版本升級驗收。

## 3. 導覽阻擋問題

### NAV-01：同一頁的資料載入完成可能無法更新畫面

證據：`src/app/navigation.js` 在 DOMContentLoaded 直接 `applyMode(currentMode)`；`navigate()` 第 79 行用 `if (mode === currentMode) return`，並以 wrapper 取代全域 `window.setMode`。基準 `index.html` 的 `loadData()` 載入後呼叫 `init()`，`init()` 再以目前 mode 呼叫 `window.setMode(targetMode)`。

受控重現：初始 events 頁在資料未到時渲染 0 筆；模型更新為 1 筆後呼叫同 mode 初始化，仍顯示 0 筆，render 次數沒有增加。慢網路／第一次進站的這条路徑有真實整合風險，應以完整首頁再驗證。

修復：將「導覽到相同目的地、不新增歷史」與「資料更新需重繪」分開；建立明確 data-ready／refresh 流程，不能以相同 mode 阻止初始化。不得以每次全部重抓資料來掩蓋問題。

### NAV-02、NAV-05：我的／更多的 UI 與網址不一致

證據：`showHub('my')` 呼叫舊 `setMode('passport')`，`showHub('more')` 呼叫舊 `setMode('games')`。舊 setter 會 `history.replaceState`、寫入 sessionStorage。新 wrapper 先 pushState 的 my/more 會被舊 setter 改掉。

受控結果：我的 UI 對應 `?mode=passport`；更多 UI 對應 `?mode=games`。這兩個測試是同一類衝突的不同情境，不應誇大為完全獨立的兩種根因。

修復：單一 router／history 責任來源；legacy renderer 不再重寫頂層路由。保留既有 query 深連結，處理 refresh、back／forward 及 session 保存。

### NAV-03：離開我的／更多後，hub 沒有被關閉

證據：`ensureHub()` 新增的是 section；`applyMode()` 切回其他目的地沒有隱藏 `#navigation-hub`。基準 renderer 管理的是既有功能容器，不知道此新 section。

受控結果：my → girls 後 hub 仍為 `display:block`。

修復：明確管理全部主內容容器的顯示／卸載，不能只處理 `#main-content > div`；同時避免將永久資訊列隱藏後無法恢復。

### NAV-04：只記了捲動位置，沒有保存搜尋與篩選

證據：新模組只有 `scrollByMode`；舊 `setMode()` 仍清空 searchInput、重設球隊、班表與新聞分類。

受控結果：girls 搜尋 saved-filter → events → girls，搜尋內容變為空字串。

修復：各主區獨立保存／恢復搜尋、球隊、月份、分類與捲動；後續以真正 DOM／資料的流程測試驗收。

## 4. 資料保護尚未真正接入

### DATA-INTEGRATION：新增 helper 不代表主程式已使用

`resilient-cache.js` 在這份 patch 中只有測試與檢查命令引用，navigation 模組沒有 import；首頁三個修改區段也未接入它。基準 `loadData()` 與新聞／活動更新中的 `.catch(() => [])` 邏輯仍存在。

因此，不能將 helper 的單元測試通過描述成「正式資料更新已不會清空舊資料」。必須將來源錯誤、合法空結果、schema 錯誤、過期資料與最後成功資料接到實際 Sheets／JSON adapter。

### DATA-01：儲存失敗會把成功下載的資料丟掉

`fetchWithLastSuccess()` 把下載與 `storeSuccessful()` 包在同一個 try。受控測試中，下載成功得到 `[1,2]`，但 localStorage 寫入拋出 QuotaExceededError，回傳 data 卻是 null。

修復：網路結果與快取持久化失敗分開處理；資料已成功取得時仍提供新資料，另外揭露無法儲存的警告。

### STORAGE-01：localStorage 屬性本身不可存取時仍會拋錯

`readArray(key, storage = global.localStorage)` 的預設參數在 try 外求值。模擬 getter 拋出 SecurityError 時，初始化仍失敗。首頁 `cheer_home_team` 與新導航的 sessionStorage 也未被全面保護。

修復：將 storage 取得、讀寫、解析全部納入安全存取；驗證陣列元素，不只驗證 Array.isArray，避免舊資料如 `[null]` 讓後面的 `.map(s => s.id)` 崩潰。保留復原資料而非 clear 全部。

## 5. PWA 需再修正的問題

### PWA-01：沒有按更新也會自動 reload

`pwa.js` 對每次 controllerchange 都執行 location.reload，只有 refreshing 防止第二次呼叫，沒有檢查本頁是否已確認更新。

受控結果：controller 初始為 null，發出 controllerchange，未按更新仍呼叫 reload 一次。這會涵蓋第一次 worker 接管等不該無條件中斷的情境。

修復：區分第一次接管與使用者確認更新；保護未完成輸入，並測試另一個分頁觸發更新。更新 worker 的監聽也應保留實際 worker 參考，而非完全依賴之後可能改變的 registration.installing。

### SW-01：等待開啟快取後才 clone 回應，有競態風險

`sw.js` 在 `caches.open(...).then(...)` 內才呼叫 `response.clone()`，但原 response 已可能交還呼叫者使用。

受控結果：先消耗回應 body，再完成 caches.open，取得 `Response.clone: Body has already been consumed.`。這是被控制時序重現的競態，不代表每次瀏覽都會發生。

修復：在交還原 response 之前同步 clone；將 cache 寫入 promise 正確交給事件生命週期，並驗證快取寫入失敗不會破壞成功的網路回應。

需另外驗收：版本資產一致性、runtime cache 容量／到期、離線時 no-store 資料來源的應用層備援、同源其他專案快取保護，以及 production 舊 worker 升級。

## 6. 其他未完成內容與聲明修正

- 「收藏女孩」目前連到一般 girls；「個人行程」連到公開 events，沒有專屬清單或收藏篩選。按鈕存在不能視為已完成相應功能。
- 桌面 nav 被 append 到 body 尾端，使用 sticky top 不等於一開始就在頁首；桌面重複導覽、手機舊頂列是否誤藏球隊選單需以整頁 DOM 驗證。
- `aria-current` 應設定有意義的值（例如 page），不是只使用布林屬性切換；補上焦點、模態背景不可操作與鍵盤驗證。
- package.json 的 lint 與 typecheck 都是 `node --check`，實際只作語法檢查，不是完整 lint／型別分析。build-check.js 只检查檔案存在、首頁引用與 manifest JSON，不是前端打包或瀏覽器相容性驗收。
- 原有六個測試中，service worker 測試只是字串／正規表示式檢查，沒有實際驗證生命週期與快取行為。新增真正行為測試，不要刪除 failing assertions 或以修改預期值使測試變綠。
- 這是第一階段雛形，首頁的主要業務程式仍未逐功能拆分，不能宣稱整個專業架構重構已完成。

## 7. 下一個可驗收交付

先完成 NAV-01 至 NAV-05、DATA-INTEGRATION／DATA-01／STORAGE-01、PWA-01／SW-01 的修正與真實整合測試，再擴大架構遷移。

在本分支讀取已歸檔的 patch，核对當前分支與未提交修改。尚未套用時，先執行 `git apply --check deliverables/pwa-mobile-foundation-1be477f.patch`，通過後才套用；已套用的環境不得重複套用。不要強制覆蓋部分變更、不要依賴舊雲端 SHA；存在衝突就說明並保留現況。

此 review 的 `tests/review/pwa-foundation-regressions.mjs` 是可執行的診斷案例；於完成套用後在 repo 根目錄使用：

```sh
node --experimental-vm-modules --test tests/review/pwa-foundation-regressions.mjs
```

如果重構後改變模組介面，應調整 fixture 以對接新介面並保留上述行為要求，同時補真正的整頁測試；不能只讓模擬器自圓其說。

交付需包含實際程式差異、命令與輸出、已驗證／未驗證項目及可重現的預覽方式。環境不支援浏览器、發布或附件時，一次回報原因，保留完整 patch，不要循環安裝 MCP／make_pr。維持 Draft、不合併 main、不部署、不清除使用者資料、不對正式寫入端點測試。

## 參考與證據位置

- 基準：`634bfef805c9e8668bbaa262422945661b4a9d6c` 的 index.html，特別是 loadData（約 2080 起）、init（約 2316 起）、setMode（約 3030 起）。
- 程式來源：本分支已歸檔的完整原始 patch。
- Node CLI 官方說明：`https://nodejs.org/api/cli.html#-c---check`，--check 僅作語法檢查。
- Git 官方說明：`https://git-scm.com/docs/git-apply`，--check 只驗證是否可套用，不代表網站功能正確。
- MDN：`https://developer.mozilla.org/en-US/docs/Web/API/Response/clone`，回應 body 已使用後不能再 clone。

所有測試數字都是本次針對上述明確範圍的結果，不是完整產品驗收或真機保證。
