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
CPBLGIRLS_EVENTS = "https://www.cpblgirls.tw/linebot/frontend/event_list.php"

QUERIES = [
    "啦啦隊 一日店長", "啦啦隊 一日店員", "啦啦隊 見面會", "啦啦隊 簽名會",
    "啦啦隊 粉絲見面會", "啦啦隊 品牌活動", "啦啦隊 開幕 活動", "啦啦隊 快閃店",
    "啦啦隊 站台", "啦啦隊 商演", "啦啦隊 嘉賓 活動", "啦啦隊 拍照會",
]
EVENT_TERMS = [
    "一日店長", "一日店員", "見面會", "粉絲見面會", "簽名會", "拍照會", "握手會",
    "品牌活動", "品牌大使", "開幕活動", "開幕", "站台", "商演", "快閃店", "快閃活動",
    "新品發表", "記者會", "擔任嘉賓", "活動嘉賓", "出席活動", "公開活動", "路跑", "派對",
]
TRUSTED_HINTS = [
    "ETtoday", "NOWnews", "三立", "TVBS", "聯合", "自由", "中時", "Yahoo", "鏡週刊",
    "民視", "華視", "中央社", "udn", "SETN", "CTWANT", "壹蘋", "太報",
]
MONTHS = {m: i + 1 for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())}
USER_AGENT = "Mozilla/5.0 (compatible; TWCcheerleaderEventBot/1.1)"
TZ = timezone(timedelta(hours=8))
MAX_FUTURE_DAYS = 150
MAX_ITEMS = 100


def fetch_bytes(url: str, timeout: int = 20) -> tuple[bytes, str, str]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.7"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read(), resp.geturl(), resp.headers.get("Content-Type", "")


def fetch_text(url: str) -> str:
    data, _, _ = fetch_bytes(url)
    return data.decode("utf-8", errors="replace")


def strip_html(value: str) -> str:
    value = re.sub(r"<script\b[^>]*>.*?</script>", " ", value or "", flags=re.I | re.S)
    value = re.sub(r"<style\b[^>]*>.*?</style>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def load_girls() -> list[dict]:
    rows = csv.DictReader(io.StringIO(fetch_text(SHEET_CSV)))
    result, seen = [], set()
    for row in rows:
        real = (row.get("realname") or row.get("姓名") or "").strip()
        nick = (row.get("nickname") or row.get("綽號") or row.get("藝名") or "").strip()
        image = (row.get("img") or row.get("image") or row.get("圖片") or "").strip()
        if not real or real.lower() in seen:
            continue
        seen.add(real.lower())
        aliases = [x for x in {real, nick} if x and len(x) >= 2]
        result.append({"realname": real, "nickname": nick, "aliases": aliases, "img": image})
    return result


def girl_matches(text: str, girls: list[dict]) -> list[dict]:
    found = []
    for g in girls:
        if any(alias in text for alias in g["aliases"]):
            found.append(g)
        if len(found) >= 8:
            break
    return found


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
    return [{
        "title": (item.findtext("title") or "").strip(), "url": (item.findtext("link") or "").strip(),
        "description": strip_html(item.findtext("description") or ""), "pubDate": (item.findtext("pubDate") or "").strip(),
        "source": source_from_item(item),
    } for item in root.findall("./channel/item")]


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
    return url


def meta_value(page: str, keys: list[str]) -> str:
    for key in keys:
        for pat in [
            rf'<meta[^>]+(?:property|name)=["\']{re.escape(key)}["\'][^>]+content=["\']([^"\']+)',
            rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']{re.escape(key)}["\']',
        ]:
            m = re.search(pat, page, flags=re.I)
            if m:
                return html.unescape(m.group(1).strip())
    return ""


def get_page_info(url: str) -> tuple[str, str, str]:
    try:
        data, final_url, ctype = fetch_bytes(url, timeout=12)
        if "html" not in ctype.lower() and b"<html" not in data[:1500].lower():
            return "", "", ""
        page = data[:1_800_000].decode("utf-8", errors="replace")
        image = meta_value(page, ["og:image", "twitter:image", "twitter:image:src"])
        desc = strip_html(meta_value(page, ["og:description", "description", "twitter:description"]))
        if image.startswith("//"):
            image = "https:" + image
        if image:
            image = urllib.parse.urljoin(final_url, image)
        visible = strip_html(page)[:12000]
        return image, desc or visible[:900], visible
    except Exception:
        return "", "", ""


def contains_event_term(text: str) -> bool:
    return any(term in text for term in EVENT_TERMS)


def candidate_dates(text: str, base_year: int) -> list[tuple[datetime, int]]:
    candidates = []
    patterns = [
        re.compile(r"(?P<y>20\d{2})[年/.-](?P<m>\d{1,2})[月/.-](?P<d>\d{1,2})日?"),
        re.compile(r"(?<!\d)(?P<m>\d{1,2})月(?P<d>\d{1,2})日"),
        re.compile(r"(?<!\d)(?P<m>\d{1,2})/(?P<d>\d{1,2})(?!\d)"),
    ]
    now = datetime.now(TZ)
    for pat in patterns:
        for m in pat.finditer(text):
            try:
                dt = datetime(int(m.groupdict().get("y") or base_year), int(m.group("m")), int(m.group("d")), tzinfo=TZ)
                if now - timedelta(days=1) <= dt <= now + timedelta(days=MAX_FUTURE_DAYS):
                    candidates.append((dt, m.start()))
            except Exception:
                pass
    return candidates


def choose_event_date(text: str, pub_dt: datetime | None) -> datetime | None:
    cands = candidate_dates(text, (pub_dt or datetime.now(TZ)).year)
    scored = []
    for dt, pos in cands:
        ctx = text[max(0, pos - 90):pos + 110]
        score = 2 if contains_event_term(ctx) else 0
        if pub_dt and dt.date() == pub_dt.date():
            score -= 1
        scored.append((score, dt))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return scored[0][1] if scored and scored[0][0] >= 1 else None


def extract_time(text: str) -> str:
    m = re.search(r"(?<!\d)(\d{1,2}[:：]\d{2})(?!\d)", text)
    return m.group(1).replace("：", ":") if m else "TBA"


def normalize_title(title: str) -> str:
    return re.sub(r"[\s\W_]+", "", clean_title(title)).lower()


def direct_public_events(girls: list[dict]) -> list[dict]:
    """Read a public cheerleader-event listing as a second discovery source."""
    try:
        visible = strip_html(fetch_text(CPBLGIRLS_EVENTS))
    except Exception as exc:
        print(f"public event source failed: {exc}")
        return []

    month_names = "|".join(MONTHS)
    pattern = re.compile(
        rf"(?P<day>\d{{1,2}})\s+(?P<mon>{month_names})\s+"
        rf"(?P<girl>[^\s]{{2,30}})\s+(?P<title>.+?)\s+"
        rf"(?P<time>\d{{1,2}}:\d{{2}})\s+(?P<venue>.+?)"
        rf"(?=(?:\s+Hot\b|\s+CPBL\b|\s+TPBL\b|\s+PLG\b|\s+TPVL\b|\s+\d{{1,2}}\s+(?:{month_names})\s+|$))",
        flags=re.I,
    )
    now = datetime.now(TZ)
    out = []
    for m in pattern.finditer(visible):
        raw_girl = m.group("girl").strip()
        title = re.sub(r"\s*官方IG\s*資訊來源\s*", " ", m.group("title")).strip()
        venue = m.group("venue").strip()
        if "測試" in raw_girl or "測試" in title or "測試" in venue:
            continue
        matched = girl_matches(f"{raw_girl} {title}", girls)
        if not matched:
            continue
        try:
            dt = datetime(now.year, MONTHS[m.group("mon").title()], int(m.group("day")), tzinfo=TZ)
        except Exception:
            continue
        if not (now - timedelta(days=1) <= dt <= now + timedelta(days=MAX_FUTURE_DAYS)):
            continue
        names = [g["realname"] for g in matched]
        image = next((g["img"] for g in matched if g.get("img")), "")
        dedup = f"{dt.date()}|{normalize_title(title)}|{'/'.join(names)}"
        uid = hashlib.sha1((dedup + CPBLGIRLS_EVENTS).encode("utf-8")).hexdigest()[:16]
        out.append({
            "id": f"auto-event-{uid}", "date": dt.strftime("%Y/%m/%d"), "time": m.group("time"),
            "girls": "、".join(names), "eventname": title, "host": "", "address": venue,
            "note": "公開活動資料自動彙整；活動細節請以原始來源／主辦單位最新公告為準。",
            "img": image, "link": CPBLGIRLS_EVENTS, "source": "中職真香活動平台", "auto": True,
        })
    return out


def main() -> None:
    girls = load_girls()
    pool = []
    for query in QUERIES:
        try:
            pool.extend(fetch_query(query))
        except Exception as exc:
            print(f"query failed: {query}: {exc}")
        time.sleep(0.5)

    output = direct_public_events(girls)
    seen = {f"{e['date']}|{normalize_title(e['eventname'])}|{e['girls']}" for e in output}

    for item in pool:
        pub_dt = parse_pubdate(item["pubDate"])
        raw_text = f"{clean_title(item['title'])} {item['description']}"
        if not contains_event_term(raw_text):
            continue
        matched_objs = girl_matches(raw_text, girls)
        if not matched_objs:
            continue
        source = item["source"]
        if not any(h.lower() in source.lower() for h in TRUSTED_HINTS) and not contains_event_term(clean_title(item["title"])):
            continue
        original_url = decode_google_news_url(item["url"])
        image, page_desc, page_text = get_page_info(original_url)
        combined = " ".join(x for x in [raw_text, page_desc, page_text[:6000]] if x)
        matched_objs = girl_matches(combined, girls) or matched_objs
        event_dt = choose_event_date(combined, pub_dt)
        if not event_dt:
            continue
        names = [g["realname"] for g in matched_objs]
        title = clean_title(item["title"])
        key = f"{event_dt.strftime('%Y/%m/%d')}|{normalize_title(title)}|{'、'.join(names)}"
        if key in seen:
            continue
        seen.add(key)
        if not image:
            image = next((g["img"] for g in matched_objs if g.get("img")), "")
        uid = hashlib.sha1((key + original_url).encode("utf-8")).hexdigest()[:16]
        note = page_desc[:260] if page_desc else "活動細節請以主辦單位官方頁面公告為準。"
        output.append({
            "id": f"auto-event-{uid}", "date": event_dt.strftime("%Y/%m/%d"), "time": extract_time(combined),
            "girls": "、".join(names), "eventname": title, "host": "", "address": "詳見官方公告",
            "note": f"自動發現來源：{source}\n{note}", "img": image, "link": original_url,
            "source": source, "auto": True,
        })
        if len(output) >= MAX_ITEMS:
            break

    # Final de-dupe by date + girls + similar title, keeping the richer record first.
    final, fingerprints = [], set()
    for event in sorted(output, key=lambda e: (e["date"], e.get("time", ""))):
        fp = (event["date"], event["girls"], normalize_title(event["eventname"])[:40])
        if fp in fingerprints:
            continue
        fingerprints.add(fp)
        final.append(event)

    out_path = Path("data/auto-events.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(final, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(final)} auto events")


if __name__ == "__main__":
    main()
