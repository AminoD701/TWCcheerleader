from __future__ import annotations

import re

import fetch_auto_news as core

# Keep stable references before replacing core functions below.
ORIGINAL_BUILD_QUERIES = core.build_queries
ORIGINAL_FETCH_QUERY = core.fetch_query

# The original crawler searches roster names together with the word "啦啦隊".
# These domains also publish useful cheerleader entertainment/personality stories,
# but name-only matches are noisy, so every expanded result receives an extra context gate.
ENTERTAINMENT_DOMAINS = (
    "stars.udn.com",
    "ctwant.com",
)

EXPANDED_NAME_BATCH_SIZE = 5
MAX_EXPANDED_NAME_BATCHES = 24
EXPANDED_QUERIES: set[str] = set()

# Do not use generic words such as "女孩" or "女神" here. They are too broad and can
# turn ordinary entertainment/lifestyle stories into false positives. Expanded items
# must contain a clear cheerleading/squad signal in the Google News title or summary.
STRICT_CHEER_CONTEXT_TERMS = tuple(dict.fromkeys([
    *core.CHEER_TERMS,
    "啦啦隊女神",
    "韓籍啦啦隊",
    "職棒啦啦隊",
    "職籃啦啦隊",
    "職排啦啦隊",
    "應援女孩",
    "應援團",
    "ACE VIVA",
    "Passion Sisters",
    "Rakuten Girls",
    "Fubon Angels",
    "Dragon Beauties",
    "Wing Stars",
    "Uni Girls",
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
        return len(value) >= 3
    compact = re.sub(r"[^a-z0-9]", "", value.lower())
    return len(compact) >= 4


def has_strict_cheer_context(title: str, desc: str) -> bool:
    hay = f"{title} {desc}".lower()
    return any(term.lower() in hay for term in STRICT_CHEER_CONTEXT_TERMS)


def build_expanded_queries(girl_names: list[str], site_teams: list[str]) -> list[str]:
    queries = list(ORIGINAL_BUILD_QUERIES(girl_names, site_teams))
    safe_names = [name for name in girl_names if is_safe_expanded_name(name)]

    limit = min(len(safe_names), EXPANDED_NAME_BATCH_SIZE * MAX_EXPANDED_NAME_BATCHES)
    for start in range(0, limit, EXPANDED_NAME_BATCH_SIZE):
        batch = safe_names[start:start + EXPANDED_NAME_BATCH_SIZE]
        if not batch:
            break
        names_expr = " OR ".join(f'"{name}"' for name in batch)

        # Broaden discovery beyond headlines that literally contain "啦啦隊", but do
        # not trust the search query alone: strict_fetch_query() validates every result.
        broad_query = (
            f"({names_expr}) (啦啦隊 OR 應援 OR 中職 OR 職棒 OR 職籃 OR 職排 OR 球場)"
        )
        queries.append(broad_query)
        EXPANDED_QUERIES.add(broad_query)

        for domain in ENTERTAINMENT_DOMAINS:
            domain_query = f"site:{domain} ({names_expr})"
            queries.append(domain_query)
            EXPANDED_QUERIES.add(domain_query)

    return list(dict.fromkeys(queries))


def strict_fetch_query(query: str) -> list[dict]:
    items = ORIGINAL_FETCH_QUERY(query)
    if query not in EXPANDED_QUERIES:
        return items

    filtered: list[dict] = []
    for item in items:
        if has_strict_cheer_context(item.get("title", ""), item.get("description", "")):
            filtered.append(item)
        else:
            print(f"filtered unrelated expanded news: {item.get('source', '')} | {item.get('title', '')}")
    return filtered


core.build_queries = build_expanded_queries
core.fetch_query = strict_fetch_query


if __name__ == "__main__":
    core.main()
