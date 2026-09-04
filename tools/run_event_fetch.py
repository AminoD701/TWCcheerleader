from __future__ import annotations

import re

import fetch_apify_social_events as base

# Extend event wording without duplicating the core parser. These are common commercial
# event phrases used by Taiwanese stores / organizers that do not necessarily contain
# the exact term "見面會".
EXTRA_EVENT_TERMS = [
    "女神來見面",
    "女神見面",
    "來見面",
    "見面活動",
    "來店見面",
    "粉絲見面",
    "與你見面",
    "見面日",
]

for term in reversed(EXTRA_EVENT_TERMS):
    if term not in base.EVENT_TERMS:
        base.EVENT_TERMS.insert(0, term)

import fetch_apify_platform_events as platform

for term in EXTRA_EVENT_TERMS:
    if term not in platform.EVENT_TERMS_LOCAL:
        platform.EVENT_TERMS_LOCAL.append(term)


def fetch_instagram(token: str, accounts: list[str]) -> list[dict]:
    """Use the maintained public-profile actor first; fall back only if needed."""
    if not accounts:
        return []
    payload = {
        "usernames": accounts,
        "outputFormat": "posts",
        "maxPosts": 12,
        "includeVideoTab": True,
        "includeRelatedProfiles": False,
        "includeRaw": False,
        "proxy": {"useApifyProxy": True, "apifyProxyGroups": ["RESIDENTIAL"]},
    }
    try:
        rows = base.apify_sync("simple.actors/instagram-profile-posts", payload, token)
        print(f"INSTAGRAM PRIMARY ACTOR rows={len(rows)}")
        return rows
    except Exception as exc:
        print(f"INSTAGRAM PRIMARY ACTOR FAILED: {type(exc).__name__}: {exc}")
        return platform.fetch_instagram(token, accounts)


def _threads_short_url(url: str) -> str:
    url = str(url or "").replace("threads.com", "threads.net")
    m = re.search(r"threads\.net/share/([A-Za-z0-9_-]+)", url, re.I)
    if m:
        return f"https://www.threads.net/t/{m.group(1)}"
    return url


def fetch_threads(token: str, accounts: list[str], explicit: list[dict]) -> list[dict]:
    """Fetch both watched store profiles and every explicitly supplied public post URL."""
    start_urls = [{"url": f"https://www.threads.net/@{a.lstrip('@')}"} for a in accounts]

    seen = {x["url"] for x in start_urls}
    for item in explicit:
        url = item if isinstance(item, str) else item.get("url", "")
        if "threads.net" not in url and "threads.com" not in url:
            continue
        normalized = _threads_short_url(url)
        if normalized and normalized not in seen:
            seen.add(normalized)
            start_urls.append({"url": normalized})

    if not start_urls:
        return []

    payload = {
        "startUrls": start_urls,
        "usernames": accounts,
        "maxItems": 15,
        "proxyConfiguration": {"useApifyProxy": True},
    }
    try:
        rows = base.apify_sync("anyxsolutions/threads-scraper", payload, token)
        print(f"THREADS PRIMARY ACTOR startUrls={len(start_urls)} rows={len(rows)}")
        return rows
    except Exception as exc:
        print(f"THREADS PRIMARY ACTOR FAILED: {type(exc).__name__}: {exc}")
        return platform.fetch_threads(token, accounts, explicit)


platform.fetch_instagram = fetch_instagram
platform.fetch_threads = fetch_threads


if __name__ == "__main__":
    platform.main()
