from pathlib import Path

path = Path('index.html')
text = path.read_text(encoding='utf-8')
original = text

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
                    fetch(`data/auto-news.json?t=${t}`).then(r => r.ok ? r.json() : []).catch(() => [])
                ]);'''

if old_promise in text:
    text = text.replace(old_promise, new_promise, 1)

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

# Force a one-time cache reset for everyone after introducing automatic news.
text = text.replace('const CACHE_KEY = "tw_cheerleader_cache_v26";', 'const CACHE_KEY = "tw_cheerleader_cache_v27";', 1)

old_cached_return = '''                        if (dbGirls.length > 0) {
                            buildGirlMap(); init(); enableEnterButton(); 
                            return; // ✨ 移除了會導致黑屏的錯誤自動淡出代碼
                        }'''
new_cached_return = '''                        if (dbGirls.length > 0) {
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
if old_cached_return in text:
    text = text.replace(old_cached_return, new_cached_return, 1)

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
    print('Automatic news cache refresh patched successfully.')
