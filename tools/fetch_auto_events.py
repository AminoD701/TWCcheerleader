from __future__ import annotations

import csv
import email.utils
import hashlib
import html
import io
import json
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

SHEET_CSV = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vT9l-hRhzMwcRdyQHsRs_97fja0Gg4RCcDDMk31u-dSbbQmk_JIUmbPTAj2gaNYmb6bYTwUvv4_1IxN/"
    "pub?output=csv&gid=0"
)

QUERIES = [
    "啦啦隊 一日店長",
    "啦啦隊 一日店員",
    "啦啦隊 見面會",
    "啦啦隊 簽名會",
    "啦啦隊 粉絲見面會",
    "啦啦隊 品牌活動",
    "啦啦隊 開幕 活動",
    "啦啦隊 快閃店",
    "啦啦隊 站台",
    "啦啦隊 商演",
    "啦啦隊 嘉賓 活動",
    "啦啦隊 拍照會",
]

EVENT_TERMS = [
    "一日店長", "一日店員", "見面會", "粉絲見面會", "簽名會", "拍照會", "握手會",
    "品牌活動", "品牌大使", "開幕活動", "開幕", "站台", "商演", "快閃店", "快閃活動",
    "新品發表", "記者會", "擔任嘉賓", "活動嘉賓", "出席活動", "公開活動",
]

TRUSTED_HINTS = [
    "ETtoday", "NOWnews", "三立", "TVBS", "聯合", "自由", "中時", "Yahoo",
    "鏡週刊", "民視", "華視", "中央社", "udn", "SETN", "CTWANT", "壹蘋", "太報",
]

USER_AGENT = "Mozilla/5.0 (compatible; TWCcheerleaderEventBot/1.0)"
TZ = timezone(timedelta(hours=8))
MAX_FUTURE_DAYS = 150
MAX_ITEMS = 80


def fetch_bytes(url: str, timeout: int = 20) -> tuple[bytes, str, str]:
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.7",
    })
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read(), resp.geturl(), resp.headers.get("Content-Type", "")


def fetch_text(url: str) -> str:
    data, _, _ = fetch_bytes(url)
    return data.decode("utf-8", errors="replace")


def strip_html(value: str) -> str:
    value = re.sub(r"<script\b[^>]*>.*?</script>", " ", value or "", flags=re.I | re.S)
    value = re.sub(r"<style\b[^>]*>.*?</style>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value)
    return re.sub(r"\s+", " ", value).strip()


def load_girls() -> list[dict]:
    rows = csv.DictReader(io.StringIO(fetch_text(SHEET_CSV)))
    result = []
    seen = set()
    for row in rows:
        real = (row.get("realname") or row.get("姓名") or "").strip()
        nick = (row.get("nickname") or row.get("綽號") or row.get("藝名") or "").strip()
        if not real:
            continue
        key = real.lower()
        if key in seen:
            continue
        seen.add(key)
        aliases = [x for x in {real, nick} if x and len(x) >= 2]
        result.append({"realname": real, "aliases": aliases})
    return result


def parse_pubdate(value: str) -> datetime | None:
    try:
        dt = email.utils.parsedate_to_datetime(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(TZ)
    except Exception:
        return None


def source_from_item(item: ET.Element) -> str:
    src = item.find("source")
    if src is not None and (src.text or "").strip():
        return (src.text or "").strip()
    title = (item.findtext("title") or "").strip()
    return title.rsplit(" - ", 1)[-1].strip() if " - " in title else "公開來源"


def clean_title(title: str) -> str:
    return re.sub(r"\s+-\s+[^-]{2,50}$", "", title or "").strip()


def fetch_query(query: str) -> list[dict]:
    q = urllib.parse.quote(query)
    url = f"https://news.google.com/rss/search?q={q}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant"
    root = ET.fromstring(fetch_text(url))
    out = []
    for item in root.findall("./channel/item"):
        out.append({
            "title": (item.findtext("title") or "").strip(),
            "url": (item.findtext("link") or "").strip(),
            "description": strip_html(item.findtext("description") or ""),
            "pubDate": (item.findtext("pubDate") or "").strip(),
            "source": source_from_item(item),
        })
    return out


def decode_google_news_url(url: str) -> str:
    if "news.google.com" not in url:
        return url
    try:
        from googlenewsdecoder import gnewsdecoder
        decoded = gnewsdecoder(url)
        if isinstance(decoded, dict) and decoded.get("status") and decoded.get("decoded_url"):
            return decoded["decoded_url"]
    except Exception:
        pass
    try:
        _, final_url, _ = fetch_bytes(url, timeout=10)
        if "news.google.com" not in final_url:
            return final_url
    except Exception:
        pass
    return url


def extract_meta(page_html: str, base_url: str) -> tuple[str, str, str]:
    def meta_value(keys: list[str]) -> str:
        for key in keys:
            patterns = [
                rf'<meta[^>]+(?:property|name)=["\']{re.escape(key)}["\'][^>]+content=["\']([^"\']+)',
                rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']{re.escape(key)}["\']',
            ]
            for p in patterns:
                m = re.search(p, page_html, flags=re.I)
                if m:
                    return html.unescape(m.group(1).strip())
        return ""

    image = meta_value(["og:image", "twitter:image", "twitter:image:src"])
    desc = meta_value(["og:description", "description", "twitter:description"])
    title = meta_value(["og:title", "twitter:title"])
    if image.startswith("//"):
        image = "https:" + image
    if image:
        image = urllib.parse.urljoin(base_url, image)
    return image, strip_html(desc), strip_html(title)


def get_page_info(url: str) -> tuple[str, str, str]:
    try:
        data, final_url, content_type = fetch_bytes(url, timeout=12)
        if "html" not in content_type.lower() and b"<html" not in data[:1500].lower():
            return "", "", ""
        page = data[:1_800_000].decode("utf-8", errors="replace")
        image, desc, title = extract_meta(page, final_url)
        visible = strip_html(page)[:12000]
        return image, desc or visible[:900], visible
    except Exception:
        return "", "", ""


def match_girls(text: str, girls: list[dict]) -> list[str]:
    found = []
    for g in girls:
        if any(alias in text for alias in g["aliases"]):
            found.append(g["realname"])
        if len(found) >= 8:
            break
    return found


def contains_event_term(text: str) -> bool:
    return any(term in text for term in EVENT_TERMS)


def candidate_dates(text: str, base_year: int) -> list[tuple[datetime, int]]:
    candidates: list[tuple[datetime, int]] = []
    patterns = [
        re.compile(r"(?P<y>20\d{2})[年/.-](?P<m>\d{1,2})[月/.-](?P<d>\d{1,2})日?"),
        re.compile(r"(?<!\d)(?P<m>\d{1,2})月(?P<d>\d{1,2})日"),
        re.compile(r"(?<!\d)(?P<m>\d{1,2})/(?P<d>\d{1,2})(?!\d)"),
    ]
    now = datetime.now(TZ)
    for p in patterns:
        for m in p.finditer(text):
            try:
                year = int(m.groupdict().get("y") or base_year)
                month = int(m.group("m")); day = int(m.group("d"))
                dt = datetime(year, month, day, tzinfo=TZ)
                if dt < now - timedelta(days=1) and "y" not in m.groupdict():
                    dt = datetime(year + 1, month, day, tzinfo=TZ)
                if now - timedelta(days=1) <= dt <= now + timedelta(days=MAX_FUTURE_DAYS):
                    candidates.append((dt, m.start()))
            except Exception:
                continue
    return candidates


def choose_event_date(text: str, pub_dt: datetime | None) -> datetime | None:
    base_year = (pub_dt or datetime.now(TZ)).year
    cands = candidate_dates(text, base_year)
    if not cands:
        return None
    scored = []
    for dt, pos in cands:
        ctx = text[max(0, pos - 80):pos + 100]
        score = 2 if contains_event_term(ctx) else 0
        if pub_dt and dt.date() == pub_dt.date():
            score -= 1
        scored.append((score, dt))
    scored.sort(key=lambda x: (-x[0], x[1]))
    best_score, best = scored[0]
    return best if best_score >= 1 else None


def extract_time(text: str) -> str:
    for p in [r"(?:時間|於|下午|上午|晚上|中午)?\s*(\d{1,2}[:：]\d{2})", r"(?:下午|上午|晚上|中午)\s*(\d{1,2})\s*點"]:
        m = re.search(p, text)
        if m:
            return m.group(1).replace("：", ":") + (":00" if ":" not in m.group(1) else "")
    return "TBA"


def normalize_title(title: str) -> str:
    return re.sub(r"[\s\W_]+", "", clean_title(title)).lower()


def main() -> None:
    girls = load_girls()
    pool: list[dict] = []
    for query in QUERIES:
        try:
            pool.extend(fetch_query(query))
        except Exception as exc:
            print(f"query failed: {query}: {exc}")
        time.sleep(0.6)

    seen = set()
    output = []
    for item in pool:
        pub_dt = parse_pubdate(item["pubDate"])
        raw_text = f"{clean_title(item['title'])} {item['description']}"
        if not contains_event_term(raw_text):
            continue

        matched = match_girls(raw_text, girls)
        if not matched:
            continue

        source = item["source"]
        if not any(h.lower() in source.lower() for h in TRUSTED_HINTS):
            # Smaller sources may still pass if the title itself clearly names the girl and event.
            if not contains_event_term(clean_title(item["title"])):
                continue

        original_url = decode_google_news_url(item["url"])
        image, page_desc, page_text = get_page_info(original_url)
        combined = " ".join(x for x in [raw_text, page_desc, page_text[:6000]] if x)
        matched = match_girls(combined, girls) or matched
        event_dt = choose_event_date(combined, pub_dt)
        if not event_dt:
            continue

        norm = normalize_title(item["title"])
        dedup = f"{event_dt.date()}|{norm}|{'/'.join(matched)}"
        if dedup in seen:
            continue
        seen.add(dedup)

        note_parts = [f"自動發現來源：{source}"]
        if page_desc:
            note_parts.append(page_desc[:240])
        else:
            note_parts.append("活動細節請以主辦單位官方頁面公告為準。")

        uid = hashlib.sha1((dedup + original_url).encode("utf-8")).hexdigest()[:16]
        output.append({
            "id": f"auto-event-{uid}",
            "date": event_dt.strftime("%Y/%m/%d"),
            "time": extract_time(combined),
            "girls": "、".join(matched),
            "eventname": clean_title(item["title"]),
            "host": "",
            "address": "詳見官方公告",
            "note": "\n".join(note_parts),
            "img": image,
            "link": original_url,
            "source": source,
            "auto": True,
        })
        if len(output) >= MAX_ITEMS:
            break

    output.sort(key=lambda x: (x["date"], x["time"]))
    out_path = Path("data/auto-events.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(output)} auto events")


if __name__ == "__main__":
    main()
