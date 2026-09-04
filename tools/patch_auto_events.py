from pathlib import Path
import re

path = Path('index.html')
text = path.read_text(encoding='utf-8')
original = text

# Keep the public Events naming.
text = text.replace('外籍行程 EVENTS', '公開行程 EVENTS')
text = text.replace('外籍行程大廳', '公開行程大廳')
text = text.replace('外籍行程與賽事專屬彈窗', '公開行程與賽事專屬彈窗')
text = text.replace("'${e.eventname||\"外籍行程\"}'", "'${e.eventname||\"公開行程\"}'")

# Force a brand-new cache namespace so stale crawler events in localStorage are never reused.
text = re.sub(
    r'const CACHE_KEY = "tw_cheerleader_cache_v\d+";',
    'const CACHE_KEY = "tw_cheerleader_cache_v33";',
    text,
    count=1,
)

# Remove the browser-side "+新增活動" tool completely.
text = re.sub(
    r'\n<style>\s*\.manual-event-launch\{.*?</style>',
    '',
    text,
    count=1,
    flags=re.S,
)
text = text.replace(
    '<button class="manual-event-launch" type="button" onclick="window.openManualEventModal()">＋新增活動</button>',
    '',
)
text = re.sub(
    r'\n<div id="manual-event-overlay" class="manual-event-overlay".*?</script>\s*(?=</body>)',
    '\n',
    text,
    count=1,
    flags=re.S,
)

# Stop loading crawler-generated auto-events. Keep only Sheet Events + manual-events.json.
text = text.replace(
    'const [girlsData, eventsData, schedulesData, newsData, matchesData, themesData, autoNewsData, autoEventsData, manualEventsData] = await Promise.all([',
    'const [girlsData, eventsData, schedulesData, newsData, matchesData, themesData, autoNewsData, manualEventsData] = await Promise.all([',
    1,
)
text = text.replace(
    'const [girlsData, eventsData, schedulesData, newsData, matchesData, themesData, autoNewsData, autoEventsData] = await Promise.all([',
    'const [girlsData, eventsData, schedulesData, newsData, matchesData, themesData, autoNewsData, manualEventsData] = await Promise.all([',
    1,
)

# Delete any auto-events fetch line while preserving the following manual-events fetch.
text = re.sub(
    r'\n\s*fetch\(`data/auto-events\.json\?t=\$\{t\}`[^\n]*\),?',
    '',
    text,
)

# If manual-events.json is not in the Promise yet, append it after auto-news.
if 'fetch(`data/manual-events.json?t=${t}`' not in text:
    text = text.replace(
        "                    fetch(`data/auto-news.json?t=${t}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }).then(r => r.ok ? r.json() : []).catch(() => [])\n                ]);",
        "                    fetch(`data/auto-news.json?t=${t}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }).then(r => r.ok ? r.json() : []).catch(() => []),\n                    fetch(`data/manual-events.json?t=${t}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }).then(r => r.ok ? r.json() : []).catch(() => [])\n                ]);",
        1,
    )

# Replace the old event merge (which included crawler data) with Sheet + manual only.
event_block = re.compile(
    r'\s*const manualEvents = Array\.isArray\(eventsData\).*?\.filter\(e => e\.safeDate\);',
    re.S,
)
replacement = '''
                const sheetEvents = Array.isArray(eventsData) ? eventsData.filter(e => e.eventname || e.girls) : [];
                const manualEvents = Array.isArray(manualEventsData) ? manualEventsData.filter(e => e.eventname || e.girls) : [];
                const eventSeen = new Set();
                dbEvents = [...manualEvents, ...sheetEvents]
                    .filter(e => {
                        const key = [e.date || '', e.time || '', e.host || '', e.eventname || '', e.girls || ''].join('|').trim().toLowerCase();
                        if (!key || eventSeen.has(key)) return false;
                        eventSeen.add(key);
                        return true;
                    })
                    .map(e => ({ ...e, safeDate: parseDateFlexible(e.date) }))
                    .filter(e => e.safeDate);'''
text, replaced = event_block.subn(replacement, text, count=1)

# Handle older code that still maps eventsData directly.
old_direct = '                dbEvents = eventsData.map(e => ({ ...e, safeDate: parseDateFlexible(e.date) })).filter(e => e.safeDate);'
if old_direct in text:
    text = text.replace(old_direct, replacement, 1)

if text == original:
    print('No public Events cleanup changes were needed.')
else:
    path.write_text(text, encoding='utf-8')
    print(f'Public Events cleanup applied. event_merge_replaced={replaced}')
