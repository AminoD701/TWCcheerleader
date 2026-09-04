from __future__ import annotations

import csv
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
POSTS_FILE = Path("data/event-social-posts.json")
EVENTS_FILE = Path("data/auto-events.json")
TZ = timezone(timedelta(hours=8))
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36"
EVENT_TERMS = [
    "一日店長", "一日店員", "見面會", "粉絲見面會", "簽名會", "拍照會", "握手會",
    "品牌活動", "品牌大使", "開幕活動", "開幕", "站台", "商演", "快閃店", "快閃活動",
    "新品發表", "記者會", "擔任嘉賓", "活動嘉賓", "出席活動", "公開活動", "路跑", "派對",
]


def fetch_text(url: str, timeout: int = 20) -> tuple[str, str]:
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.7",
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    })
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read(3_000_000)
        return data.decode("utf-8", errors="replace"), resp.geturl()


def strip_html(value: str) -> str:
    value = re.sub(r"<script\b[^>]*>.*?</script>", " ", value or "", flags=re.I | re.S)
    value = re.sub(r"<style\b[^>]*>.*?</style>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def meta_value(page: str, keys: list[str]) -> str:
    for key in keys:
        pats = [
            rf'<meta[^>]+(?:property|name)=["\']{re.escape(key)}["\'][^>]+content=["\']([^"\']+)',
            rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']{re.escape(key)}["\']',
        ]
        for pat in pats:
            m = re.search(pat, page, flags=re.I)
            if m:
                return html.unescape(m.group(1).strip())
    return ""


def load_girls() -> list[dict]:
    raw, _ = fetch_text(SHEET_CSV)
    out = []
    seen = set()
    for row in csv.DictReader(io.StringIO(raw)):
        real = (row.get("realname") or row.get("姓名") or "").strip()
        nick = (row.get("nickname") or row.get("綽號") or row.get("藝名") or "").strip()
        image = (row.get("img") or row.get("image") or row.get("圖片") or "").strip()
        if not real or real.lower() in seen:
            continue
        seen.add(real.lower())
        aliases = [x for x in {real, nick} if x and len(x) >= 2]
        out.append({"realname": real, "aliases": aliases, "img": image})
    return out


def find_girls(text: str, girls: list[dict]) -> list[dict]:
    out = []
    for girl in girls:
        if any(alias in text for alias in girl["aliases"]):
            out.append(girl)
    return out[:8]


def choose_date(text: str) -> datetime | None:
    now = datetime.now(TZ)
    patterns = [
        re.compile(r"(?P<y>20\d{2})[年/.-](?P<m>\d{1,2})[月/.-](?P<d>\d{1,2})日?"),
        re.compile(r"(?<!\d)(?P<m>\d{1,2})月(?P<d>\d{1,2})日"),
        re.compile(r"(?<!\d)(?P<m>\d{1,2})/(?P<d>\d{1,2})(?!\d)"),
    ]
    found = []
    for pat in patterns:
        for m in pat.finditer(text):
            try:
                year = int(m.groupdict().get("y") or now.year)
                dt = datetime(year, int(m.group("m")), int(m.group("d")), tzinfo=TZ)
                if dt < now - timedelta(days=1) and not m.groupdict().get("y"):
                    dt = datetime(year + 1, dt.month, dt.day, tzinfo=TZ)
                if now - timedelta(days=1) <= dt <= now + timedelta(days=180):
                    found.append(dt)
            except Exception:
                pass
    return min(found) if found else None


def extract_time(text: str) -> str:
    m = re.search(r"(?<!\d)(\d{1,2}[:：]\d{2})(?!\d)", text)
    if m:
        return m.group(1).replace("：", ":")
    m = re.search(r"(?:上午|下午|晚上|中午)\s*(\d{1,2})\s*點", text)
    return f"{int(m.group(1)):02d}:00" if m else "TBA"


def derive_title(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    for term in EVENT_TERMS:
        pos = text.find(term)
        if pos >= 0:
            start = max(0, pos - 45)
            end = min(len(text), pos + 65)
            return text[start:end].strip(" -｜|，,。")
    return text[:110]


def threads_post_info(url: str) -> tuple[str, str, str]:
    candidates = [url]
    if "threads.net" in url:
        candidates.append(url.replace("threads.net", "threads.com"))
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
            visible = strip_html(page)
            text = strip_html(" ".join([title, desc, visible[:14000]]))
            if text:
                return text, image, final_url
        except Exception as exc:
            last_error = exc
    print(f"threads post failed: {url}: {last_error}")
    return "", "", url


def main() -> None:
    if not POSTS_FILE.exists():
        return
    posts = json.loads(POSTS_FILE.read_text(encoding="utf-8"))
    girls = load_girls()
    current = json.loads(EVENTS_FILE.read_text(encoding="utf-8")) if EVENTS_FILE.exists() else []
    found = []

    for item in posts:
        if isinstance(item, str):
            url = item
            platform = "threads" if "threads." in url else ""
        else:
            url = item.get("url", "")
            platform = item.get("platform", "")
        if platform != "threads" or not url:
            continue

        text, image, canonical = threads_post_info(url)
        if not text or not any(term in text for term in EVENT_TERMS):
            print(f"threads item has no event terms: {url}")
            continue
        matched = find_girls(text, girls)
        if not matched:
            print(f"threads item has no known girl: {url}")
            continue
        event_dt = choose_date(text)
        if not event_dt:
            print(f"threads item has no future event date: {url}")
            continue
        if not image:
            image = next((g["img"] for g in matched if g.get("img")), "")
        names = "、".join(g["realname"] for g in matched)
        found.append({
            "id": "auto-event-threads-" + re.sub(r"[^A-Za-z0-9]", "", url)[-18:],
            "date": event_dt.strftime("%Y/%m/%d"),
            "time": extract_time(text),
            "girls": names,
            "eventname": derive_title(text),
            "host": "Threads",
            "address": "詳見官方公告",
            "note": "自動發現來源：Threads\n活動細節請以原始貼文最新公告為準。",
            "img": image,
            "link": canonical,
            "source": "Threads",
            "auto": True,
        })

    EVENTS_FILE.write_text(json.dumps(current + found, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"threads explicit crawler found {len(found)} events")


if __name__ == "__main__":
    main()
