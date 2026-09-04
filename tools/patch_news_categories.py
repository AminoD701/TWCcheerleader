from pathlib import Path

path = Path('index.html')
text = path.read_text(encoding='utf-8')
original = text

normalize_fn = r'''
        // Canonical news category mapping: legacy Sheet labels + automatic feed labels
        window.normalizeNewsCategory = function(value) {
            const raw = String(value || '').trim();
            const key = raw.toLowerCase().replace(/[\s_\-+\.]/g, '');
            if (!key) return '未分類';

            if (key.includes('啦啦隊') || key.includes('cheer')) return '啦啦隊';
            if (key.includes('mlb') || key.includes('大聯盟')) return 'MLB';
            if (key.includes('cpbl') || key.includes('中華職棒') || key === '中職' || key.includes('中職新聞')) return 'CPBL';
            if (key.includes('tpbl') || key.includes('台灣職業籃球大聯盟')) return 'TPBL';
            if (key.includes('plg') || key.includes('pleague')) return 'PLG';
            if (key.includes('tvbl') || key.includes('tpvl') || key.includes('職業排球') || key === '職排') return 'TVBL';

            return raw;
        };
'''

anchor = '        window.renderDualTierNewsFilters = function(allNewsData) {'
if 'window.normalizeNewsCategory = function' not in text and anchor in text:
    text = text.replace(anchor, normalize_fn + '\n' + anchor, 1)

# Dropdown tree must use canonical categories, never raw legacy labels.
text = text.replace(
    'let mainTag = (n.tag || n[\'標籤\'] || n[\'分類\'] || "未分類").trim();',
    'let mainTag = window.normalizeNewsCategory(n.tag || n[\'標籤\'] || n[\'分類\'] || "未分類");'
)

# Filtering must use the same canonical category as the dropdown.
text = text.replace(
    "let mainTag = getField(n, ['tag', '標籤', '分類標籤', '分類'], '未分類');",
    "let mainTag = window.normalizeNewsCategory(getField(n, ['tag', '標籤', '分類標籤', '分類'], '未分類'));"
)

# Selected category is canonical too.
text = text.replace(
    'window.currentMainCategory = mainTag;',
    'window.currentMainCategory = (mainTag === "全部" ? "全部" : window.normalizeNewsCategory(mainTag));'
)

# Canonicalize every merged news object from both fresh and full-load paths.
text = text.replace(
    'dbNews = merged;',
    "dbNews = merged.map(n => ({ ...n, tag: window.normalizeNewsCategory(n.tag || n['標籤'] || n['分類'] || '未分類') }));"
)
text = text.replace(
    'dbNews = [...manualNews, ...automaticNews].filter(n => {',
    'dbNews = [...manualNews, ...automaticNews].filter(n => {'
)

# After full-load dedupe block, canonicalize in place before any render.
full_marker = '''                dbNews = [...manualNews, ...automaticNews].filter(n => {
                    const key = ((n.url || '') + '|' + (n.title || '')).trim().toLowerCase();
                    if (!key || newsSeen.has(key)) return false;
                    newsSeen.add(key);
                    return true;
                });'''
full_replacement = full_marker + '''
                dbNews = dbNews.map(n => ({
                    ...n,
                    tag: window.normalizeNewsCategory(n.tag || n['標籤'] || n['分類'] || '未分類')
                }));'''
if full_marker in text and full_replacement not in text:
    text = text.replace(full_marker, full_replacement, 1)

if text == original:
    print('No category changes needed.')
else:
    path.write_text(text, encoding='utf-8')
    print('Canonical news category merge patched successfully.')
