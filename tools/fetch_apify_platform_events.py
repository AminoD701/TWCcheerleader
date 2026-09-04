from __future__ import annotations

import hashlib
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
    choose_event_date,
    extract_time,
    find_event_term,
    first_image,
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


def source_mappings(sources: list[dict]) -> dict[str, dict[str, list[str]]]:
    out = {"instagram": {}, "threads": {}}
    for source in sources:
        platform = str(source.get("platform", "")).lower()
        account = normalize_account(source.get("account", ""))
        if platform not in out or not account:
            continue
        girls = source.get("girls") or source.get("girl") or []
        if isinstance(girls, str):
            girls = [x.strip() for x in re.split(r"[,，、;/]+", girls) if x.strip()]
        out[platform][account] = [str(x).strip() for x in girls if str(x).strip()]
    return out


def force_mapped_girls(row: dict, platform: str, mapping: dict[str, dict[str, list[str]]]) -> dict:
    account = normalize_account(username_from_item(row))
    mapped = mapping.get(platform, {}).get(account, [])
    if not mapped:
        return row
    patched = dict(row)
    patched["_mapped_girls"] = "、".join(mapped)
    return patched


def build_unmatched_whitelist_event(row: dict, platform: str) -> dict | None:
    """Keep strong public-event candidates even when the girl's name/handle is absent.

    This is intentionally strict: the post must have BOTH a future concrete date and a
    strong event term. These rows are marked 待確認 so they are visible instead of lost.
    """
    if row.get("error"):
        return None
    text = post_text(row)
    term = find_event_term(text)
    event_dt = choose_event_date(text)
    if not text or not term or not event_dt:
        return None

    event_time = extract_time(text)
    account = username_from_item(row)
    url = post_url(row, platform)
    image = first_image(row)

    lines = [re.sub(r"\s+", " ", x).strip(" -|｜") for x in text.splitlines() if x.strip()]
    title = next((x for x in lines if term in x and len(x) <= 110), "")
    if not title:
        title = f"{term}｜{event_dt.month}/{event_dt.day}｜@{account or '活動來源'}"

    signature = f"{event_dt:%Y/%m/%d}|{event_time}|{platform}|{normalize_account(account)}|{term}"
    uid = hashlib.sha1((signature + "|" + url).encode("utf-8")).hexdigest()[:16]
    return {
        "id": f"auto-event-unmatched-{uid}",
        "date": event_dt.strftime("%Y/%m/%d"),
        "time": event_time,
        "girls": "待確認",
        "eventname": title,
        "host": f"@{account}" if account else "",
        "address": "詳見原始活動貼文",
        "note": f"自動發現來源：{platform}。目前貼文未能自動辨識女孩，已先保留活動；請以原始貼文為準。",
        "img": image,
        "link": url,
        "source": f"{platform} @{account}" if account else platform,
        "activity_type": term,
        "activity_signature": signature,
        "needs_girl_review": True,
        "auto": True,
    }


def parse_and_merge(
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
        "unmatched_kept": 0,
    }
    found = []
    error_samples = 0

    for original in rows:
        if original.get("error") and error_samples < 5:
            print(f"{platform.upper()} ACTOR ERROR: {original.get('error')} | {original.get('errorDescription', '')}")
            error_samples += 1

        row = force_mapped_girls(original, platform, mapping)
        if row is not original:
            stats["mapped"] += 1

        event = build_event(row, platform, girls, stats)
        if event:
            found.append(event)
            continue

        fallback = build_unmatched_whitelist_event(original, platform)
        if fallback:
            found.append(fallback)
            stats["unmatched_kept"] += 1

    print(
        f"{platform.upper()}: actor rows={len(rows)}, accepted={len(found)}, "
        f"stats={json.dumps(stats, ensure_ascii=False)}"
    )
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
        current, _ = parse_and_merge("instagram", ig_rows, girls, current, mapping)
        successful_platforms += 1
    except Exception as exc:
        print(f"INSTAGRAM FETCH FAILED: {type(exc).__name__}: {exc}")

    try:
        thread_rows = fetch_threads(token, thread_accounts, explicit)
        current, _ = parse_and_merge("threads", thread_rows, girls, current, mapping)
        successful_platforms += 1
    except Exception as exc:
        print(f"THREADS FETCH FAILED: {type(exc).__name__}: {exc}")

    EVENTS_FILE.write_text(json.dumps(current, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Social fetch completed; successful_platforms={successful_platforms}/2; total_before_dedupe={len(current)}")

    if successful_platforms == 0:
        raise SystemExit("Both Instagram and Threads fetchers failed")


if __name__ == "__main__":
    main()
