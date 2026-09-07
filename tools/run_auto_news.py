from __future__ import annotations

import re

import fetch_auto_news as core

# Keep stable references before replacing core functions below.
ORIGINAL_BUILD_QUERIES = core.build_queries
ORIGINAL_FETCH_QUERY = core.fetch_query

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

# These names are only used after Google News has already returned an item. They do not
# bypass the existing date/category/dedupe logic in fetch_auto_news.py.
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

# Do not use generic words such as a bare "女神" here. They are too broad and can turn
# ordinary entertainment/lifestyle stories into false positives. Source-level searches
# may use broader discovery terms, but every returned result must pass this context gate
# or contain a known roster girl/team name.
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


def is_safe_expanded_name(name: str) -> bool:
    """Reject ambiguous spreadsheet values before name-based entertainment searches."""
    value = (name or "").strip()
    if not core.usable_girl_name(value):
        return False
    # Values such as "50萬" can appear in source data but are not usable person names.
    if any(ch.isdigit() for ch in value):
        return False
    if core.is_cjk_name(value):
        return len(value) >= 2
    compact = re.sub(r"[^a-z0-9]", "", value.lower())
    return len(compact) >= 4


def has_strict_cheer_context(title: str, desc: str) -> bool:
    hay = f"{title} {desc}".lower()
    return any(term.lower() in hay for term in STRICT_CHEER_CONTEXT_TERMS)


def has_roster_context(title: str, desc: str) -> bool:
    hay = f"{title} {desc}"
    if any(core.girl_name_matches(name, hay) for name in SAFE_ROSTER_NAMES):
        return True
    hay_lower = hay.lower()
    return any(team.lower() in hay_lower for team in SITE_TEAMS if team)


def build_expanded_queries(girl_names: list[str], site_teams: list[str]) -> list[str]:
    global SAFE_ROSTER_NAMES, SITE_TEAMS

    queries = list(ORIGINAL_BUILD_QUERIES(girl_names, site_teams))
    SAFE_ROSTER_NAMES = [name for name in girl_names if is_safe_expanded_name(name)]
    SITE_TEAMS = [team.strip() for team in site_teams if team and team.strip()]

    # Increase the previous 120-name cap so the growing roster is much less likely to be
    # truncated. The normal core queries still remain bounded separately.
    limit = min(len(SAFE_ROSTER_NAMES), EXPANDED_NAME_BATCH_SIZE * MAX_EXPANDED_NAME_BATCHES)
    for start in range(0, limit, EXPANDED_NAME_BATCH_SIZE):
        batch = SAFE_ROSTER_NAMES[start:start + EXPANDED_NAME_BATCH_SIZE]
        if not batch:
            break
        names_expr = " OR ".join(f'"{name}"' for name in batch)

        broad_query = (
            f"({names_expr}) (啦啦隊 OR 應援 OR 中職 OR 職棒 OR 職籃 OR 職排 OR 球場)"
        )
        queries.append(broad_query)
        EXPANDED_QUERIES.add(broad_query)

        # Name-targeted searches are intentionally allowed to pass when the returned
        # title/description contains a known roster name even if it omits the word 啦啦隊.
        # This catches lifestyle/interview/personality stories about known members.
        for domain in ENTERTAINMENT_DOMAINS:
            domain_query = f"site:{domain} ({names_expr})"
            queries.append(domain_query)
            EXPANDED_QUERIES.add(domain_query)
            NAME_DOMAIN_QUERIES.add(domain_query)

    # Also scan the publishers themselves for cheerleading terms. This closes the gap
    # where Google News does not rank a story under a batched girl-name query.
    source_terms = '(啦啦隊 OR 應援 OR "啦啦隊女神" OR "應援女孩" OR "應援女神")'
    for domain in ENTERTAINMENT_DOMAINS:
        source_query = f"site:{domain} {source_terms}"
        queries.append(source_query)
        EXPANDED_QUERIES.add(source_query)
        SOURCE_DOMAIN_QUERIES.add(source_query)

    return list(dict.fromkeys(queries))


def strict_fetch_query(query: str) -> list[dict]:
    items = ORIGINAL_FETCH_QUERY(query)
    if query not in EXPANDED_QUERIES:
        return items

    filtered: list[dict] = []
    for item in items:
        title = item.get("title", "")
        description = item.get("description", "")
        strict_context = has_strict_cheer_context(title, description)
        roster_context = has_roster_context(title, description)

        # For explicit publisher/name queries, a known roster girl/team is enough.
        # For source-wide scans, require either a clear cheerleading phrase or a known
        # roster entity so generic entertainment "女神" stories do not leak in.
        if strict_context or roster_context:
            filtered.append(item)
        else:
            print(f"filtered unrelated expanded news: {item.get('source', '')} | {title}")
    return filtered


core.build_queries = build_expanded_queries
core.fetch_query = strict_fetch_query


if __name__ == "__main__":
    core.main()
