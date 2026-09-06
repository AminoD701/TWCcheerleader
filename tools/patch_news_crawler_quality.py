from pathlib import Path

path = Path('tools/fetch_auto_news.py')
text = path.read_text(encoding='utf-8')
original = text

anchor = '''def build_queries(girl_names: list[str]) -> list[str]:\n'''
helper = r'''AMBIGUOUS_LATIN_NAMES = {
    "ai", "et", "iu", "tv", "mvp", "mlb", "cpbl", "plg", "tpbl", "tvbl", "nba", "kbo",
}


def is_cjk_name(value: str) -> bool:
    return bool(re.search(r"[\u3400-\u9fff]", value))


def usable_girl_name(value: str) -> bool:
    name = (value or "").strip()
    if not name:
        return False
    if is_cjk_name(name):
        return len(name) >= 2
    compact = re.sub(r"[^a-z0-9]", "", name.lower())
    return len(compact) >= 3 and compact not in AMBIGUOUS_LATIN_NAMES


def girl_name_matches(name: str, hay: str) -> bool:
    if not usable_girl_name(name):
        return False
    if is_cjk_name(name):
        return name in hay
    # Latin stage names must match as a standalone token, not inside a publisher/domain name.
    return re.search(rf"(?<![A-Za-z0-9]){re.escape(name)}(?![A-Za-z0-9])", hay, flags=re.I) is not None


'''
if 'def usable_girl_name(' not in text:
    text = text.replace(anchor, helper + anchor, 1)

text = text.replace(
    'def build_queries(girl_names: list[str]) -> list[str]:\n    queries = list(BASE_QUERIES)',
    'def build_queries(girl_names: list[str]) -> list[str]:\n    girl_names = [name for name in girl_names if usable_girl_name(name)]\n    queries = list(BASE_QUERIES)',
    1,
)
text = text.replace(
    'matched_girls = [name for name in girl_names if name in hay][:6]',
    'matched_girls = [name for name in girl_names if girl_name_matches(name, hay)][:6]',
    1,
)

if text == original:
    print('No crawler quality patch needed.')
else:
    path.write_text(text, encoding='utf-8')
    print('Ambiguous short-name matching patched successfully.')
