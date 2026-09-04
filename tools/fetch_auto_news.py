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

from googlenewsdecoder import new_decoderv1

SHEET_CSV = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vT9l-hRhzMwcRdyQHsRs_97fja0Gg4RCcDDMk31u-dSbbQmk_JIUmbPTAj2gaNYmb6bYTwUvv4_1IxN/"
    "pub?output=csv&gid=0"
)

QUERIES = [
    "台灣 啦啦隊",
    "中職 啦啦隊",
    "職籃 啦啦隊",
    "韓籍 啦啦隊 台灣",
    "CPBL 中華職棒",
    "中職 棒球",
    "MLB 台灣",
    "大谷翔平 MLB",
    "鄧愷威 MLB",
    "TPBL 台灣職業籃球大聯盟",
    "PLG P. LEAGUE+",
    "台灣 職籃",
    "TVBL 台灣職業排球聯盟",
    "台灣 職業排球",
]

TRUSTED_HINTS = [
    "ETtoday", "NOWnews", "三立", "TVBS", "聯合", "自由時報", "自由體育",
    "中時", "Yahoo", "鏡週刊", "民視", "華視", "緯來", "TSNA", "運動視界",
    "中央社", "壹蘋", "CTWANT", "太報", "udn", "SETN", "公視", "風傳媒",
    "報知", "體育", "FOX", "ESPN", "MLB", "Basketball", "Volleyball"
]

SPORT_RULES = [
    ("MLB", ["MLB", "大聯盟", "道奇", "洋基", "大谷翔平", "鄧愷威", "鈴木誠也", "今永昇太", "菊池雄星"]),
    ("CPBL", ["CPBL", "中華職棒", "中職", "中信兄弟", "統一獅", "樂天桃猿", "味全龍", "富邦悍將", "台鋼雄鷹"]),
    ("TPBL", ["TPBL", "台灣職業籃球大聯盟", "新北國王", "福爾摩沙夢想家", "高雄全家海神", "新竹御嵿攻城獅", "臺北台新戰神", "桃園台啤永豐雲豹", "新北中信特攻"]),
    ("PLG", ["P. LEAGUE+", "P.LEAGUE+", "PLG", "台北富邦勇士", "桃園璞園領航猿"]),
    ("TVBL", ["TVBL", "台灣職業排球聯盟", "職排", "職業排球"]),
]

CHEER_TERMS = [
    "Passion Sisters", "Dragon Beauties", "Rakuten Girls", "Wing Stars",
    "Uni Girls", "Fubon Angels", "樂天女孩", "啦啦隊", "應援團"
]

FALLBACK_IMAGES = {
    "CPBL": "baseball-bg.png",
    "MLB": "baseball-bg.png",
    "TPBL": "basketball-bg.png",
    "PLG": "basketball-bg.png",
    "TVBL": "volleyball-bg.png",
    "啦啦隊": "baseball-bg.png",
    "綜合": "baseball-bg.png",
}

MAX_AGE_DAYS = 14
MAX_ITEMS = 120
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0 Safari/537.36"


def fetch_bytes(url: str, timeout: int = 25) -> tuple[bytes, str, str]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.7",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        content_type = resp.headers.get("Content-Type", "")
        return resp.read(), resp.geturl(), content_type


def fetch_text(url: str) -> str:
    data, _, _ = fetch_bytes(url)
    return data.decode("utf-8", errors="replace")


def load_girl_names() -> list[str]:
    raw = fetch_text(SHEET_CSV)
    rows = csv.DictReader(io.StringIO(raw))
    names: set[str] = set()
    for row in rows:
        for key in ("realname", "nickname", "name", "姓名", "藝名"):
            value = (row.get(key) or "").strip()
            if 2 <= len(value) <= 20 and value not in {"未知", "無", "-"}:
                names.add(value)
    return sorted(names, key=len, reverse=True)


def strip_html(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value or "")
    value = html.unescape(value)
    return re.sub(r"\s+", " ", value).strip()


def parse_pubdate(value: str) -> datetime | None:
    try:
        dt = email.utils.parsedate_to_datetime(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone(timedelta(hours=8)))
    except Exception:
        return None


def normalize_title(title: str) -> str:
    title = re.sub(r"\s+-\s+[^-]{2,40}$", "", title)
    return re.sub(r"[\s\W_]+", "", title).lower()


def clean_title(title: str) -> str:
    return re.sub(r"\s+-\s+[^-]{2,40}$", "", title).strip()


def source_from_item(item: ET.Element) -> str:
    source = item.find("source")
    if source is not None and (source.text or "").strip():
        return (source.text or "").strip()
    title = (item.findtext("title") or "").strip()
    if " - " in title:
        return title.rsplit(" - ", 1)[-1].strip()
    return "新聞來源"


def classify_news(title: str, desc: str, matched_girls: list[str]) -> str | None:
    hay = f"{title} {desc}"
    hay_lower = hay.lower()
    if matched_girls or any(term.lower() in hay_lower for term in CHEER_TERMS):
        return "啦啦隊"
    for category, terms in SPORT_RULES:
        if any(term.lower() in hay_lower for term in terms):
            return category
    return None


def extract_meta(page_html: str, key: str) -> str:
    key_re = re.escape(key)
    patterns = [
        rf'<meta[^>]+(?:property|name)=["\']{key_re}["\'][^>]+content=["\']([^"\']+)',
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']{key_re}["\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, page_html, flags=re.I)
        if match:
            return html.unescape(match.group(1).strip())
    return ""


def extract_meta_image(page_html: str, base_url: str) -> str:
    for key in ("og:image:secure_url", "og:image", "twitter:image:src", "twitter:image"):
        image = extract_meta(page_html, key)
        if image:
            if image.startswith("//"):
                image = "https:" + image
            return urllib.parse.urljoin(base_url, image)
    return ""


def extract_summary(page_html: str) -> str:
    for key in ("og:description", "twitter:description", "description"):
        value = strip_html(extract_meta(page_html, key))
        if len(value) >= 20:
            return value[:320].strip()
    return ""


def is_google_placeholder_image(url: str) -> bool:
    host = urllib.parse.urlparse(url).netloc.lower()
    return host.endswith("googleusercontent.com") or host.endswith("gstatic.com") or "news.google" in host


def resolve_google_news_url(url: str) -> str:
    if "news.google.com" not in url:
        return url
    try:
        decoded = new_decoderv1(url, interval=0.2)
        if isinstance(decoded, dict) and decoded.get("status") and decoded.get("decoded_url"):
            return str(decoded["decoded_url"])
    except Exception as exc:
        print(f"decode failed: {exc}")
    return url


def discover_article_metadata(url: str) -> tuple[str, str, str]:
    """Return final article URL, publisher image and a short publisher-provided description."""
    try:
        data, final_url, content_type = fetch_bytes(url, timeout=15)
        if "html" not in content_type.lower() and b"<html" not in data[:1200].lower():
            return final_url, "", ""
        page = data[:2_000_000].decode("utf-8", errors="replace")
        image = extract_meta_image(page, final_url)
        if image and is_google_placeholder_image(image):
            image = ""
        summary = extract_summary(page)
        return final_url, image, summary
    except Exception as exc:
        print(f"metadata failed: {url}: {exc}")
        return url, "", ""


def rss_image(item: ET.Element) -> str:
    for child in item.iter():
        tag = child.tag.lower()
        if tag.endswith("content") or tag.endswith("thumbnail") or tag.endswith("enclosure"):
            candidate = (child.attrib.get("url") or "").strip()
            if candidate.startswith(("http://", "https://")) and not is_google_placeholder_image(candidate):
                return candidate
    return ""


def fetch_query(query: str) -> list[dict]:
    q = urllib.parse.quote(query)
    url = f"https://news.google.com/rss/search?q={q}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant"
    raw = fetch_text(url)
    root = ET.fromstring(raw)
    result = []
    for item in root.findall("./channel/item"):
        result.append({
            "title": (item.findtext("title") or "").strip(),
            "url": (item.findtext("link") or "").strip(),
            "description": strip_html(item.findtext("description") or ""),
            "pubDate": (item.findtext("pubDate") or "").strip(),
            "source": source_from_item(item),
            "rssImage": rss_image(item),
        })
    return result


def main() -> None:
    girl_names = load_girl_names()
    cutoff = datetime.now(timezone(timedelta(hours=8))) - timedelta(days=MAX_AGE_DAYS)

    pool: list[dict] = []
    for query in QUERIES:
        try:
            for item in fetch_query(query):
                item["query"] = query
                pool.append(item)
        except Exception as exc:
            print(f"query failed: {query}: {exc}")
        time.sleep(0.5)

    seen_title: set[str] = set()
    seen_url: set[str] = set()
    output: list[dict] = []

    for item in pool:
        dt = parse_pubdate(item["pubDate"])
        if not dt or dt < cutoff:
            continue

        hay = f"{item['title']} {item['description']}"
        matched = [n for n in girl_names if n in hay][:6]
        category = classify_news(item["title"], item["description"], matched)
        if not category:
            continue

        norm_title = normalize_title(item["title"])
        if not norm_title or norm_title in seen_title:
            continue

        source = item["source"]
        is_trusted = any(h.lower() in source.lower() for h in TRUSTED_HINTS)
        if not is_trusted and not matched:
            continue

        original_url = resolve_google_news_url(item["url"])
        final_url, publisher_image, publisher_summary = discover_article_metadata(original_url)
        article_url = final_url if "news.google.com" not in final_url else original_url

        if article_url in seen_url:
            continue

        hashtags = matched[:]
        if category not in hashtags:
            hashtags.append(category)

        image_url = publisher_image or item.get("rssImage") or ""
        if not image_url or is_google_placeholder_image(image_url):
            image_url = FALLBACK_IMAGES.get(category, FALLBACK_IMAGES["綜合"])

        summary = publisher_summary or item.get("description") or ""
        summary = strip_html(summary)
        if len(summary) < 20:
            summary = "本則為系統自動彙整之最新相關新聞，請點擊下方「查看原文」閱讀完整報導。"

        uid = hashlib.sha1((article_url or item["title"]).encode("utf-8")).hexdigest()[:16]
        content = f"來源：{source}\n\n新聞摘要：{summary}"

        output.append({
            "id": f"auto-{uid}",
            "date": dt.strftime("%Y/%m/%d %H:%M"),
            "title": clean_title(item["title"]),
            "tag": category,
            "subtag": matched[0] if matched else category,
            "content": content,
            "hashtags": " ".join(hashtags),
            "url": article_url,
            "source": source,
            "auto": True,
            "img": image_url,
        })
        seen_title.add(norm_title)
        seen_url.add(article_url)

        if len(output) >= MAX_ITEMS:
            break

    output.sort(key=lambda x: x["date"], reverse=True)

    out_path = Path("data/auto-news.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(output)} auto news items")


if __name__ == "__main__":
    main()
