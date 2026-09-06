from __future__ import annotations

import re

import fetch_auto_news as core

# Keep stable references before replacing core functions below.
ORIGINAL_BUILD_QUERIES = core.build_queries
ORIGINAL_CLASSIFY_NEWS = core.classify_news

# The original crawler searches roster names together with the word "啦啦隊".
# These domains also publish useful cheerleader entertainment/personality stories,
# but name-only matches are too noisy, so expanded results receive an extra context gate.
ENTERTAINMENT_DOMAINS = (
    "stars.udn.com",
    "ctwant.com",
)

EXPANDED_NAME_BATCH_SIZE = 5
MAX_EXPANDED_NAME_BATCHES = 24

# A broad entertainment result must contain at least one of these signals in the
# Google News title/description. This preserves stories that omit "啦啦隊" in the
# headline but mention the cheer context in the description, while rejecting same-name
# celebrities, health, crime and general lifestyle stories.
CHEER_CONTEXT_TERMS = tuple(dict.fromkeys([
    *core.CHEER_TERMS,
    "啦啦隊女神",
    "女孩",
    "應援",
    "應援女孩",
    "韓籍三本柱",
    "韓籍啦啦隊",
    "職棒啦啦隊",
    "職籃啦啦隊",
    "職排啦啦隊",
    "ACE VIVA",
    "Passion Sisters",
    "Rakuten Girls",
    "Fubon Angels",
    "Dragon Beauties",
    "Wing Stars",
    "Uni Girls",
]))

SPORT_CONTEXT_TERMS = (
    "中職", "CPBL", "職棒", "棒球", "球場",
    "TPBL", "PLG", "職籃", "籃球",
    "TVBL", "TPVL", "職排", "排球", "連莊",
)


def is_safe_expanded_name(name: str) -> bool:
    """Reject ambiguous values before putting them into name-only entertainment searches."""
    value = (name or "").strip()
    if not core.usable_girl_name(value):
        return False
    # Spreadsheet values such as "50萬" are not person names and previously caused
    # unrelated CTWANT stories to be classified as cheerleader news.
    if any(ch.isdigit() for ch in value):
        return False
    if core.is_cjk_name(value):
        return len(value) >= 3
    compact = re.sub(r"[^a-z0-9]", "", value.lower())
    return len(compact) >= 4


def build_expanded_queries(girl_names: list[str], site_teams: list[str]) -> list[str]:
    queries = list(ORIGINAL_BUILD_QUERIES(girl_names, site_teams))
    safe_names = [name for name in girl_names if is_safe_expanded_name(name)]

    limit = min(len(safe_names), EXPANDED_NAME_BATCH_SIZE * MAX_EXPANDED_NAME_BATCHES)
    for start in range(0, limit, EXPANDED_NAME_BATCH_SIZE):
        batch = safe_names[start:start + EXPANDED_NAME_BATCH_SIZE]
        if not batch:
            break
        names_expr = " OR ".join(f'"{name}"' for name in batch)

        # General entertainment/personality coverage. The query itself contains sports/
        # cheer context, so it remains relatively constrained.
        queries.append(
            f"({names_expr}) (台灣 OR 韓國 OR 啦啦隊 OR 女神 OR 球場 OR 中職)"
        )

        # Domain-specific discovery is intentionally broad, but candidates from these
        # queries are later required to pass has_expanded_cheer_context().
        for domain in ENTERTAINMENT_DOMAINS:
            queries.append(f"site:{domain} ({names_expr})")

    return list(dict.fromkeys(queries))


def is_expanded_domain_query(query: str) -> bool:
    normalized = (query or "").lower()
    return any(f"site:{domain}" in normalized for domain in ENTERTAINMENT_DOMAINS)


def has_expanded_cheer_context(title: str, desc: str, matched_teams: list[str]) -> bool:
    hay = f"{title} {desc}".lower()
    if any(term.lower() in hay for term in CHEER_CONTEXT_TERMS):
        return True
    # Team matches alone can be generic sports news, so require an additional sports/
    # entertainment signal rather than accepting any same-name article.
    if matched_teams and any(term.lower() in hay for term in SPORT_CONTEXT_TERMS):
        return True
    return False


def classify_news_strict(
    title: str,
    desc: str,
    matched_girls: list[str],
    matched_teams: list[str],
):
    return ORIGINAL_CLASSIFY_NEWS(title, desc, matched_girls, matched_teams)


# Expose helpers to the core module so the main candidate loop can identify strict
# entertainment queries without duplicating the entire crawler implementation here.
core.build_queries = build_expanded_queries
core.is_expanded_domain_query = is_expanded_domain_query
core.has_expanded_cheer_context = has_expanded_cheer_context
core.classify_news = classify_news_strict


if __name__ == "__main__":
    core.main()
