from pathlib import Path
import re

path = Path('index.html')
text = path.read_text(encoding='utf-8')
original = text

normalize_block = r'''
        // Canonical two-tier news taxonomy.
        // Main category = sport/topic; league/person belongs to the subcategory.
        window.normalizeNewsCategory = function(value) {
            const raw = String(value || '').trim();
            const key = raw.toLowerCase().replace(/[\s_\-+\.]/g, '');
            if (!key) return '未分類';

            if (key.includes('啦啦隊') || key.includes('cheer')) return '啦啦隊情報';
            if (key.includes('棒球') || key.includes('baseball') || key.includes('mlb') || key.includes('大聯盟') || key.includes('cpbl') || key.includes('中華職棒') || key === '中職' || key.includes('中職新聞')) return '棒球情報';
            if (key.includes('籃球') || key.includes('basketball') || key.includes('tpbl') || key.includes('台灣職業籃球大聯盟') || key.includes('plg') || key.includes('pleague')) return '籃球情報';
            if (key.includes('排球') || key.includes('volleyball') || key.includes('tvbl') || key.includes('tpvl') || key.includes('職排')) return '排球情報';

            return raw;
        };

        window.normalizeNewsSubcategory = function(news, mainCategory) {
            const raw = String(news?.subtag || news?.sub_tag || news?.['子分類'] || news?.subTag || '').trim();
            const sourceTag = String(news?.tag || news?.['標籤'] || news?.['分類'] || '').trim();
            const title = String(news?.title || news?.['標題'] || '').trim();
            const hay = `${raw} ${sourceTag} ${title}`;
            const key = hay.toLowerCase().replace(/[\s_\-+\.]/g, '');

            if (mainCategory === '棒球情報') {
                if (key.includes('mlb') || key.includes('大聯盟')) return 'MLB';
                if (key.includes('cpbl') || key.includes('中華職棒') || key.includes('中職')) return '中職';
                return raw && raw !== mainCategory ? raw : '其他棒球';
            }
            if (mainCategory === '籃球情報') {
                if (key.includes('tpbl') || key.includes('台灣職業籃球大聯盟')) return 'TPBL';
                if (key.includes('plg') || key.includes('pleague')) return 'PLG';
                return raw && raw !== mainCategory ? raw : '其他籃球';
            }
            if (mainCategory === '排球情報') {
                if (key.includes('tvbl') || key.includes('tpvl') || key.includes('台灣職業排球') || key.includes('職排')) return 'TVBL';
                return raw && raw !== mainCategory ? raw : '其他排球';
            }
            if (mainCategory === '啦啦隊情報') {
                if (raw && !['啦啦隊', '啦啦隊情報', 'cheer'].includes(raw.toLowerCase())) return raw;
                return '綜合';
            }
            return raw || '綜合';
        };
'''

# Replace the prior taxonomy block if present; otherwise insert before the news-filter engine.
pattern = re.compile(
    r"\n\s*// Canonical news category mapping:.*?window\.normalizeNewsCategory = function\(value\) \{.*?\n\s*\};\n",
    re.S,
)
if pattern.search(text):
    text = pattern.sub('\n' + normalize_block + '\n', text, count=1)
elif 'window.normalizeNewsSubcategory = function' not in text:
    anchor = '        window.renderDualTierNewsFilters = function(allNewsData) {'
    if anchor in text:
        text = text.replace(anchor, normalize_block + '\n' + anchor, 1)

# Dropdown trees and filtering must use the same normalized subcategory.
old_subtag_tree = '''                let rawSubTag = (n.subtag || n.sub_tag || n['子分類'] || n.subTag || ""); 
                let subTag = rawSubTag.trim() !== "" ? rawSubTag.trim() : null;'''
new_subtag_tree = '''                let subTag = window.normalizeNewsSubcategory(n, mainTag);'''
text = text.replace(old_subtag_tree, new_subtag_tree)

old_subtag_filter = '''                let rawSubTag = getField(n, ['subtag', 'sub_tag', '子分類', 'subTag'], '');
                let subTag = rawSubTag !== "" ? rawSubTag : "全部";'''
new_subtag_filter = '''                let subTag = window.normalizeNewsSubcategory(n, mainTag);'''
text = text.replace(old_subtag_filter, new_subtag_filter)

# Selected category is canonical too.
text = text.replace(
    'window.currentMainCategory = mainTag;',
    'window.currentMainCategory = (mainTag === "全部" ? "全部" : window.normalizeNewsCategory(mainTag));'
)

# Canonicalize every merged news object from fresh/manual/automatic feeds.
old_map = "dbNews = merged.map(n => ({ ...n, tag: window.normalizeNewsCategory(n.tag || n['標籤'] || n['分類'] || '未分類') }));"
new_map = "dbNews = merged.map(n => { const tag = window.normalizeNewsCategory(n.tag || n['標籤'] || n['分類'] || '未分類'); return { ...n, tag, subtag: window.normalizeNewsSubcategory(n, tag) }; });"
text = text.replace(old_map, new_map)

full_old = '''                dbNews = dbNews.map(n => ({
                    ...n,
                    tag: window.normalizeNewsCategory(n.tag || n['標籤'] || n['分類'] || '未分類')
                }));'''
full_new = '''                dbNews = dbNews.map(n => {
                    const tag = window.normalizeNewsCategory(n.tag || n['標籤'] || n['分類'] || '未分類');
                    return { ...n, tag, subtag: window.normalizeNewsSubcategory(n, tag) };
                });'''
text = text.replace(full_old, full_new)

# Navigation can restore legacy CPBL/MLB/etc state from the previous app version. Canonicalize it before filtering.
render_anchor = '''        window.renderNewsHub = function(skipRefresh = false) {
            const container = document.getElementById('news-container');'''
render_replacement = '''        window.renderNewsHub = function(skipRefresh = false) {
            const container = document.getElementById('news-container');
            if (window.currentMainCategory && window.currentMainCategory !== '全部') {
                const legacyMain = window.currentMainCategory;
                window.currentMainCategory = window.normalizeNewsCategory(legacyMain);
                if (window.currentSubCategory && window.currentSubCategory !== '全部') {
                    window.currentSubCategory = window.normalizeNewsSubcategory({ tag: legacyMain, subtag: window.currentSubCategory }, window.currentMainCategory);
                }
            }'''
if render_anchor in text and render_replacement not in text:
    text = text.replace(render_anchor, render_replacement, 1)

if text == original:
    print('No category changes needed.')
else:
    path.write_text(text, encoding='utf-8')
    print('Two-tier news taxonomy and legacy-state normalization patched successfully.')
