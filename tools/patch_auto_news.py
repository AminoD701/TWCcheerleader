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

# Fresh cache namespace for this rollout.
for old in ('v26','v27','v28'):
    text = text.replace(f'const CACHE_KEY = "tw_cheerleader_cache_{old}";', 'const CACHE_KEY = "tw_cheerleader_cache_v29";', 1)

# On cached core-data path, always re-fetch fresh news.
old_cached_start = '''                        dbNews = parsed.dbNews || []; '''
text = text.replace(old_cached_start, '''                        dbNews = []; // news is never trusted from localStorage\n''', 1)

# Make all auto-news requests bypass HTTP cache.
text = text.replace(
    "fetch(`data/auto-news.json?t=${nt}`, { cache: 'no-store' })",
    "fetch(`data/auto-news.json?t=${nt}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })"
)
text = text.replace(
    "fetch(`data/auto-news.json?t=${t}`, { cache: 'no-store' })",
    "fetch(`data/auto-news.json?t=${t}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })"
)

# Add a dedicated live refresh function and call it whenever the news page renders.
refresh_fn = '''
        window.refreshLatestNews = async function(forceRender = false) {
            if (window.__newsRefreshInFlight) return;
            window.__newsRefreshInFlight = true;
            try {
                const nt = Date.now();
                const newsBaseUrl = `https://docs.google.com/spreadsheets/d/e/2PACX-1vT9l-hRhzMwcRdyQHsRs_97fja0Gg4RCcDDMk31u-dSbbQmk_JIUmbPTAj2gaNYmb6bYTwUvv4_1IxN/pub?output=csv&rand=${nt}`;
                const [freshManualNews, freshAutoNews] = await Promise.all([
                    fetchCSV(`${newsBaseUrl}&gid=417186374&t=${nt}`).catch(() => []),
                    fetch(`data/auto-news.json?t=${nt}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
                        .then(r => r.ok ? r.json() : []).catch(() => [])
                ]);
                const seen = new Set();
                const merged = [
                    ...(Array.isArray(freshManualNews) ? freshManualNews.filter(n => n.title) : []),
                    ...(Array.isArray(freshAutoNews) ? freshAutoNews.filter(n => n.title) : [])
                ].filter(n => {
                    const key = ((n.url || '') + '|' + (n.title || '')).trim().toLowerCase();
                    if (!key || seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
                if (merged.length) {
                    dbNews = merged;
                    window.__newsLastRefresh = Date.now();
                    if (forceRender && currentMode === 'news' && typeof window.renderNewsHub === 'function') {
                        window.renderNewsHub(true);
                    }
                }
            } catch (e) {
                console.warn('Live news refresh failed', e);
            } finally {
                window.__newsRefreshInFlight = false;
            }
        };
'''

insert_after = '''        function fetchCSV(url) {
            return new Promise((resolve, reject) => {
                Papa.parse(url, {
                    download: true,
                    header: true,
                    skipEmptyLines: true,
                    transformHeader: h => h.trim().toLowerCase().replace(/[\\s_]/g, ""),
                    complete: res => resolve(res.data),
                    error: err => reject(err)
                });
            });
        }
'''
if 'window.refreshLatestNews = async function' not in text and insert_after in text:
    text = text.replace(insert_after, insert_after + refresh_fn, 1)

old_render_sig = '''        window.renderNewsHub = function() {
            const container = document.getElementById('news-container');'''
new_render_sig = '''        window.renderNewsHub = function(skipRefresh = false) {
            const container = document.getElementById('news-container');
            if (!skipRefresh && (!window.__newsLastRefresh || Date.now() - window.__newsLastRefresh > 15000)) {
                window.refreshLatestNews(true);
            }'''
if old_render_sig in text:
    text = text.replace(old_render_sig, new_render_sig, 1)

# News images from publishers should use the raw external URL. Local site images can still use getCdnUrl.
text = text.replace(
    "const imgUrl = imgUrls.length > 0 ? window.getCdnUrl(imgUrls[0]) : '';",
    "const imgUrl = imgUrls.length > 0 ? (/^https?:\\/\\//i.test(imgUrls[0]) ? imgUrls[0] : window.getCdnUrl(imgUrls[0])) : '';"
)

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
    print('Live news refresh and publisher image handling patched successfully.')
