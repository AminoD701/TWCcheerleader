# Current membership / news reliability review

Repository: AminoD701/TWCcheerleader only.
Base: b0667b908498e078160f8fcddd57504c135601e5.
Branch: codex/current-membership-news-review.
No merge, deployment, Sheet mutation or personal-storage migration performed.

## 1. Logo — BLOCKED, not claimed complete
The supplied attachment contains only pasted-text.txt, no transparent PNG.
No replacement image was fabricated and no mapping was pointed at a missing file.
Existing mapping: src/app/team-logo-overrides.js, Si-ster / Si-ster 可莉女孩 / SiSter / SI-STER → images/koli_engineer_logo.jpg?v=2.
Related legacy files: images/koli_engineer_logo.svg, images/sister_logo.jpg.
The desired destination is images/team-logos/koli-engineer.png once the actual user PNG is supplied.
Still pending: aliases 可利工程師 / 可利工程師啦啦隊, all card/filter/profile/match/schedule mappings and transparent contain visual QA.

## 2. Person vs current membership
Root cause: consumers iterate dbGirls directly. Team fields were treated as current membership regardless of departure notes; the old role filter only categorized notes as “special”.
src/app/girl-status.js now supplies isActiveGirl and shared schedule helpers.
Every note alias (note, notes, 備註, status) is checked; explicit 離隊/退隊/不續約/已卸任/前成員 wins, including notes mentioning trainees. English former/ended/inactive/departed/retired is also inactive.
Filtering is per membership row. Another active row for the same uid remains current.
Consumers: default girls roster, team dropdown, mobile team counts, current profile teams, future schedules and match-lineup associations, monthly active MVP, birthdays, lucky girl, new daily draws, voting pools and dream-team/minigame selections.
Default roster excludes departed memberships. Global name search still finds former people; cards mark former team, and profiles remain accessible by existing uid/name links.
dbGirls/girlMap, favorites, old news links and historical schedule records are not deleted. Saved draws are historical records, not new selections.
Agency affiliation and historical vote totals are not treated as proof of current cheer-team membership.

## 3. Data inventory and career
Same published Sheet retained:
- girls gid=0
- manual news gid=417186374
- events gid=925411186
- schedules gid=1702657458
- matches gid=92509162
- themes gid=547736461

data/girl-careers.json exists but records is currently empty. No dates or past teams were invented.
src/app/girl-career.js uses curated records first, supplemented by departed membership rows from the Sheet when missing.
Supports squad/team/cheerTeam and start/end/startDate/endDate fields. Missing end dates remain unspecified, never fabricated.
CURRENT derives only from active membership rows; no active teams → 目前無所屬隊伍.
CAREER retains former teams; current status in a history record cannot override a departed Sheet membership.
Other related files: src/app/girls-mobile-filters.js, src/app/game-app-enhancements.js, src/app/gacha-history.js (draw history, not team history), src/storage/legacy-storage.js; data/auto-events.json and data/manual-events.json remain independent historical/event sources.

## 4. News pipeline evidence (Taiwan time)
Workflow: Update automatic news.
Original cron: 17 */3 * * * (every 3 hours, UTC; not the expected 1–2 hours).
Proposed cron: 17 */2 * * * (nominally even Taiwan hours at :17). GitHub scheduling may be delayed; this is not a guaranteed wall-clock SLA.

Latest successful run: 2026/09/07 06:54:09–06:56:51.
https://github.com/AminoD701/TWCcheerleader/actions/runs/34065346140
Logs: 49 output items, 0 query failures, categories 35 cheer / 12 baseball / 1 volleyball / 1 basketball.

Latest failure examined: 2026/09/06 23:48:24–2026/09/07 00:03:00.
https://github.com/AminoD701/TWCcheerleader/actions/runs/34043458751
103 HTTP 503 query failures; generated 0 items. The commit step then failed with “main -> main (fetch first)”, not a missing contents-write permission.

Latest successful auto-news.json commit: 2026/09/07 06:56:47.
https://github.com/AminoD701/TWCcheerleader/commit/c57d900684b77835b22963e08d59c6880020be41
Newest article in inspected file: 2026/09/06 18:06 — 甩合約傳聞先寵粉！啦啦隊女神「一粒」現身　粉絲徹夜排隊應援.
Article time is distinct from feed modification time.

Inspected fetch_auto_news.py, run_auto_news.py, patch_auto_news.py, patch_news_categories.py, patch_news_ui.py and the four corresponding news workflows.
Patch workflows modify UI/integration on dispatch or tool changes; only update-auto-news.yml is the scheduled crawler.
Deduplication normalizes titles, then deduplicates resolved URLs within a run, not against all past articles. The observed empty run was caused by request failures, not persistent deduplication. Selection also applies a 10-day cutoff and category/source quotas; a successful run does not guarantee newer article publication times.
The CSV really uses realName; crawler header normalization now matches the frontend and no longer misses that field. Equal-length name sorting is deterministic.

Changes:
- Empty/unusable output raises an error and leaves the last good JSON and timestamp intact.
- Log query success/failure and raw/candidate/selected counts.
- Write backward-compatible array plus data/auto-news-meta.json.
- updatedAt changes only when payload changes; checkedAt is a separate run timestamp.
- SHA-256 binds metadata to exact feed bytes; mismatches show unknown time, never a falsely fresh date.
- Serialize scheduled writes with concurrency; rebase non-destructively before push; workflow dispatch on review branches cannot write main.
- No workflow was manually dispatched and no proposed cron is active before merge.

## 5. PWA
Existing no-store requests bypassed the SW entirely; ordinary same-origin resources used stale-while-revalidate. Thus the inspected auto-news request was not simply stuck in cache-first, but SW offered no offline fallback for that no-store request (the separate localStorage loader did).
All same-origin data/*.json now uses network-first + no-store fetch, bounded timeout and canonical URL cache keys (timestamp query strings removed), then last-success fallback on network/HTTP/JSON errors.
Live-data cache survives shell version upgrades. Only owned old shell caches are removed; localStorage is never cleared.
Shell version is v25 and includes new helpers. Updated dynamic script versions prevent stale career/game code.
Removed unconditional install skipWaiting: existing update button can activate the waiting worker and reload once accepted; first installation does not force reload. Existing users can accept the in-app update or close all site windows and reopen.
No manifest changes. The pre-existing icon test still expects superseded app-icon filenames; current manifest uses twc-app-icon-v3 files. Further inspection also found the advertised 512px icon file has 128px image dimensions, outside this targeted correction.

## 6. Verification
- Frontend node tests: 43/44 passed. Remaining pre-existing icons.test.js assertion expects old manifest filenames. Kept production icons unchanged.
- PWA foundation regression tests: 10/10 passed. Fixed Windows file-URL import and stale document mock; replaced hardcoded v5 test with versioned-cache assertion.
- New Python publish/header tests: 3/3 passed (failure preservation, unchanged timestamp/hash, realName header).
- Static build and changed JS syntax checks passed.
- Actual headless Chrome at 1366px and 390px, isolated fixture Sheet: default roster excludes departed person; global search/profile works; CAREER contains former Si-ster and CURRENT has no team; latest-news timestamp matches hashed JSON; changed server JSON appears on refresh; offline no-store fetch returns last successful JSON; real favorite toggle persists across reload; home-team and unrelated personal-storage sentinel survive; no horizontal overflow; zero page JS errors.
- Browser test: tests/review/current-data-browser.mjs. Optional CHEER_PLAYWRIGHT_PATH and CHEER_CHROME_PATH permit bundled runtimes. Screenshots are local review-artifacts/news-1366.png and news-390.png (not published).
- The browser tests use fixtures; the production site was not modified for testing.
- Not validated: supplied transparent logo (missing); actual installed Android/iOS PWA and real-device update from production v24. The controlled service-worker path and offline data behavior were browser-tested, not a substitute for those device tests.

## Review gate
Keep this PR draft until the transparent PNG is supplied, logo mappings/visual QA are finished, and the owner verifies installed-PWA behavior. Do not merge/deploy automatically.

