from __future__ import annotations

import re
from difflib import SequenceMatcher

import fetch_auto_news as core

# Keep stable references before replacing core functions below.
ORIGINAL_BUILD_QUERIES = core.build_queries
ORIGINAL_FETCH_QUERY = core.fetch_query
ORIGINAL_CLASSIFY_NEWS = core.classify_news
ORIGINAL_SELECT_CANDIDATES = core.select_candidates

# Entertainment/lifestyle publishers frequently carry cheerleader personality stories
# that generic sports queries can miss. Keep this list explicit so new sources are easy
# to audit and extend.
ENTERTAINMENT_DOMAINS = (
    "stars.udn.com",
    "ctwant.com",
    "ttshow.tw",
    "setn.com",
    "storm.mg",
)

for hint in ("TTShow", "台灣達人秀"):
    if hint not in core.TRUSTED_HINTS:
        core.TRUSTED_HINTS.append(hint)

EXPANDED_NAME_BATCH_SIZE = 5
MAX_EXPANDED_NAME_BATCHES = 40
EXPANDED_QUERIES: set[str] = set()
NAME_DOMAIN_QUERIES: set[str] = set()
SOURCE_DOMAIN_QUERIES: set[str] = set()
SAFE_ROSTER_NAMES: list[str] = []
SITE_TEAMS: list[str] = []

STRICT_CHEER_CONTEXT_TERMS = tuple(dict.fromkeys([
    *core.CHEER_TERMS,
    "啦啦隊女神",
    "韓籍啦啦隊",
    "職棒啦啦隊",
    "職籃啦啦隊",
    "職排啦啦隊",
    "應援女孩",
    "應援女神",
    "應援團",
    "啦啦隊成員",
    "ACE VIVA",
    "Passion Sisters",
    "Rakuten Girls",
    "Fubon Angels",
    "Dragon Beauties",
    "Wing Stars",
    "Uni Girls",
    "Si-ster",
]))

# Generic team nicknames such as 兄弟/國王/勇士 are unsafe by themselves. A sports
# article must contain at least one explicit sport/league/full-club signal below.
STRONG_SPORT_TERMS = (
    "棒球", "中職", "中華職棒", "cpbl", "職棒", "mlb", "大聯盟",
    "道奇隊", "洋基隊", "統一7-eleven獅", "統一獅", "中信兄弟", "樂天桃猿",
    "味全龍", "富邦悍將", "台鋼雄鷹",
    "籃球", "職籃", "tpbl", "台灣職業籃球大聯盟", "p. league+", "p.league+", "plg",
    "新北國王", "福爾摩沙夢想家", "高雄全家海神", "新竹御嵿攻城獅",
    "臺北台新戰神", "台北台新戰神", "桃園台啤永豐雲豹", "新北中信特攻",
    "台北富邦勇士", "桃園璞園領航猿",
    "排球", "職排", "tvbl", "tpvl", "台灣職業排球聯盟", "臺中連莊", "台中連莊",
)

# Search/list/topic pages are not articles. These often collide with short roster names
# such as 喬喬 and were a major source of false positives.
INDEX_PAGE_TITLE_PATTERNS = (
    r"相關報導$",
    r"新聞事件一把抓",
    r"新聞懶人包",
    r"專題列表$",
    r"最新消息$",
    r"新聞總覽$",
)


def is_safe_expanded_name(name: str) -> bool:
    value = (name or "").strip()
    if not core.usable_girl_name(value):
        return False
    if any(ch.isdigit() for ch in value):
        return False
    if core.is_cjk_name(value):
        return len(value) >= 2
    compact = re.sub(r"[^a-z0-9]", "", value.lower())
    return len(compact) >= 4


def has_strict_cheer_context(title: str, desc: str) -> bool:
    hay = f"{title} {desc}".lower()
    return any(term.lower() in hay for term in STRICT_CHEER_CONTEXT_TERMS)


def has_team_context(title: str, desc: str) -> bool:
    hay = f"{title} {desc}".lower()
    return any(team.lower() in hay for team in SITE_TEAMS if team)


def matched_roster_names(title: str, desc: str) -> list[str]:
    hay = f"{title} {desc}"
    return [name for name in SAFE_ROSTER_NAMES if core.girl_name_matches(name, hay)]


def has_roster_context(title: str, desc: str) -> bool:
    return bool(matched_roster_names(title, desc)) or has_team_context(title, desc)


def has_strong_sports_context(title: str, desc: str) -> bool:
    hay = f"{title} {desc}".lower()
    return any(term.lower() in hay for term in STRONG_SPORT_TERMS)


def looks_like_index_page(title: str, desc: str) -> bool:
    text = f"{title} {desc}".strip()
    return any(re.search(pattern, text, flags=re.I) for pattern in INDEX_PAGE_TITLE_PATTERNS)


def has_safe_person_context(title: str, desc: str) -> bool:
    """Known-person matches need corroboration so common names do not leak in."""
    names = matched_roster_names(title, desc)
    if not names:
        return False
    if has_strict_cheer_context(title, desc) or has_team_context(title, desc) or has_strong_sports_context(title, desc):
        return True

    # Precision first: a bare roster name with no cheer/team/sport evidence is rejected.
    # This prevents collisions such as a nurse named 喬喬 or unrelated public figures.
    return False


def build_expanded_queries(girl_names: list[str], site_teams: list[str]) -> list[str]:
    global SAFE_ROSTER_NAMES, SITE_TEAMS

    queries = list(ORIGINAL_BUILD_QUERIES(girl_names, site_teams))
    SAFE_ROSTER_NAMES = [name for name in girl_names if is_safe_expanded_name(name)]
    SITE_TEAMS = [team.strip() for team in site_teams if team and team.strip()]

    limit = min(len(SAFE_ROSTER_NAMES), EXPANDED_NAME_BATCH_SIZE * MAX_EXPANDED_NAME_BATCHES)
    for start in range(0, limit, EXPANDED_NAME_BATCH_SIZE):
        batch = SAFE_ROSTER_NAMES[start:start + EXPANDED_NAME_BATCH_SIZE]
        if not batch:
            break
        names_expr = " OR ".join(f'"{name}"' for name in batch)

        broad_query = f"({names_expr}) (啦啦隊 OR 應援 OR 中職 OR 職棒 OR 職籃 OR 職排 OR 球場)"
        queries.append(broad_query)
        EXPANDED_QUERIES.add(broad_query)

        for domain in ENTERTAINMENT_DOMAINS:
            domain_query = f"site:{domain} ({names_expr})"
            queries.append(domain_query)
            EXPANDED_QUERIES.add(domain_query)
            NAME_DOMAIN_QUERIES.add(domain_query)

    source_terms = '(啦啦隊 OR 應援 OR "啦啦隊女神" OR "應援女孩" OR "應援女神")'
    for domain in ENTERTAINMENT_DOMAINS:
        source_query = f"site:{domain} {source_terms}"
        queries.append(source_query)
        EXPANDED_QUERIES.add(source_query)
        SOURCE_DOMAIN_QUERIES.add(source_query)

    return list(dict.fromkeys(queries))


def strict_fetch_query(query: str) -> list[dict]:
    items = ORIGINAL_FETCH_QUERY(query)
    filtered: list[dict] = []

    for item in items:
        title = item.get("title", "")
        description = item.get("description", "")

        if looks_like_index_page(title, description):
            print(f"filtered index/list page: {item.get('source', '')} | {title}")
            continue

        if query in EXPANDED_QUERIES:
            if not (has_strict_cheer_context(title, description) or has_team_context(title, description) or has_safe_person_context(title, description)):
                print(f"filtered unrelated expanded news: {item.get('source', '')} | {title}")
                continue

        filtered.append(item)

    return filtered


def strict_classify_news(title: str, desc: str, matched_girls: list[str], matched_teams: list[str]):
    classified = ORIGINAL_CLASSIFY_NEWS(title, desc, matched_girls, matched_teams)
    if not classified:
        return None

    main_category, subcategory = classified
    if main_category == "啦啦隊情報":
        # A roster-name collision alone is not enough. Require explicit cheer, team or
        # sports evidence. This removes unrelated people who happen to share a nickname.
        if not (has_strict_cheer_context(title, desc) or matched_teams or has_strong_sports_context(title, desc)):
            return None
        return classified

    # Sports classification must not be triggered by ambiguous words such as 兄弟、國王、
    # 勇士、戰神、夢想家 or 連莊 when the article is actually politics/lifestyle.
    if not has_strong_sports_context(title, desc):
        return None
    return classified


def dedupe_title_key(title: str) -> str:
    title = core.clean_title(title)
    title = re.sub(r"[|｜].*$", "", title)
    title = re.sub(r"(?:影音|快訊|獨家|專訪|圖多)\s*[:：／/]?", "", title, flags=re.I)
    return re.sub(r"[\s\W_]+", "", title).lower()


def titles_are_near_duplicates(a: str, b: str) -> bool:
    ka, kb = dedupe_title_key(a), dedupe_title_key(b)
    if not ka or not kb:
        return False
    if ka == kb:
        return True
    shorter, longer = sorted((ka, kb), key=len)
    if len(shorter) >= 12 and shorter in longer:
        return True
    return SequenceMatcher(None, ka, kb).ratio() >= 0.86


def strict_select_candidates(candidates: list[dict]) -> list[dict]:
    selected = ORIGINAL_SELECT_CANDIDATES(candidates)
    deduped: list[dict] = []
    for item in selected:
        duplicate = next((existing for existing in deduped if titles_are_near_duplicates(item.get("title", ""), existing.get("title", ""))), None)
        if duplicate:
            print(f"filtered near-duplicate: {item.get('title', '')} ~= {duplicate.get('title', '')}")
            continue
        deduped.append(item)
    return deduped


core.build_queries = build_expanded_queries
core.fetch_query = strict_fetch_query
core.classify_news = strict_classify_news
core.select_candidates = strict_select_candidates


if __name__ == "__main__":
    core.main()
