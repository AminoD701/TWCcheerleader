from pathlib import Path

path = Path('index.html')
text = path.read_text(encoding='utf-8')
original = text

normalize_fn = r'''
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

# Normalize category names while building the dropdown tree.
text = text.replace(
    'let mainTag = (n.tag || n[\'標籤\'] || n[\'分類\'] || "未分類").trim();',
    'let mainTag = window.normalizeNewsCategory(n.tag || n[\'標籤\'] || n[\'分類\'] || "未分類");'
)

# Normalize category names while filtering/rendering news.
text = text.replace(
    "let mainTag = getField(n, ['tag', '標籤', '分類標籤', '分類'], '未分類');",
    "let mainTag = window.normalizeNewsCategory(getField(n, ['tag', '標籤', '分類標籤', '分類'], '未分類'));"
)

# Normalize the selected category too, so old UI state / legacy labels still match.
text = text.replace(
    'window.currentMainCategory = mainTag;',
    'window.currentMainCategory = (mainTag === "全部" ? "全部" : window.normalizeNewsCategory(mainTag));'
)

# Normalize incoming objects once after merge as an extra safety layer.
merge_marker = '''                if (merged.length) {
                    dbNews = merged;'''
merge_replacement = '''                if (merged.length) {
                    dbNews = merged.map(n => ({
                        ...n,
                        tag: window.normalizeNewsCategory(n.tag || n['標籤'] || n['分類'] || '未分類')
                    }));'''
if merge_marker in text:
    text = text.replace(merge_marker, merge_replacement, 1)

if text == original:
    print('No category changes needed.')
else:
    path.write_text(text, encoding='utf-8')
    print('News category normalization patched successfully.')
