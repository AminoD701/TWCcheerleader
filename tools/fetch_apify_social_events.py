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
CONTEXT_HINTS = ["活動", "現場", "報名", "登場", "出席", "來店", "店長", "店員", "見面", "合照", "簽名", "快閃", "開幕", "場次"]


def http_json(url: str, payload: dict | None = None, token: str | None = None, timeout: int = 300):
    data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {"Content-Type": "application/json", "User-Agent": "TWCcheerleaderEventBot/3.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if data is not None else "GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))


def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "zh-TW,zh;q=0.9"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def load_girls() -> list[dict]:
    rows = csv.DictReader(io.StringIO(fetch_text(SHEET_CSV)))
    out, seen = [], set()
    for row in rows:
        real = (row.get("realname") or row.get("姓名") or "").strip()
        nick = (row.get("nickname") or row.get("綽號") or row.get("藝名") or "").strip()
        image = (row.get("img") or row.get("image") or row.get("圖片") or "").strip()
        if not real or real.lower() in seen:
            continue
        seen.add(real.lower())
        aliases = [x for x in {real, nick} if x and len(x) >= 2]
        out.append({"realname": real, "aliases": aliases, "img": image})
    return out


def girl_matches(text: str, girls: list[dict]) -> list[dict]:
    found = []
    compact = re.sub(r"\s+", "", text or "")
    for girl in girls:
        if any(alias in text or re.sub(r"\s+", "", alias) in compact for alias in girl["aliases"]):
            found.append(girl)
        if len(found) >= 12:
            break
    return found


def find_event_term(text: str) -> str:
    return next((term for term in EVENT_TERMS if term in text), "")


def candidate_dates(text: str) -> list[datetime]:
    now = datetime.now(TZ)
    candidates = []
    patterns = [
        re.compile(r"(?P<y>20\d{2})\s*[年/.-]\s*(?P<m>\d{1,2})\s*[月/.-]\s*(?P<d>\d{1,2})\s*日?"),
        re.compile(r"(?<!\d)(?P<m>\d{1,2})\s*月\s*(?P<d>\d{1,2})\s*日"),
        re.compile(r"(?<!\d)(?P<m>\d{1,2})\s*[/.-]\s*(?P<d>\d{1,2})(?!\d)"),
    ]
    for pat in patterns:
        for m in pat.finditer(text):
            try:
                has_year = bool(m.groupdict().get("y"))
                year = int(m.groupdict().get("y") or now.year)
                dt = datetime(year, int(m.group("m")), int(m.group("d")), tzinfo=TZ)
                if dt < now - timedelta(days=1) and not has_year:
                    dt = dt.replace(year=year + 1)
                if now - timedelta(days=1) <= dt <= now + timedelta(days=MAX_FUTURE_DAYS):
                    candidates.append(dt)
            except Exception:
                pass
    return sorted(set(candidates))


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


def flatten_text(value, depth: int = 0) -> list[str]:
    if depth > 3:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    if isinstance(value, dict):
        out = []
        for k, v in value.items():
            if k.lower() in {"caption", "captiontext", "text", "description", "title", "body", "content", "alt", "alttext", "accessibilitycaption"}:
                out.extend(flatten_text(v, depth + 1))
        return out
    if isinstance(value, list):
        out = []
        for v in value[:12]:
            out.extend(flatten_text(v, depth + 1))
        return out
    return []


def post_text(item: dict) -> str:
    parts = []
    for key in ("caption", "captionText", "text", "description", "title", "body", "content", "accessibilityCaption", "altText", "alt"):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            parts.append(value.strip())
        elif isinstance(value, (dict, list)):
            parts.extend(flatten_text(value))
    if not parts:
        parts.extend(flatten_text(item))
    seen, clean = set(), []
    for p in parts:
        p = html.unescape(str(p)).strip()
        if p and p not in seen:
            seen.add(p)
            clean.append(p)
    return "\n".join(clean)


def first_image(item: dict) -> str:
    candidates = [item.get(k) for k in (
        "displayUrl", "display_url", "imageUrl", "image_url", "thumbnailUrl", "thumbnail_url",
        "profilePicUrl", "profile_pic", "user_pic"
    )]
    for key in ("images", "imageUrls", "image_urls", "mediaUrls", "media_urls", "childPosts", "carousel_media", "sidecarChildren"):
        value = item.get(key)
        if isinstance(value, list):
            for x in value:
                if isinstance(x, str):
                    candidates.append(x)
                elif isinstance(x, dict):
                    candidates.extend([x.get("url"), x.get("displayUrl"), x.get("imageUrl")])
    return next((x for x in candidates if isinstance(x, str) and x.startswith("http")), "")


def post_url(item: dict, platform: str) -> str:
    for key in ("url", "postUrl", "post_url", "shortCodeUrl", "shortcodeUrl", "inputUrl", "profileUrl"):
        value = item.get(key)
        if isinstance(value, str) and value.startswith("http"):
            return value
    code = item.get("shortCode") or item.get("shortcode") or item.get("code")
    account = username_from_item(item)
    if code and platform == "instagram":
        return f"https://www.instagram.com/p/{code}/"
    if code and platform == "threads" and account:
        return f"https://www.threads.com/@{account}/post/{code}"
    return ""


def username_from_item(item: dict) -> str:
    for key in ("ownerUsername", "username", "owner_username", "authorUsername", "author", "user"):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip().lstrip("@")
        if isinstance(value, dict):
            for sub in ("username", "handle"):
                if isinstance(value.get(sub), str):
                    return value[sub].lstrip("@")
    return ""


def clean_event_title(text: str, term: str, account: str, matched: list[dict], event_dt: datetime) -> str:
    lines = [re.sub(r"\s+", " ", x).strip(" -|｜") for x in text.splitlines() if x.strip()]
    names = [g["realname"] for g in matched]
    for line in lines:
        if len(line) <= 110 and (term in line or any(n in line for n in names)):
            return line
    host = f"@{account}" if account else "公開活動"
    return f"{'、'.join(names[:4])} {term or '公開活動'}｜{event_dt.month}/{event_dt.day}｜{host}"


def build_event(item: dict, platform: str, girls: list[dict], stats: dict) -> dict | None:
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
    if not term:
        if event_time == "TBA" and not any(h in text for h in CONTEXT_HINTS):
            stats["no_event_signal"] += 1
            return None
        term = "公開活動"
    account = username_from_item(item)
    title = clean_event_title(text, term, account, matched, event_dt)
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
            thread_urls.append(url)

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
        start_urls.extend({"url": u.replace("threads.com", "threads.net")} for u in thread_urls)
        payload = {"startUrls": start_urls, "usernames": thread_accounts, "maxItems": 12, "proxyConfiguration": {"useApifyProxy": True}}
        for item in apify_sync("anyxsolutions/threads-scraper", payload, token):
            if item.get("itemType") == "profile":
                continue
            raw_posts.append(("threads", item))

    current = json.loads(EVENTS_FILE.read_text(encoding="utf-8")) if EVENTS_FILE.exists() else []
    found = []
    stats = {"no_text": 0, "no_girl": 0, "no_date": 0, "no_event_signal": 0, "accepted": 0}
    sample_printed = 0
    for platform, item in raw_posts:
        event = build_event(item, platform, girls, stats)
        if event:
            found.append(event)
        elif sample_printed < 5:
            txt = post_text(item).replace("\n", " ")[:220]
            print(f"REJECT SAMPLE [{platform}] keys={sorted(item.keys())[:20]} text={txt}")
            sample_printed += 1

    merged = current + found
    EVENTS_FILE.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Apify returned {len(raw_posts)} posts; parsed {len(found)} activity posts; total before dedupe {len(merged)}")
    print("Parser stats:", json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
