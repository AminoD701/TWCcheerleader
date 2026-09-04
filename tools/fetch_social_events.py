from __future__ import annotations

import csv
import hashlib
import html
import io
import json
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
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36"
IG_APP_ID = "936619743392459"
EVENT_TERMS = [
    "一日店長", "一日店員", "見面會", "粉絲見面會", "簽名會", "拍照會", "握手會",
    "品牌活動", "品牌大使", "開幕活動", "開幕", "站台", "商演", "快閃店", "快閃活動",
    "新品發表", "記者會", "擔任嘉賓", "活動嘉賓", "出席活動", "公開活動", "路跑", "派對",
]
MAX_FUTURE_DAYS = 180
MAX_POSTS_PER_ACCOUNT = 16


def fetch_text(url: str, timeout: int = 15, extra_headers: dict | None = None) -> tuple[str, str]:
    headers = {
        "User-Agent": USER_AGENT,
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.7",
        "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    }
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read(2_500_000)
        return data.decode("utf-8", errors="replace"), resp.geturl()


def strip_html(value: str) -> str:
    value = re.sub(r"<script\b[^>]*>.*?</script>", " ", value or "", flags=re.I | re.S)
    value = re.sub(r"<style\b[^>]*>.*?</style>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def meta_value(page: str, keys: list[str]) -> str:
    for key in keys:
        patterns = [
            rf'<meta[^>]+(?:property|name)=["\']{re.escape(key)}["\'][^>]+content=["\']([^"\']+)',
            rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']{re.escape(key)}["\']',
        ]
        for pat in patterns:
            m = re.search(pat, page, flags=re.I)
            if m:
                return html.unescape(m.group(1).strip())
    return ""


def load_girls() -> list[dict]:
    page, _ = fetch_text(SHEET_CSV)
    rows = csv.DictReader(io.StringIO(page))
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
    for girl in girls:
        if any(alias in text for alias in girl["aliases"]):
            found.append(girl)
        if len(found) >= 8:
            break
    return found


def contains_event_term(text: str) -> bool:
    return any(term in text for term in EVENT_TERMS)


def candidate_dates(text: str) -> list[datetime]:
    now = datetime.now(TZ)
    candidates = []
    patterns = [
        re.compile(r"(?P<y>20\d{2})[年/.-](?P<m>\d{1,2})[月/.-](?P<d>\d{1,2})日?"),
        re.compile(r"(?<!\d)(?P<m>\d{1,2})月(?P<d>\d{1,2})日"),
        re.compile(r"(?<!\d)(?P<m>\d{1,2})/(?P<d>\d{1,2})(?!\d)"),
    ]
    for pat in patterns:
        for match in pat.finditer(text):
            try:
                year = int(match.groupdict().get("y") or now.year)
                dt = datetime(year, int(match.group("m")), int(match.group("d")), tzinfo=TZ)
                if dt < now - timedelta(days=1) and not match.groupdict().get("y"):
                    dt = datetime(year + 1, dt.month, dt.day, tzinfo=TZ)
                if now - timedelta(days=1) <= dt <= now + timedelta(days=MAX_FUTURE_DAYS):
                    candidates.append(dt)
            except Exception:
                pass
    return candidates


def choose_event_date(text: str) -> datetime | None:
    dates = candidate_dates(text)
    return min(dates) if dates else None


def extract_time(text: str) -> str:
    m = re.search(r"(?<!\d)(\d{1,2}[:：]\d{2})(?!\d)", text)
    if m:
        return m.group(1).replace("：", ":")
    m = re.search(r"(?:上午|下午|晚上|中午)\s*(\d{1,2})\s*點", text)
    return (m.group(1) + ":00") if m else "TBA"


def normalize_title(value: str) -> str:
    return re.sub(r"[\s\W_]+", "", value or "").lower()


def instagram_api_post_urls(account: str) -> list[str]:
    url = "https://www.instagram.com/api/v1/users/web_profile_info/?username=" + urllib.parse.quote(account)
    try:
        raw, _ = fetch_text(url, extra_headers={
            "X-IG-App-ID": IG_APP_ID,
            "X-ASBD-ID": "129477",
            "Referer": f"https://www.instagram.com/{account}/",
        })
        payload = json.loads(raw)
        user = (payload.get("data") or {}).get("user") or {}
        edges = ((user.get("edge_owner_to_timeline_media") or {}).get("edges") or [])
        urls = []
        for edge in edges[:MAX_POSTS_PER_ACCOUNT]:
            node = edge.get("node") or {}
            shortcode = node.get("shortcode")
            typename = node.get("__typename", "")
            if shortcode:
                kind = "reel" if "Video" in typename else "p"
                urls.append(f"https://www.instagram.com/{kind}/{shortcode}/")
        print(f"instagram API exposed {len(urls)} posts: @{account}")
        return urls
    except Exception as exc:
        print(f"instagram API failed: @{account}: {exc}")
        return []


def profile_post_urls(platform: str, account: str, page: str) -> list[str]:
    urls = set()
    if platform == "instagram":
        for m in re.finditer(r'(?:https?://(?:www\.)?instagram\.com)?/(p|reel)/([A-Za-z0-9_-]+)', page):
            urls.add(f"https://www.instagram.com/{m.group(1)}/{m.group(2)}/")
    elif platform == "threads":
        account_esc = re.escape(account)
        for m in re.finditer(rf'(?:https?://(?:www\.)?threads\.(?:com|net))?/@{account_esc}/post/([A-Za-z0-9_-]+)', page, flags=re.I):
            urls.add(f"https://www.threads.com/@{account}/post/{m.group(1)}")
        for m in re.finditer(r'/@([^/"\']+)/post/([A-Za-z0-9_-]+)', page):
            if m.group(1).lower() == account.lower():
                urls.add(f"https://www.threads.com/@{account}/post/{m.group(2)}")
    return list(urls)[:MAX_POSTS_PER_ACCOUNT]


def instagram_fallback_urls(url: str) -> list[str]:
    m = re.search(r"instagram\.com/(p|reel)/([A-Za-z0-9_-]+)", url)
    if not m:
        return [url]
    kind, code = m.group(1), m.group(2)
    return [
        f"https://www.instagram.com/{kind}/{code}/",
        f"https://www.instagram.com/{kind}/{code}/embed/captioned/",
        f"https://www.ddinstagram.com/{kind}/{code}/",
        f"https://www.vxinstagram.com/{kind}/{code}/",
    ]


def post_info(url: str) -> tuple[str, str, str]:
    candidates = instagram_fallback_urls(url) if "instagram.com/" in url else [url]
    last_error = None
    for candidate in candidates:
        try:
            page, final_url = fetch_text(candidate)
            title = meta_value(page, ["og:title", "twitter:title"])
            desc = meta_value(page, ["og:description", "description", "twitter:description"])
            image = meta_value(page, ["og:image", "twitter:image", "twitter:image:src"])
            if image.startswith("//"):
                image = "https:" + image
            if image:
                image = urllib.parse.urljoin(final_url, image)
            text = strip_html(" ".join([title, desc]))
            if text:
                return text, image, url
        except Exception as exc:
            last_error = exc
    print(f"post fetch failed: {url}: {last_error}")
    return "", "", ""


def event_from_post(post_url: str, account: str, platform: str, girls: list[dict]) -> dict | None:
    text, image, canonical_url = post_info(post_url)
    if not text or not contains_event_term(text):
        return None
    matched = girl_matches(text, girls)
    if not matched:
        return None
    event_dt = choose_event_date(text)
    if not event_dt:
        return None
    names = [g["realname"] for g in matched]
    if not image:
        image = next((g["img"] for g in matched if g.get("img")), "")
    short_title = text[:110]
    uid_base = f"{event_dt.date()}|{account}|{normalize_title(short_title)}|{'/'.join(names)}"
    uid = hashlib.sha1(uid_base.encode("utf-8")).hexdigest()[:16]
    return {
        "id": f"auto-event-social-{uid}",
        "date": event_dt.strftime("%Y/%m/%d"),
        "time": extract_time(text),
        "girls": "、".join(names),
        "eventname": short_title,
        "host": f"@{account}" if account else "",
        "address": "詳見官方公告",
        "note": f"自動發現來源：{platform} @{account}\n活動細節請以原始貼文最新公告為準。",
        "img": image,
        "link": canonical_url,
        "source": f"{platform} @{account}",
        "auto": True,
    }


def crawl_source(source: dict, girls: list[dict]) -> list[dict]:
    platform = source["platform"]
    account = source["account"]
    url = source["url"]
    post_urls = []

    if platform == "instagram":
        post_urls.extend(instagram_api_post_urls(account))

    if not post_urls:
        try:
            page, _ = fetch_text(url)
            post_urls.extend(profile_post_urls(platform, account, page))
        except Exception as exc:
            print(f"profile fetch failed: {platform} @{account}: {exc}")

    if not post_urls:
        print(f"no public post URLs exposed: {platform} @{account}")
        return []

    out = []
    seen_urls = set()
    for post_url in post_urls:
        if post_url in seen_urls:
            continue
        seen_urls.add(post_url)
        event = event_from_post(post_url, account, platform, girls)
        if event:
            out.append(event)
    return out


def crawl_explicit_posts(girls: list[dict]) -> list[dict]:
    if not POSTS_FILE.exists():
        return []
    try:
        posts = json.loads(POSTS_FILE.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"explicit post list failed: {exc}")
        return []
    out = []
    for item in posts:
        if isinstance(item, str):
            url, account, platform = item, "", "instagram" if "instagram.com" in item else "threads"
        else:
            url = item.get("url", "")
            account = item.get("account", "")
            platform = item.get("platform", "instagram" if "instagram.com" in url else "threads")
        if not url:
            continue
        event = event_from_post(url, account, platform, girls)
        if event:
            out.append(event)
    print(f"explicit social posts produced {len(out)} events")
    return out


def main() -> None:
    if not SOURCES_FILE.exists():
        print("social source list not found")
        return
    girls = load_girls()
    sources = json.loads(SOURCES_FILE.read_text(encoding="utf-8"))
    current = json.loads(EVENTS_FILE.read_text(encoding="utf-8")) if EVENTS_FILE.exists() else []
    found = crawl_explicit_posts(girls)
    for source in sources:
        found.extend(crawl_source(source, girls))

    merged, seen = [], set()
    for item in current + found:
        key = (item.get("date", ""), normalize_title(item.get("eventname", "")), item.get("girls", ""))
        if key in seen:
            continue
        seen.add(key)
        merged.append(item)
    merged.sort(key=lambda x: (x.get("date", "9999/99/99"), x.get("time", "TBA")))
    EVENTS_FILE.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"social crawler found {len(found)} events; total {len(merged)}")


if __name__ == "__main__":
    main()
