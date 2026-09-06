from __future__ import annotations

import re

import fetch_auto_news as core

# Keep a stable reference before replacing core.build_queries below.
ORIGINAL_BUILD_QUERIES = core.build_queries

# The original crawler searches roster names together with the word "啦啦隊".
# That is good for sports coverage, but it can miss entertainment/personal stories
# whose headline only contains the girl's name (for example UDN Stars / CTWANT).
ENTERTAINMENT_DOMAINS = (
    "stars.udn.com",
    "ctwant.com",
)

EXPANDED_NAME_BATCH_SIZE = 5
MAX_EXPANDED_NAME_BATCHES = 24


def is_safe_expanded_name(name: str) -> bool:
    """Avoid very short/ambiguous stage names in broad entertainment searches."""
    value = (name or "").strip()
    if not core.usable_girl_name(value):
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

        # Broader query: catches personal, entertainment and lifestyle coverage where
        # the headline does not explicitly say "啦啦隊", while retaining Taiwan/Korea/
        # ballpark context so unrelated same-name stories are less likely to enter.
        queries.append(
            f"({names_expr}) (台灣 OR 韓國 OR 啦啦隊 OR 女神 OR 球場 OR 中職)"
        )

        # Explicitly cover the two entertainment-news families requested by the site
        # owner. Final inclusion still goes through the original roster-name matching,
        # date window, dedupe and classification rules in fetch_auto_news.py.
        for domain in ENTERTAINMENT_DOMAINS:
            queries.append(f"site:{domain} ({names_expr})")

    # Preserve order while avoiding duplicate Google News requests.
    return list(dict.fromkeys(queries))


core.build_queries = build_expanded_queries


if __name__ == "__main__":
    core.main()
