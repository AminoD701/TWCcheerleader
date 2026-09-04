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
    post_url,
    username_from_item,
)

TZ = timezone(timedelta(hours=8))
EVENT_TERMS_LOCAL = [
    "一日店長", "一日店員", "一日經理", "見面會", "粉絲見面會", "女神來見面",
    "女神見面", "來見面", "見面活動", "來店見面", "粉絲見面", "與你見面", "見面日",
    "簽名會", "拍照會", "商演", "站台", "路跑", "派對", "活動",
]


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


def _string_values(value) -> list[str]:
    if isinstance(value, str):
        return [value.strip()] if value.strip() else []
    if isinstance(value, list):
        out = []
        for v in value[:20]:
            if isinstance(v, str) and v.strip():
                out.append(v.strip())
        return out
    return []


def clean_post_body(row: dict) -> str:
    """Return only actual post/caption text, excluding author/profile/related metadata."""
    preferred = ("caption", "text", "postText", "post_text", "body", "content", "description", "message")
    parts = []
    for key in preferred:
        parts.extend(_string_values(row.get(key)))

    # Some actors wrap the real post in one explicit post/media/node object. Read only known body fields.
    if not parts:
        for container_key in ("post", "media", "node"):
            obj = row.get(container_key)
            if isinstance(obj, dict):
                for key in preferred:
                    parts.extend(_string_values(obj.get(key)))

    seen, clean = set(), []
    for part in parts:
        part = re.sub(r"\r\n?", "\n", str(part)).strip()
        if part and part not in seen:
            seen.add(part)
            clean.append(part)
    return "\n".join(clean)


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
        for alias in girl.get("aliases", []):
            alias = str(alias or "").strip()
            if not alias or alias == real:
                continue
            norm = normalize_text(alias)
            # Long aliases / handles only. Two-character aliases are too collision-prone globally.
            if len(norm) < 3:
                continue
            matched = alias in text
            if alias.isascii():
                matched = re.search(rf"(?<![A-Za-z0-9._])@?{re.escape(alias)}(?![A-Za-z0-9._])", text, re.I) is not None
            if matched and real not in result:
                result.append(real)
                break
    return result[:6]


def local_alias_matches(text: str, girls: list[dict]) -> list[str]:
    """Allow short nicknames only inside a local event-name phrase with clear separators."""
    result = safe_alias_matches(text, girls)
    for girl in girls:
        real = str(girl.get("realname") or "").strip()
        if real in result:
            continue
        for alias in girl.get("aliases", []):
            alias = str(alias or "").strip()
            if alias == real or len(normalize_text(alias)) != 2:
                continue
            pat = (
                rf"(?:^|[\s、，,：:；;｜|【】\[\]（）()「」『』]|(?:與|和|及))"
                rf"{re.escape(alias)}"
                rf"(?=$|[\s、，,。.!！?？：:；;｜|【】\[\]（）()「」『』]|(?:與|和|及))"
            )
            if re.search(pat, text):
                result.append(real)
                break
    return result[:6]


def event_windows(text: str, radius: int = 140) -> list[str]:
    windows = []
    for term in EVENT_TERMS_LOCAL:
        start = 0
        while True:
            pos = text.find(term, start)
            if pos < 0:
                break
            windows.append(text[max(0, pos - radius): pos + len(term) + radius])
            start = pos + len(term)
    return windows[:8]


def primary_girls_for_row(row, platform, girls, source_mapping, explicit_mapping):
    key = post_key(post_url(row, platform))
    if key and explicit_mapping.get(key):
        return explicit_mapping[key], "post_override"

    account = normalize_account(username_from_item(row))
    mapped = source_mapping.get(platform, {}).get(account, [])
    if mapped:
        return mapped, "source_mapping"

    text = clean_post_body(row)
    if not text:
        return ["待確認"], "unresolved"

    # 1) Full roster names in the actual post body are authoritative.
    exact = exact_realname_matches(text, girls)
    if exact:
        return exact, "exact_body_name"

    # 2) Then inspect only the event-local phrase for aliases/nicknames.
    local = []
    for window in event_windows(text):
        for name in local_alias_matches(window, girls):
            if name not in local:
                local.append(name)
    if local:
        return local[:4], "event_local_alias"

    # 3) Long distinctive aliases/handles can be matched globally; short ones cannot.
    aliases = safe_alias_matches(text, girls)
    if aliases:
        return aliases[:4], "safe_body_alias"

    return ["待確認"], "unresolved"


def _date_candidates_from_line(line: str, line_offset: int, now: datetime):
    sep = r"[/／.．·・-]"
    patterns = [
        (re.compile(r"(?<!\d)(?P<y>20\d{2})(?P<m>\d{2})(?P<d>\d{2})(?!\d)"), True),
        (re.compile(rf"(?P<y>20\d{{2}})\s*(?:年|{sep})\s*(?P<m>\d{{1,2}})\s*(?:月|{sep})\s*(?P<d>\d{{1,2}})\s*日?"), True),
        (re.compile(r"(?<!\d)(?P<m>\d{1,2})\s*月\s*(?P<d>\d{1,2})\s*日"), False),
        (re.compile(rf"(?<!\d)(?P<m>\d{{1,2}})\s*{sep}\s*(?P<d>\d{{1,2}})(?!\d)"), False),
    ]
    out = []
    for pat, has_year in patterns:
        for m in pat.finditer(line):
            try:
                month, day = int(m.group("m")), int(m.group("d"))
                year = int(m.groupdict().get("y") or now.year)
                dt = datetime(year, month, day, tzinfo=TZ)
                if not has_year and dt.date() < (now - timedelta(days=1)).date():
                    if now.month >= 11 and month <= 2:
                        dt = dt.replace(year=year + 1)
                    else:
                        continue
                if now - timedelta(days=1) <= dt <= now + timedelta(days=240):
                    out.append((dt, line_offset + m.start(), has_year))
            except Exception:
                pass
    return out


def strict_event_date(text: str) -> datetime | None:
    """Choose an activity date, preferring explicit activity-date lines over signup/deadline dates."""
    now = datetime.now(TZ)
    candidates = []
    offset = 0
    for line in text.splitlines() or [text]:
        raw = line.strip()
        if not raw:
            offset += len(line) + 1
            continue
        positive = 0
        negative = 0
        if any(k in raw for k in ("活動日期", "活動日", "日期", "活動時間", "場次", "一日店長", "一日店員", "見面", "來店")):
            positive += 120
        if any(k in raw for k in ("報名", "截止", "開賣", "預購", "登記", "付款", "售票", "抽選")):
            negative += 160
        for dt, pos, has_year in _date_candidates_from_line(raw, offset, now):
            explicit = 25 if has_year else 0
            candidates.append((positive - negative + explicit, pos, dt))
        offset += len(line) + 1

    if not candidates:
        return None

    # Higher semantic score first; if tied, earlier occurrence wins.
    candidates.sort(key=lambda x: (-x[0], x[1], x[2]))
    return candidates[0][2]


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
        "exact_body_name": 0, "event_local_alias": 0, "safe_body_alias": 0, "unresolved": 0,
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

        clean_text = clean_post_body(original)
        strict_dt = strict_event_date(clean_text)
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
