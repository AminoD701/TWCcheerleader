from __future__ import annotations

import json
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fetch_apify_social_events import (
    EVENTS_FILE,
    POSTS_FILE,
    SOURCES_FILE,
    apify_sync,
    build_event,
    extract_context_names,
    load_girls,
    post_text,
    post_url,
    username_from_item,
)

TZ = timezone(timedelta(hours=8))
EVENT_TERMS_LOCAL = ["一日店長", "一日店員", "一日經理", "見面會", "粉絲見面會", "簽名會", "拍照會", "商演", "站台", "路跑", "派對", "活動"]


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def normalize_account(value: str) -> str:
    return re.sub(r"[^a-z0-9._-]+", "", str(value or "").lower().lstrip("@"))


def normalize_text(value: str) -> str:
    return re.sub(r"[\s@._\-·•]+", "", str(value or "")).lower()


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
        out[platform][account] = split_names(source.get("girls") or source.get("girl") or [])
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


def looks_like_date_or_label(value: str) -> bool:
    s = str(value or "").strip()
    if not s:
        return True
    if re.search(r"\d{1,2}\s*月\s*\d{1,2}\s*日", s):
        return True
    if re.fullmatch(r"\d{1,2}\s*月\s*\d{1,2}\s*日?.*", s):
        return True
    bad = ("女神降臨", "活動", "料理派對", "一日店長", "一日店員", "店長", "日期", "時間", "地點")
    return any(x in s for x in bad)


def exact_realname_matches(text: str, girls: list[dict]) -> list[str]:
    result = []
    for girl in girls:
        name = str(girl.get("realname") or "").strip()
        if len(name) >= 2 and name in text and name not in result:
            result.append(name)
    return result[:6]


def safe_alias_matches(text: str, girls: list[dict]) -> list[str]:
    result = []
    for girl in girls:
        real = str(girl.get("realname") or "").strip()
        if real in result:
            continue
        for alias in girl.get("aliases", []):
            alias = str(alias or "").strip()
            if not alias or alias == real:
                continue
            norm = normalize_text(alias)
            if len(norm) >= 3:
                matched = alias in text or (alias.isascii() and re.search(rf"(?<![A-Za-z0-9._])@?{re.escape(alias)}(?![A-Za-z0-9._])", text, re.I) is not None)
            else:
                matched = re.search(
                    rf"(?:^|[\s、，,：:；;｜|【】\[\]（）()「」『』#]|(?:與|和|及))"
                    rf"{re.escape(alias)}"
                    rf"(?=$|[\s、，,。.!！?？：:；;｜|【】\[\]（）()「」『』#]|(?:與|和|及))",
                    text,
                ) is not None
            if matched:
                result.append(real)
                break
    return result[:6]


def canonicalize_context_names(text: str, girls: list[dict]) -> list[str]:
    result = []
    for raw in [x for x in extract_context_names(text) if not str(x).startswith("@")]:
        cleaned = str(raw).strip()
        if looks_like_date_or_label(cleaned):
            continue
        for name in exact_realname_matches(cleaned, girls) or safe_alias_matches(cleaned, girls):
            if name not in result:
                result.append(name)
        if len(result) >= 4:
            break
    return result


def caption_roster_names(text: str, girls: list[dict]) -> list[str]:
    exact = exact_realname_matches(text, girls)
    if exact:
        return exact
    return safe_alias_matches(text, girls)


def near_event_names(text: str, girls: list[dict]) -> list[str]:
    result = []
    for term in EVENT_TERMS_LOCAL:
        start = 0
        while True:
            pos = text.find(term, start)
            if pos < 0:
                break
            window = text[max(0, pos - 120): pos + len(term) + 120]
            for name in exact_realname_matches(window, girls) or safe_alias_matches(window, girls):
                if name not in result:
                    result.append(name)
            start = pos + len(term)
    return result[:4]


def strict_event_date(text: str) -> datetime | None:
    """Parse public-event dates without turning stale month/day posts into next-year events."""
    now = datetime.now(TZ)
    sep = r"[/／.．·・-]"
    patterns = [
        (re.compile(r"(?<!\d)(?P<y>20\d{2})(?P<m>\d{2})(?P<d>\d{2})(?!\d)"), True),
        (re.compile(rf"(?P<y>20\d{{2}})\s*(?:年|{sep})\s*(?P<m>\d{{1,2}})\s*(?:月|{sep})\s*(?P<d>\d{{1,2}})\s*日?"), True),
        (re.compile(r"(?<!\d)(?P<m>\d{1,2})\s*月\s*(?P<d>\d{1,2})\s*日"), False),
        (re.compile(rf"(?<!\d)(?P<m>\d{{1,2}})\s*{sep}\s*(?P<d>\d{{1,2}})(?!\d)"), False),
    ]
    candidates = []
    term_positions = [text.find(t) for t in EVENT_TERMS_LOCAL if text.find(t) >= 0]
    for pat, has_year in patterns:
        for m in pat.finditer(text):
            try:
                month, day = int(m.group("m")), int(m.group("d"))
                year = int(m.groupdict().get("y") or now.year)
                dt = datetime(year, month, day, tzinfo=TZ)
                if not has_year and dt.date() < (now - timedelta(days=1)).date():
                    # Only allow genuine year-boundary inference near the end of the year.
                    if now.month >= 11 and month <= 2:
                        dt = dt.replace(year=year + 1)
                    else:
                        continue
                if dt < now - timedelta(days=1) or dt > now + timedelta(days=240):
                    continue
                distance = min((abs(m.start() - p) for p in term_positions), default=0)
                candidates.append((distance, m.start(), dt))
            except Exception:
                continue
    if not candidates:
        return None
    candidates.sort(key=lambda x: (x[0], x[1], x[2]))
    return candidates[0][2]


def primary_girls_for_row(row, platform, girls, source_mapping, explicit_mapping):
    key = post_key(post_url(row, platform))
    if key and explicit_mapping.get(key):
        return explicit_mapping[key], "post_override"
    account = normalize_account(username_from_item(row))
    mapped = source_mapping.get(platform, {}).get(account, [])
    if mapped:
        return mapped, "source_mapping"
    text = post_text(row)
    context = canonicalize_context_names(text, girls)
    if context:
        return context, "event_context"
    roster = caption_roster_names(text, girls)
    if roster:
        return roster, "caption_roster"
    nearby = near_event_names(text, girls)
    if nearby:
        return nearby, "near_event"
    return ["待確認"], "unresolved"


def force_primary_girls(row, platform, girls, source_mapping, explicit_mapping):
    names, reason = primary_girls_for_row(row, platform, girls, source_mapping, explicit_mapping)
    patched = dict(row)
    patched["_mapped_girls"] = "、".join(names)
    return patched, reason


def is_social_event_for_platform(event: dict, platform: str) -> bool:
    source = str(event.get("source", "")).lower()
    event_id = str(event.get("id", ""))
    return source.startswith(platform.lower() + " ") or event_id.startswith("auto-event-unmatched-") or (event_id.startswith("auto-event-apify-") and platform.lower() in source)


def parse_platform(platform, rows, girls, current, source_mapping, explicit_mapping):
    stats = {
        "actor_error": 0, "non_post": 0, "no_text": 0, "no_girl": 0, "no_date": 0,
        "no_event_signal": 0, "accepted": 0, "post_override": 0, "source_mapping": 0,
        "event_context": 0, "caption_roster": 0, "near_event": 0, "unresolved": 0,
        "strict_date_fixed": 0, "stale_puppy_skipped": 0,
    }
    found = []
    for original in rows:
        if original.get("error"):
            print(f"{platform.upper()} ACTOR ERROR: {original.get('error')} | {original.get('errorDescription', '')}")
        row, reason = force_primary_girls(original, platform, girls, source_mapping, explicit_mapping)
        stats[reason] += 1
        event = build_event(row, platform, girls, stats)
        if not event:
            continue

        text = post_text(original)
        strict_dt = strict_event_date(text)
        account = normalize_account(username_from_item(original))
        if strict_dt:
            correct_date = strict_dt.strftime("%Y/%m/%d")
            if event.get("date") != correct_date:
                event["date"] = correct_date
                sig = str(event.get("activity_signature") or "")
                if "|" in sig:
                    event["activity_signature"] = correct_date + "|" + sig.split("|", 1)[1]
                stats["strict_date_fixed"] += 1
        elif account == "hhpuppy_studio":
            # Heartbroken Puppy has older posts in the scrape window. If no valid current/future
            # date is present in the clean caption, do not fabricate a next-year event.
            stats["stale_puppy_skipped"] += 1
            continue

        event["needs_girl_review"] = reason == "unresolved"
        if reason == "unresolved":
            event["note"] = f"自動發現來源：{platform}。活動日期已由貼文正文解析；人物尚待確認，請以原始貼文為準。"
        else:
            event["girl_match_method"] = reason
        found.append(event)

    preserved = [e for e in current if not is_social_event_for_platform(e, platform)]
    print(f"{platform.upper()}: actor rows={len(rows)}, accepted={len(found)}, stats={json.dumps(stats, ensure_ascii=False)}")
    return preserved + found, stats


def fetch_instagram(token: str, accounts: list[str]) -> list[dict]:
    if not accounts:
        return []
    payload = {"usernames": accounts, "resultsType": "posts", "postsLimit": 12, "maxRecords": max(12, len(accounts) * 12)}
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
    ig_accounts = sorted({str(s.get("account", "")).lstrip("@") for s in sources if s.get("platform") == "instagram" and s.get("account")})
    thread_accounts = sorted({str(s.get("account", "")).lstrip("@") for s in sources if s.get("platform") == "threads" and s.get("account")})
    successful_platforms = 0
    try:
        current, _ = parse_platform("instagram", fetch_instagram(token, ig_accounts), girls, current, source_mapping, explicit_mapping)
        successful_platforms += 1
    except Exception as exc:
        print(f"INSTAGRAM FETCH FAILED: {type(exc).__name__}: {exc}")
    try:
        current, _ = parse_platform("threads", fetch_threads(token, thread_accounts, explicit), girls, current, source_mapping, explicit_mapping)
        successful_platforms += 1
    except Exception as exc:
        print(f"THREADS FETCH FAILED: {type(exc).__name__}: {exc}")
    EVENTS_FILE.write_text(json.dumps(current, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Social fetch completed; successful_platforms={successful_platforms}/2; total_before_dedupe={len(current)}")
    if successful_platforms == 0:
        raise SystemExit("Both Instagram and Threads fetchers failed")


if __name__ == "__main__":
    main()
