from pathlib import Path

path = Path('index.html')
text = path.read_text(encoding='utf-8')
original = text

# Keep the full-load automatic news integration in place.
old_promise = '''                const [girlsData, eventsData, schedulesData, newsData, matchesData, themesData] = await Promise.all([
                    fetchCSV(`${baseUrl}&gid=0&t=${t}`),
                    fetchCSV(`${baseUrl}&gid=925411186&t=${t}`),
                    fetchCSV(`${baseUrl}&gid=1702657458&t=${t}`),
                    fetchCSV(`${baseUrl}&gid=417186374&t=${t}`),
                    fetchCSV(`${baseUrl}&gid=92509162&t=${t}`),
                    fetchCSV(`${baseUrl}&gid=547736461&t=${t}`)
                ]);'''

new_promise = '''                const [girlsData, eventsData, schedulesData, newsData, matchesData, themesData, autoNewsData] = await Promise.all([
                    fetchCSV(`${baseUrl}&gid=0&t=${t}`),
                    fetchCSV(`${baseUrl}&gid=925411186&t=${t}`),
                    fetchCSV(`${baseUrl}&gid=1702657458&t=${t}`),
                    fetchCSV(`${baseUrl}&gid=417186374&t=${t}`),
                    fetchCSV(`${baseUrl}&gid=92509162&t=${t}`),
                    fetchCSV(`${baseUrl}&gid=547736461&t=${t}`),
                    fetch(`data/auto-news.json?t=${t}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => [])
                ]);'''

if old_promise in text:
    text = text.replace(old_promise, new_promise, 1)
else:
    text = text.replace(
        "fetch(`data/auto-news.json?t=${t}`).then(r => r.ok ? r.json() : []).catch(() => [])",
        "fetch(`data/auto-news.json?t=${t}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => [])",
        1,
    )

old_dbnews = '''                dbNews = newsData.filter(n => n.title);'''
new_dbnews = '''                const manualNews = newsData.filter(n => n.title);
                const automaticNews = Array.isArray(autoNewsData) ? autoNewsData.filter(n => n.title) : [];
                const newsSeen = new Set();
                dbNews = [...manualNews, ...automaticNews].filter(n => {
                    const key = ((n.url || '') + '|' + (n.title || '')).trim().toLowerCase();
                    if (!key || newsSeen.has(key)) return false;
                    newsSeen.add(key);
                    return true;
                });'''

if old_dbnews in text and new_dbnews not in text:
    text = text.replace(old_dbnews, new_dbnews, 1)

while text.count(new_dbnews) > 1:
    first = text.find(new_dbnews)
    duplicate = text.find(new_dbnews, first + len(new_dbnews))
    text = text[:duplicate] + '                // dbNews already merged above; do not redeclare const variables here.\n' + text[duplicate + len(new_dbnews):]

# New cache namespace: cached core data may stay fast, but cached news is never trusted.
text = text.replace('const CACHE_KEY = "tw_cheerleader_cache_v26";', 'const CACHE_KEY = "tw_cheerleader_cache_v28";', 1)
text = text.replace('const CACHE_KEY = "tw_cheerleader_cache_v27";', 'const CACHE_KEY = "tw_cheerleader_cache_v28";', 1)

old_cached_block = '''                        if (dbGirls.length > 0) {
                            // 即使其他資料使用 1 小時快取，新聞仍重新抓最新 auto-news，避免畫面停在舊月份。
                            try {
                                const autoNewsData = await fetch(`data/auto-news.json?t=${Date.now()}`).then(r => r.ok ? r.json() : []);
                                if (Array.isArray(autoNewsData) && autoNewsData.length > 0) {
                                    const manualCached = (dbNews || []).filter(n => !n.auto);
                                    const newsSeen = new Set();
                                    dbNews = [...manualCached, ...autoNewsData].filter(n => {
                                        const key = ((n.url || '') + '|' + (n.title || '')).trim().toLowerCase();
                                        if (!key || newsSeen.has(key)) return false;
                                        newsSeen.add(key);
                                        return true;
                                    });
                                }
                            } catch(e) {}
                            buildGirlMap(); init(); enableEnterButton(); 
                            return;
                        }'''

new_cached_block = '''                        if (dbGirls.length > 0) {
                            // 核心資料可用快取，但新聞每次進站都重新抓「人工 Sheet + 自動新聞 JSON」。
                            // 不再相信 localStorage 裡的 dbNews，避免新聞頁永久停在舊資料。
                            try {
                                const nt = Date.now();
                                const newsBaseUrl = `https://docs.google.com/spreadsheets/d/e/2PACX-1vT9l-hRhzMwcRdyQHsRs_97fja0Gg4RCcDDMk31u-dSbbQmk_JIUmbPTAj2gaNYmb6bYTwUvv4_1IxN/pub?output=csv&rand=${nt}`;
                                const [freshManualNews, freshAutoNews] = await Promise.all([
                                    fetchCSV(`${newsBaseUrl}&gid=417186374&t=${nt}`).catch(() => []),
                                    fetch(`data/auto-news.json?t=${nt}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => [])
                                ]);

                                const newsSeen = new Set();
                                const mergedFreshNews = [
                                    ...(Array.isArray(freshManualNews) ? freshManualNews.filter(n => n.title) : []),
                                    ...(Array.isArray(freshAutoNews) ? freshAutoNews.filter(n => n.title) : [])
                                ].filter(n => {
                                    const key = ((n.url || '') + '|' + (n.title || '')).trim().toLowerCase();
                                    if (!key || newsSeen.has(key)) return false;
                                    newsSeen.add(key);
                                    return true;
                                });

                                if (mergedFreshNews.length > 0) dbNews = mergedFreshNews;
                            } catch(e) {
                                console.warn('Fresh news refresh failed; using cached news as fallback.', e);
                            }

                            buildGirlMap(); init(); enableEnterButton();
                            return;
                        }'''

if old_cached_block in text:
    text = text.replace(old_cached_block, new_cached_block, 1)
elif 'const mergedFreshNews = [' not in text:
    print('Warning: cached news block not found; fresh-news replacement was not applied.')

needle = '''                        <div class="modal-news-text" style="margin-bottom: 20px; margin-top: 0px; padding-top: 0px;">${contentText}</div>
                        
                        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px;">'''
replacement = '''                        <div class="modal-news-text" style="margin-bottom: 20px; margin-top: 0px; padding-top: 0px;">${contentText}</div>
                        ${getField(n, ['url', 'link', '原文', '原文網址'], '') ? `<div style="margin: -5px 0 20px;"><a href="${getField(n, ['url', 'link', '原文', '原文網址'], '')}" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; gap:8px; background:var(--modal-accent); color:#050505; text-decoration:none; padding:10px 16px; border-radius:6px; font-size:13px; font-weight:900;">查看原文 ↗</a></div>` : ''}
                        
                        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px;">'''
if needle in text:
    text = text.replace(needle, replacement, 1)

if text == original:
    print('No changes needed.')
else:
    path.write_text(text, encoding='utf-8')
    print('Fresh news loading patched successfully.')
