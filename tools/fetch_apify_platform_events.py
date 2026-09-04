from __future__ import annotations

import json
import os
from pathlib import Path

from fetch_apify_social_events import (
    EVENTS_FILE,
    POSTS_FILE,
    SOURCES_FILE,
    apify_sync,
    build_event,
    load_girls,
)


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def parse_and_merge(platform: str, rows: list[dict], girls: list[dict], current: list[dict]) -> tuple[list[dict], dict]:
    stats = {
        "actor_error": 0,
        "non_post": 0,
        "no_text": 0,
        "no_girl": 0,
        "no_date": 0,
        "no_event_signal": 0,
        "accepted": 0,
    }
    found = []
    error_samples = 0
    for row in rows:
        if row.get("error") and error_samples < 5:
            print(f"{platform.upper()} ACTOR ERROR: {row.get('error')} | {row.get('errorDescription', '')}")
            error_samples += 1
        event = build_event(row, platform, girls, stats)
        if event:
            found.append(event)
    print(f"{platform.upper()}: actor rows={len(rows)}, accepted={len(found)}, stats={json.dumps(stats, ensure_ascii=False)}")
    return current + found, stats


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


def fetch_threads(token: str, accounts: list[str], explicit: list[dict]) -> list[dict]:
    post_urls = []
    for item in explicit:
        url = item if isinstance(item, str) else item.get("url", "")
        if "/@" in url and "/post/" in url and ("threads.net" in url or "threads.com" in url):
            post_urls.append(url.replace("threads.com", "threads.net"))
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
        current, _ = parse_and_merge("instagram", ig_rows, girls, current)
        successful_platforms += 1
    except Exception as exc:
        print(f"INSTAGRAM FETCH FAILED: {type(exc).__name__}: {exc}")

    try:
        thread_rows = fetch_threads(token, thread_accounts, explicit)
        current, _ = parse_and_merge("threads", thread_rows, girls, current)
        successful_platforms += 1
    except Exception as exc:
        print(f"THREADS FETCH FAILED: {type(exc).__name__}: {exc}")

    EVENTS_FILE.write_text(json.dumps(current, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Social fetch completed; successful_platforms={successful_platforms}/2; total_before_dedupe={len(current)}")

    if successful_platforms == 0:
        raise SystemExit("Both Instagram and Threads fetchers failed")


if __name__ == "__main__":
    main()
