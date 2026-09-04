from pathlib import Path

path = Path('index.html')
text = path.read_text(encoding='utf-8')
original = text

# Rename the section to cover both local and foreign cheerleaders.
text = text.replace('外籍行程 EVENTS', '公開行程 EVENTS')
text = text.replace('外籍行程大廳', '公開行程大廳')
text = text.replace('外籍行程與賽事專屬彈窗', '公開行程與賽事專屬彈窗')
text = text.replace("'${e.eventname||\"外籍行程\"}'", "'${e.eventname||\"公開行程\"}'")

# Force a fresh cache namespace for the new Events data model.
for old in ('v28', 'v29', 'v30'):
    text = text.replace(f'const CACHE_KEY = "tw_cheerleader_cache_{old}";', 'const CACHE_KEY = "tw_cheerleader_cache_v31";', 1)

# Add auto-events to the main data load Promise.
old_sig = 'const [girlsData, eventsData, schedulesData, newsData, matchesData, themesData, autoNewsData] = await Promise.all(['
new_sig = 'const [girlsData, eventsData, schedulesData, newsData, matchesData, themesData, autoNewsData, autoEventsData] = await Promise.all(['
if old_sig in text:
    text = text.replace(old_sig, new_sig, 1)

old_tail = '''                    fetch(`data/auto-news.json?t=${t}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }).then(r => r.ok ? r.json() : []).catch(() => [])
                ]);'''
new_tail = '''                    fetch(`data/auto-news.json?t=${t}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }).then(r => r.ok ? r.json() : []).catch(() => []),
                    fetch(`data/auto-events.json?t=${t}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }).then(r => r.ok ? r.json() : []).catch(() => [])
                ]);'''
if old_tail in text:
    text = text.replace(old_tail, new_tail, 1)
else:
    old_tail2 = '''                    fetch(`data/auto-news.json?t=${t}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => [])
                ]);'''
    new_tail2 = '''                    fetch(`data/auto-news.json?t=${t}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []),
                    fetch(`data/auto-events.json?t=${t}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => [])
                ]);'''
    if old_tail2 in text:
        text = text.replace(old_tail2, new_tail2, 1)

old_events = '''                dbEvents = eventsData.map(e => ({ ...e, safeDate: parseDateFlexible(e.date) })).filter(e => e.safeDate);'''
new_events = '''                const manualEvents = Array.isArray(eventsData) ? eventsData.filter(e => e.eventname || e.girls) : [];
                const automaticEvents = Array.isArray(autoEventsData) ? autoEventsData.filter(e => e.eventname && e.date && e.girls) : [];
                const eventSeen = new Set();
                dbEvents = [...manualEvents, ...automaticEvents]
                    .filter(e => {
                        const key = [e.date || '', e.eventname || '', e.girls || ''].join('|').trim().toLowerCase();
                        if (!key || eventSeen.has(key)) return false;
                        eventSeen.add(key);
                        return true;
                    })
                    .map(e => ({ ...e, safeDate: parseDateFlexible(e.date) }))
                    .filter(e => e.safeDate);'''
if old_events in text:
    text = text.replace(old_events, new_events, 1)

# External event posters should use their publisher URL directly.
text = text.replace(
    'const imgClean = window.getCdnUrl(imgUrls[0]);',
    "const imgClean = /^https?:\\/\\//i.test(imgUrls[0]) ? imgUrls[0] : window.getCdnUrl(imgUrls[0]);"
)
text = text.replace(
    'const imgClean = window.getCdnUrl(u);',
    "const imgClean = /^https?:\\/\\//i.test(u) ? u : window.getCdnUrl(u);"
)

if text == original:
    print('No Events integration changes were needed.')
else:
    path.write_text(text, encoding='utf-8')
    print('Automatic public events integrated successfully.')
