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
    load_girls,
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


def source_mappings(sources: list[dict]) -> dict[str, dict[str, list[str]]]:
    out = {"instagram": {}, "threads": {}}
    for source in sources:
        platform = str(source.get("platform", "")).lower()
        account = normalize_account(source.get("account", ""))
        if platform not in out or not account:
            continue
        mapped = source.get("girls") or source.get("girl") or []
        if isinstance(mapped, str):
            mapped = [x.strip() for x in re.split(r"[,，、;/]+", mapped) if x.strip()]
        out[platform][account] = [str(x).strip() for x in mapped if str(x).strip()]
    return out


def force_mapped_girls(row: dict, platform: str, mapping: dict[str, dict[str, list[str]]]) -> dict:
    account = normalize_account(username_from_item(row))
    mapped = mapping.get(platform, {}).get(account, [])
    if not mapped:
        return row
    patched = dict(row)
    patched["_mapped_girls"] = "、".join(mapped)
    return patched


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
    mapping: dict[str, dict[str, list[str]]],
) -> tuple[list[dict], dict]:
    stats = {
        "actor_error": 0,
        "non_post": 0,
        "no_text": 0,
        "no_girl": 0,
        "no_date": 0,
        "no_event_signal": 0,
        "accepted": 0,
        "mapped": 0,
    }
    found = []

    for original in rows:
        if original.get("error"):
            print(f"{platform.upper()} ACTOR ERROR: {original.get('error')} | {original.get('errorDescription', '')}")
        row = force_mapped_girls(original, platform, mapping)
        if row is not original:
            stats["mapped"] += 1
        event = build_event(row, platform, girls, stats)
        if event:
            found.append(event)

    # Refresh only this platform's previously generated social rows after a successful fetch.
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
    mapping = source_mappings(sources)

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
        current, _ = parse_platform("instagram", ig_rows, girls, current, mapping)
        successful_platforms += 1
    except Exception as exc:
        print(f"INSTAGRAM FETCH FAILED: {type(exc).__name__}: {exc}")

    try:
        thread_rows = fetch_threads(token, thread_accounts, explicit)
        current, _ = parse_platform("threads", thread_rows, girls, current, mapping)
        successful_platforms += 1
    except Exception as exc:
        print(f"THREADS FETCH FAILED: {type(exc).__name__}: {exc}")

    EVENTS_FILE.write_text(json.dumps(current, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Social fetch completed; successful_platforms={successful_platforms}/2; total_before_dedupe={len(current)}")

    if successful_platforms == 0:
        raise SystemExit("Both Instagram and Threads fetchers failed")


if __name__ == "__main__":
    main()
