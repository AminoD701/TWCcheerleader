from __future__ import annotations

import csv
import hashlib
import html
import io
import json
import os
import re
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

SHEET_CSV = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vT9l-hRhzMwcRdyQHsRs_97fja0Gg4RCcDDMk31u-dSbbQmk_JIUmbPTAj2gaNYmb6bYTwUvv4_1IxN/"
    "pub?output=csv&gid=0"
)
SOURCES_FILE = Path("data/event-social-sources.json")
POSTS_FILE = Path("data/event-social-posts.json")
EVENTS_FILE = Path("data/auto-events.json")
TZ = timezone(timedelta(hours=8))
MAX_FUTURE_DAYS = 240

EVENT_TERMS = [
    "一日店長", "一日店員", "一日經理", "店長", "店員", "見面會", "粉絲見面會",
    "簽名會", "拍照會", "握手會", "合照會", "品牌活動", "品牌大使", "開幕活動",
    "開幕", "站台", "商演", "快閃店", "快閃活動", "新品發表", "記者會", "嘉賓",
    "出席", "公開活動", "路跑", "派對", "應援活動", "粉絲活動", "活動現場",
]
CONTEXT_HINTS = [
    "活動", "現場", "報名", "登場", "出席", "來店", "店長", "店員", "見面", "合照",
    "簽名", "快閃", "開幕", "場次", "時間", "地點", "日期"
]


def http_json(url: str, payload: dict | None = None, timeout: int = 300):
    data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": "TWCcheerleaderEventBot/4.0"},
        method="POST" if data is not None else "GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))


def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "zh-TW,zh;q=0.9"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def clean_alias(value: str) -> str:
    value = html.unescape(str(value or "")).strip()
    if not value:
        return ""
    if "instagram.com/" in value or "threads.com/" in value or "threads.net/" in value:
        m = re.search(r"/@?([A-Za-z0-9._-]+)", value)
        if m:
            value = m.group(1)
    value = value.strip().lstrip("@").strip("/ ")
    return value


def load_girls() -> list[dict]:
    rows = csv.DictReader(io.StringIO(fetch_text(SHEET_CSV)))
    out, seen = [], set()
    social_key_hints = ("ig", "instagram", "threads", "帳號", "社群", "英文", "english", "韓文", "korean")
    for row in rows:
        real = (row.get("realname") or row.get("姓名") or "").strip()
        nick = (row.get("nickname") or row.get("綽號") or row.get("藝名") or "").strip()
        image = (row.get("img") or row.get("image") or row.get("圖片") or "").strip()
        if not real or real.lower() in seen:
            continue
        seen.add(real.lower())
        aliases = {clean_alias(real), clean_alias(nick)}
        for key, value in row.items():
            kl = str(key or "").lower()
            if any(h in kl for h in social_key_hints):
                for part in re.split(r"[,，;/\s]+", str(value or "")):
                    a = clean_alias(part)
                    if a:
                        aliases.add(a)
        aliases = [a for a in aliases if len(a) >= 2]
        out.append({"realname": real, "aliases": aliases, "img": image})
    return out


def normalize_for_match(value: str) -> str:
    return re.sub(r"[\s@._-]+", "", str(value or "")).lower()


def girl_matches(text: str, girls: list[dict]) -> list[dict]:
    raw = str(text or "")
    compact = normalize_for_match(raw)
    found = []
    for girl in girls:
        for alias in girl["aliases"]:
            if alias in raw or normalize_for_match(alias) in compact:
                found.append(girl)
                break
        if len(found) >= 12:
            break
    return found


def flatten_strings(value, depth: int = 0) -> list[str]:
    if depth > 5:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    if isinstance(value, dict):
        out = []
        for v in value.values():
            out.extend(flatten_strings(v, depth + 1))
        return out
    if isinstance(value, list):
        out = []
        for v in value[:50]:
            out.extend(flatten_strings(v, depth + 1))
        return out
    return []


def post_text(item: dict) -> str:
    strings = flatten_strings(item)
    seen, parts = set(), []
    for s in strings:
        s = html.unescape(str(s)).strip()
        if not s or s in seen:
            continue
        if s.startswith("http") and len(s) > 180:
            continue
        seen.add(s)
        parts.append(s)
    return "\n".join(parts)


def find_event_term(text: str) -> str:
    return next((term for term in EVENT_TERMS if term in text), "")


def candidate_dates(text: str) -> list[datetime]:
    now = datetime.now(TZ)
    patterns = [
        re.compile(r"(?P<y>20\d{2})\s*[年/.-]\s*(?P<m>\d{1,2})\s*[月/.-]\s*(?P<d>\d{1,2})\s*日?"),
        re.compile(r"(?<!\d)(?P<m>\d{1,2})\s*月\s*(?P<d>\d{1,2})\s*日"),
        re.compile(r"(?<!\d)(?P<m>\d{1,2})\s*[/.-]\s*(?P<d>\d{1,2})(?!\d)"),
    ]
    out = []
    for pat in patterns:
        for m in pat.finditer(text):
            try:
                year = int(m.groupdict().get("y") or now.year)
                dt = datetime(year, int(m.group("m")), int(m.group("d")), tzinfo=TZ)
                if dt < now - timedelta(days=1) and not m.groupdict().get("y"):
                    dt = dt.replace(year=year + 1)
                if now - timedelta(days=1) <= dt <= now + timedelta(days=MAX_FUTURE_DAYS):
                    out.append(dt)
            except Exception:
                pass
    return sorted(set(out))


def choose_event_date(text: str) -> datetime | None:
    dates = candidate_dates(text)
    return dates[0] if dates else None


def extract_time(text: str) -> str:
    m = re.search(r"(?<!\d)([01]?\d|2[0-3])\s*[:：]\s*(\d{2})(?!\d)", text)
    if m:
        return f"{int(m.group(1)):02d}:{m.group(2)}"
    m = re.search(r"(上午|中午|下午|晚上)\s*(\d{1,2})(?:\s*點(?:\s*(\d{1,2})\s*分?)?)?", text)
    if m:
        part, hour, minute = m.group(1), int(m.group(2)), int(m.group(3) or 0)
        if part in ("下午", "晚上") and hour < 12:
            hour += 12
        if part == "中午" and hour < 11:
            hour += 12
        return f"{hour:02d}:{minute:02d}"
    return "TBA"


def first_image(item: dict) -> str:
    urls = []
    for s in flatten_strings(item):
        if isinstance(s, str) and s.startswith("http") and re.search(r"\.(?:jpg|jpeg|png|webp)(?:\?|$)", s, re.I):
            urls.append(s)
    for key in ("displayUrl", "imageUrl", "thumbnailUrl", "profilePicUrl"):
        v = item.get(key)
        if isinstance(v, str) and v.startswith("http"):
            urls.insert(0, v)
    return urls[0] if urls else ""


def username_from_item(item: dict) -> str:
    for key in ("ownerUsername", "username", "owner_username", "authorUsername"):
        v = item.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip().lstrip("@")
    for key in ("owner", "author", "user"):
        v = item.get(key)
        if isinstance(v, dict):
            for sub in ("username", "handle"):
                if isinstance(v.get(sub), str):
                    return v[sub].strip().lstrip("@")
    return ""


def post_url(item: dict, platform: str) -> str:
    for key in ("url", "postUrl", "post_url", "shortCodeUrl", "shortcodeUrl", "inputUrl"):
        v = item.get(key)
        if isinstance(v, str) and v.startswith("http"):
            return v
    code = item.get("shortCode") or item.get("shortcode") or item.get("code")
    account = username_from_item(item)
    if code and platform == "instagram":
        return f"https://www.instagram.com/p/{code}/"
    if code and platform == "threads" and account:
        return f"https://www.threads.com/@{account}/post/{code}"
    return ""


def clean_event_title(text: str, term: str, matched: list[dict], event_dt: datetime) -> str:
    names = [g["realname"] for g in matched]
    for line in [re.sub(r"\s+", " ", x).strip() for x in text.splitlines() if x.strip()]:
        if len(line) <= 110 and (term in line or any(n in line for n in names)):
            return line
    return f"{'、'.join(names[:4])} {term or '公開活動'}｜{event_dt.month}/{event_dt.day}"


def build_event(item: dict, platform: str, girls: list[dict], stats: dict) -> dict | None:
    if item.get("error"):
        stats["actor_error"] += 1
        return None
    if platform == "threads" and (item.get("itemType") == "profile" or item.get("isReply") is True):
        stats["non_post"] += 1
        return None
    text = post_text(item)
    if not text:
        stats["no_text"] += 1
        return None
    matched = girl_matches(text, girls)
    if not matched:
        stats["no_girl"] += 1
        return None
    event_dt = choose_event_date(text)
    if not event_dt:
        stats["no_date"] += 1
        return None
    term = find_event_term(text)
    event_time = extract_time(text)
    if not term and event_time == "TBA" and not any(h in text for h in CONTEXT_HINTS):
        stats["no_event_signal"] += 1
        return None
    term = term or "公開活動"
    account = username_from_item(item)
    title = clean_event_title(text, term, matched, event_dt)
    image = first_image(item) or next((g["img"] for g in matched if g.get("img")), "")
    url = post_url(item, platform)
    names = "、".join(g["realname"] for g in matched)
    signature = f"{event_dt:%Y/%m/%d}|{event_time}|{re.sub(r'[^\w\u4e00-\u9fff]+', '', title).lower()}"
    uid = hashlib.sha1((signature + "|" + url).encode("utf-8")).hexdigest()[:16]
    stats["accepted"] += 1
    return {
        "id": f"auto-event-apify-{uid}",
        "date": event_dt.strftime("%Y/%m/%d"),
        "time": event_time,
        "girls": names,
        "eventname": title,
        "host": f"@{account}" if account else "",
        "address": "詳見官方公告",
        "note": f"自動發現來源：{platform}。活動細節請以原始貼文最新公告為準。",
        "img": image,
        "link": url,
        "source": f"{platform} @{account}" if account else platform,
        "activity_type": term,
        "activity_signature": signature,
        "auto": True,
    }


def apify_sync(actor: str, payload: dict, token: str) -> list[dict]:
    actor_id = actor.replace("/", "~")
    url = f"https://api.apify.com/v2/acts/{actor_id}/run-sync-get-dataset-items?token={urllib.parse.quote(token)}&clean=true"
    result = http_json(url, payload=payload, timeout=300)
    return result if isinstance(result, list) else []


def normalize_threads_url(url: str) -> str:
    url = url.replace("threads.com", "threads.net")
    m = re.search(r"threads\.net/share/([A-Za-z0-9_-]+)", url)
    if m:
        return f"https://www.threads.net/t/{m.group(1)}"
    return url


def main() -> None:
    token = os.environ.get("APIFY_TOKEN", "").strip()
    if not token:
        raise SystemExit("APIFY_TOKEN is not configured; refusing to overwrite event data.")

    girls = load_girls()
    sources = json.loads(SOURCES_FILE.read_text(encoding="utf-8")) if SOURCES_FILE.exists() else []
    explicit = json.loads(POSTS_FILE.read_text(encoding="utf-8")) if POSTS_FILE.exists() else []

    ig_accounts = sorted({s.get("account", "").lstrip("@") for s in sources if s.get("platform") == "instagram" and s.get("account")})
    thread_accounts = sorted({s.get("account", "").lstrip("@") for s in sources if s.get("platform") == "threads" and s.get("account")})
    thread_urls = []
    for item in explicit:
        url = item if isinstance(item, str) else item.get("url", "")
        if "threads.com" in url or "threads.net" in url:
            thread_urls.append(normalize_threads_url(url))

    raw_posts: list[tuple[str, dict]] = []

    if ig_accounts:
        payload = {
            "usernames": ig_accounts,
            "outputFormat": "posts",
            "maxPosts": 12,
            "includeVideoTab": False,
            "includeRelatedProfiles": False,
            "includeRaw": False,
            "proxy": {"useApifyProxy": True, "apifyProxyGroups": ["RESIDENTIAL"]},
        }
        for item in apify_sync("simple.actors/instagram-profile-posts", payload, token):
            raw_posts.append(("instagram", item))

    if thread_accounts or thread_urls:
        start_urls = [{"url": f"https://www.threads.net/@{u}"} for u in thread_accounts]
        start_urls.extend({"url": u} for u in thread_urls)
        payload = {
            "startUrls": start_urls,
            "usernames": thread_accounts,
            "maxItems": 12,
            "proxyConfiguration": {"useApifyProxy": True},
        }
        for item in apify_sync("anyxsolutions/threads-scraper", payload, token):
            raw_posts.append(("threads", item))

    current = json.loads(EVENTS_FILE.read_text(encoding="utf-8")) if EVENTS_FILE.exists() else []
    stats = {"actor_error": 0, "non_post": 0, "no_text": 0, "no_girl": 0, "no_date": 0, "no_event_signal": 0, "accepted": 0}
    found = []
    rejected_samples = 0

    for platform, item in raw_posts:
        event = build_event(item, platform, girls, stats)
        if event:
            found.append(event)
        elif rejected_samples < 8 and not item.get("error"):
            sample = post_text(item).replace("\n", " ")[:260]
            print(f"REJECT SAMPLE [{platform}] keys={list(item.keys())[:20]} text={sample}")
            rejected_samples += 1

    merged = current + found
    EVENTS_FILE.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Apify returned {len(raw_posts)} rows; parsed {len(found)} activity posts; total before dedupe {len(merged)}")
    print("Parser stats:", json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
