from pathlib import Path
import re

crawler = Path('tools/fetch_auto_news.py')
text = crawler.read_text(encoding='utf-8')
pattern = re.compile(r"def classify_news\(.*?\n\n\ndef extract_meta\(", re.S)
replacement = '''def classify_news(
    title: str,
    desc: str,
    matched_girls: list[str],
    matched_teams: list[str],
) -> tuple[str, str] | None:
    hay = f"{title} {desc}"
    hay_lower = hay.lower()
    has_cheer_word = any(term.lower() in hay_lower for term in CHEER_TERMS)

    if has_cheer_word:
        return "啦啦隊情報", (matched_girls[0] if matched_girls else (matched_teams[0] if matched_teams else "綜合"))

    sport_match = None
    for main_category, subcategory, terms in SPORT_RULES:
        if any(term.lower() in hay_lower for term in terms):
            sport_match = (main_category, subcategory)
            break

    if sport_match is None:
        generic_rules = [
            ("棒球情報", "中職", ["棒球", "中職", "cpbl", "台鋼", "雄鷹", "兄弟", "桃猿", "味全龍", "統一獅", "富邦悍將"]),
            ("棒球情報", "MLB", ["mlb", "大聯盟", "道奇", "洋基"]),
            ("籃球情報", "TPBL", ["籃球", "tpbl", "國王", "海神", "攻城獅", "戰神", "雲豹", "中信特攻", "夢想家"]),
            ("籃球情報", "PLG", ["plg", "p. league", "勇士", "領航猿"]),
            ("排球情報", "TVBL", ["排球", "職排", "tvbl", "tpvl", "連莊"]),
        ]
        for main_category, subcategory, terms in generic_rules:
            if any(term.lower() in hay_lower for term in terms):
                sport_match = (main_category, subcategory)
                break

    if sport_match:
        return sport_match
    if matched_girls:
        return "啦啦隊情報", matched_girls[0]
    return None


def extract_meta('''
new_text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f'classify_news replacement count={count}')
crawler.write_text(new_text, encoding='utf-8')

index = Path('index.html')
html = index.read_text(encoding='utf-8')
old = '''                const hashRaw = getField(n, ['hashtags', '標籤雲', '關鍵字', 'keywords'], '');
                hashRaw.split(/[,\\s、，]+/).filter(Boolean).forEach(tag => validNewsHashtags.add(tag));'''
new = '''                const hashRaw = getField(n, ['hashtags', '標籤雲', '關鍵字', 'keywords'], '');
                if (hashRaw) {
                    hashRaw.split(/[,\\s、，]+/).filter(Boolean).forEach(tag => validNewsHashtags.add(tag));
                } else {
                    validNewsHashtags.add(mainTag);
                }'''
if old not in html:
    raise SystemExit('hashtag validity block not found')
index.write_text(html.replace(old, new, 1), encoding='utf-8')
print('final news hotfix applied')
