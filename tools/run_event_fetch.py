from __future__ import annotations

import re
from datetime import datetime, timedelta

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


# ---- Store-specific parser: silbi_house / 全州喜比食堂 -----------------------
# Their standard copy is highly structured, so use deterministic rules instead of
# the generic heuristic parser.
_original_primary_girls = platform.primary_girls_for_row
_original_strict_event_date = platform.strict_event_date
_original_build_event = platform.build_event


def _is_silbi_row(row: dict) -> bool:
    account = platform.normalize_account(platform.username_from_item(row))
    body = platform.clean_post_body(row)
    return account == "silbi_house" or "全州喜比食堂" in body


def _silbi_featured_girl(row: dict, girls: list[dict]) -> list[str]:
    text = platform.clean_post_body(row)
    patterns = [
        # 特別邀請超人氣女神 — 韓志恩 @xanjieun
        r"特別邀請\s*(?:超人氣)?女神\s*[—–\-:：]?\s*([^\s@，,。！!\n]{2,16})\s*@([A-Za-z0-9._-]+)",
        # 超人氣女神 韓志恩 @xanjieun
        r"(?:超人氣)?女神\s*[—–\-:：]?\s*([^\s@，,。！!\n]{2,16})\s*@([A-Za-z0-9._-]+)",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.I)
        if not m:
            continue
        raw_name, handle = m.group(1).strip(), m.group(2).strip()
        exact = platform.exact_realname_matches(raw_name, girls)
        if exact:
            return exact[:1]
        by_handle = platform.safe_alias_matches("@" + handle, girls)
        if by_handle:
            return by_handle[:1]
        # Keep the clearly-declared featured name even when the roster sheet has not
        # learned the alias yet; this is safer than attaching unrelated roster members.
        if not platform.looks_like_date_or_label(raw_name):
            return [raw_name]
    return []


def primary_girls_for_row(row, platform_name, girls, source_mapping, explicit_mapping):
    if _is_silbi_row(row):
        featured = _silbi_featured_girl(row, girls)
        if featured:
            return featured, "silbi_featured_girl"
    return _original_primary_girls(row, platform_name, girls, source_mapping, explicit_mapping)


def strict_event_date(text: str):
    # silbi_house standard: the leading "9月12日女神降臨" is the activity date.
    # Later lines such as "09/04 12:00開始購票" are ticket-sale times and must never win.
    if "全州喜比食堂" in text or "女神降臨" in text:
        m = re.search(r"(?:^|\n)\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*女神降臨", text)
        if m:
            now = datetime.now(platform.TZ)
            month, day = int(m.group(1)), int(m.group(2))
            try:
                dt = datetime(now.year, month, day, tzinfo=platform.TZ)
                if dt < now - timedelta(days=1) and now.month >= 11 and month <= 2:
                    dt = dt.replace(year=now.year + 1)
                if now - timedelta(days=1) <= dt <= now + timedelta(days=240):
                    return dt
            except ValueError:
                pass
    return _original_strict_event_date(text)


def build_event(item: dict, platform_name: str, girls: list[dict], stats: dict):
    event = _original_build_event(item, platform_name, girls, stats)
    if event and _is_silbi_row(item):
        event["host"] = "全州喜比食堂"
        event["organizer"] = "全州喜比食堂"
    return event


platform.fetch_instagram = fetch_instagram
platform.fetch_threads = fetch_threads
platform.primary_girls_for_row = primary_girls_for_row
platform.strict_event_date = strict_event_date
platform.build_event = build_event


if __name__ == "__main__":
    platform.main()
