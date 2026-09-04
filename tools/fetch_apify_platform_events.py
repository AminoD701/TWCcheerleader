from __future__ import annotations

import json
import os
import re
from pathlib import Path

from fetch_apify_social_events import (
    EVENTS_FILE,
    POSTS_FILE,
    SOURCES_FILE,
    apify_sync,
    build_event,
    extract_context_names,
    girl_matches,
    load_girls,
    post_text,
    post_url,
    username_from_item,
)


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def normalize_account(value: str) -> str:
    return re.sub(r"[^a-z0-9._-]+", "", str(value or "").lower().lstrip("@"))


def split_names(value) -> list[str]:
    if isinstance(value, list):
        return [str(x).strip() for x in value if str(x).strip()]
    if isinstance(value, str):
        return [x.strip() for x in re.split(r"[,，、;/]+", value) if x.strip()]
    return []


def source_mappings(sources: list[dict]) -> dict[str, dict[str, list[str]]]:
    out = {"instagram": {}, "threads": {}}
    for source in sources:
        platform = str(source.get("platform", "")).lower()
        account = normalize_account(source.get("account", ""))
        if platform not in out or not account:
            continue
        mapped = split_names(source.get("girls") or source.get("girl") or [])
        out[platform][account] = mapped
    return out


def post_key(url: str) -> str:
    url = str(url or "")
    m = re.search(r"instagram\.com/(?:p|reel)/([A-Za-z0-9_-]+)", url, re.I)
    if m:
        return f"instagram:{m.group(1)}"
    m = re.search(r"threads\.(?:com|net)/(?:@[^/]+/post|t)/([A-Za-z0-9_-]+)", url, re.I)
    if m:
        return f"threads:{m.group(1)}"
    m = re.search(r"threads\.(?:com|net)/share/([A-Za-z0-9_-]+)", url, re.I)
    if m:
        return f"threads:{m.group(1)}"
    return ""


def post_mappings(explicit: list[dict]) -> dict[str, list[str]]:
    out = {}
    for item in explicit:
        if not isinstance(item, dict):
            continue
        key = post_key(item.get("url", ""))
        names = split_names(item.get("girls") or item.get("girl") or [])
        if key and names:
            out[key] = names
    return out


def canonicalize_context_names(text: str, girls: list[dict]) -> list[str]:
    """Pick only names attached to event wording, never all aliases from the whole post."""
    extracted = [x for x in extract_context_names(text) if not str(x).startswith("@")]
    result = []
    for raw in extracted:
        matches = girl_matches(raw, girls)
        if matches:
            for girl in matches:
                name = girl["realname"]
                if name not in result:
                    result.append(name)
        else:
            cleaned = str(raw).strip()
            if 1 < len(cleaned) <= 16 and cleaned not in result:
                result.append(cleaned)
        if len(result) >= 4:
            break
    return result


def near_event_names(text: str, girls: list[dict]) -> list[str]:
    """Fallback: only scan a small window around the event phrase.

    This prevents unrelated roster aliases elsewhere in a scraped object from being treated
    as attendees.
    """
    terms = ["一日店長", "一日店員", "一日經理", "見面會", "簽名會", "拍照會", "商演", "站台", "路跑", "派對"]
    windows = []
    for term in terms:
        start = 0
        while True:
            pos = text.find(term, start)
            if pos < 0:
                break
            windows.append(text[max(0, pos - 90): pos + len(term) + 90])
            start = pos + len(term)
    result = []
    for window in windows[:6]:
        for girl in girl_matches(window, girls):
            if girl["realname"] not in result:
                result.append(girl["realname"])
        if len(result) >= 4:
            break
    return result[:4]


def primary_girls_for_row(
    row: dict,
    platform: str,
    girls: list[dict],
    source_mapping: dict[str, dict[str, list[str]]],
    explicit_mapping: dict[str, list[str]],
) -> tuple[list[str], str]:
    # Highest priority: a human-confirmed override for this exact post URL.
    key = post_key(post_url(row, platform))
    if key and explicit_mapping.get(key):
        return explicit_mapping[key], "post_override"

    # Second: only use account mapping when that source was explicitly configured as a fixed girl account.
    account = normalize_account(username_from_item(row))
    mapped = source_mapping.get(platform, {}).get(account, [])
    if mapped:
        return mapped, "source_mapping"

    text = post_text(row)
    context = canonicalize_context_names(text, girls)
    if context:
        return context, "event_context"

    nearby = near_event_names(text, girls)
    if nearby:
        return nearby, "near_event"

    # Safer to ask for review than attach unrelated girls.
    return ["待確認"], "unresolved"


def force_primary_girls(
    row: dict,
    platform: str,
    girls: list[dict],
    source_mapping: dict[str, dict[str, list[str]]],
    explicit_mapping: dict[str, list[str]],
) -> tuple[dict, str]:
    names, reason = primary_girls_for_row(row, platform, girls, source_mapping, explicit_mapping)
    patched = dict(row)
    patched["_mapped_girls"] = "、".join(names)
    return patched, reason


def is_social_event_for_platform(event: dict, platform: str) -> bool:
    source = str(event.get("source", "")).lower()
    event_id = str(event.get("id", ""))
    return (
        source.startswith(platform.lower() + " ")
        or event_id.startswith("auto-event-unmatched-")
        or (event_id.startswith("auto-event-apify-") and platform.lower() in source)
    )


def parse_platform(
    platform: str,
    rows: list[dict],
    girls: list[dict],
    current: list[dict],
    source_mapping: dict[str, dict[str, list[str]]],
    explicit_mapping: dict[str, list[str]],
) -> tuple[list[dict], dict]:
    stats = {
        "actor_error": 0,
        "non_post": 0,
        "no_text": 0,
        "no_girl": 0,
        "no_date": 0,
        "no_event_signal": 0,
        "accepted": 0,
        "post_override": 0,
        "source_mapping": 0,
        "event_context": 0,
        "near_event": 0,
        "unresolved": 0,
    }
    found = []

    for original in rows:
        if original.get("error"):
            print(f"{platform.upper()} ACTOR ERROR: {original.get('error')} | {original.get('errorDescription', '')}")
        row, reason = force_primary_girls(original, platform, girls, source_mapping, explicit_mapping)
        stats[reason] += 1
        event = build_event(row, platform, girls, stats)
        if event:
            if reason == "unresolved":
                event["needs_girl_review"] = True
                event["note"] = f"自動發現來源：{platform}。活動日期已由貼文正文解析；人物尚待確認，請以原始貼文為準。"
            else:
                event["needs_girl_review"] = False
                event["girl_match_method"] = reason
            found.append(event)

    preserved = [e for e in current if not is_social_event_for_platform(e, platform)]
    merged = preserved + found
    print(
        f"{platform.upper()}: actor rows={len(rows)}, accepted={len(found)}, "
        f"stats={json.dumps(stats, ensure_ascii=False)}"
    )
    return merged, stats


def fetch_instagram(token: str, accounts: list[str]) -> list[dict]:
    if not accounts:
        return []
    payload = {
        "usernames": accounts,
        "resultsType": "posts",
        "postsLimit": 12,
        "maxRecords": max(12, len(accounts) * 12),
    }
    return apify_sync("scrapers_lat/instagram-scraper", payload, token)


def normalize_threads_post_url(url: str) -> str:
    url = str(url or "").replace("threads.com", "threads.net")
    m = re.search(r"threads\.net/share/([A-Za-z0-9_-]+)", url)
    if m:
        return f"https://www.threads.net/t/{m.group(1)}"
    return url


def fetch_threads(token: str, accounts: list[str], explicit: list[dict]) -> list[dict]:
    post_urls = []
    for item in explicit:
        url = item if isinstance(item, str) else item.get("url", "")
        if "threads.net" in url or "threads.com" in url:
            post_urls.append(normalize_threads_post_url(url))
    if not accounts and not post_urls:
        return []
    payload = {
        "usernames": accounts,
        "postUrls": post_urls,
        "resultsType": "posts",
        "maxItems": max(50, len(accounts) * 12),
        "proxyConfiguration": {"useApifyProxy": False},
    }
    return apify_sync("vitalue/threads-scraper", payload, token)


def main() -> None:
    token = os.environ.get("APIFY_TOKEN", "").strip()
    if not token:
        raise SystemExit("APIFY_TOKEN is not configured")

    girls = load_girls()
    sources = load_json(SOURCES_FILE, [])
    explicit = load_json(POSTS_FILE, [])
    current = load_json(EVENTS_FILE, [])
    source_mapping = source_mappings(sources)
    explicit_mapping = post_mappings(explicit)

    ig_accounts = sorted({
        str(s.get("account", "")).lstrip("@")
        for s in sources
        if s.get("platform") == "instagram" and s.get("account")
    })
    thread_accounts = sorted({
        str(s.get("account", "")).lstrip("@")
        for s in sources
        if s.get("platform") == "threads" and s.get("account")
    })

    successful_platforms = 0

    try:
        ig_rows = fetch_instagram(token, ig_accounts)
        current, _ = parse_platform("instagram", ig_rows, girls, current, source_mapping, explicit_mapping)
        successful_platforms += 1
    except Exception as exc:
        print(f"INSTAGRAM FETCH FAILED: {type(exc).__name__}: {exc}")

    try:
        thread_rows = fetch_threads(token, thread_accounts, explicit)
        current, _ = parse_platform("threads", thread_rows, girls, current, source_mapping, explicit_mapping)
        successful_platforms += 1
    except Exception as exc:
        print(f"THREADS FETCH FAILED: {type(exc).__name__}: {exc}")

    EVENTS_FILE.write_text(json.dumps(current, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Social fetch completed; successful_platforms={successful_platforms}/2; total_before_dedupe={len(current)}")

    if successful_platforms == 0:
        raise SystemExit("Both Instagram and Threads fetchers failed")


if __name__ == "__main__":
    main()
