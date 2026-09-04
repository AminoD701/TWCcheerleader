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

# Keep the site focused on the sports ecosystem around the cheerleading database,
# but no longer limit automatic news to cheerleaders only.
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

# Guaranteed visual fallback. Real article images are preferred; these are only used
# when the source does not expose an image that can be reused directly.
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
USER_AGENT = "Mozilla/5.0 (compatible; TWCcheerleaderNewsBot/1.1)"


def fetch_bytes(url: str, timeout: int = 25) -> tuple[bytes, str, str]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.7",
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

    # Cheerleader stories remain their own category even when a team name appears.
    if matched_girls or any(term.lower() in hay_lower for term in CHEER_TERMS):
        return "啦啦隊"

    for category, terms in SPORT_RULES:
        if any(term.lower() in hay_lower for term in terms):
            return category
    return None


def extract_meta_image(page_html: str, base_url: str) -> str:
    patterns = [
        r'<meta[^>]+(?:property|name)=["\']og:image(?::secure_url)?["\'][^>]+content=["\']([^"\']+)',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']og:image(?::secure_url)?["\']',
        r'<meta[^>]+(?:property|name)=["\']twitter:image(?::src)?["\'][^>]+content=["\']([^"\']+)',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']twitter:image(?::src)?["\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, page_html, flags=re.I)
        if match:
            image = html.unescape(match.group(1).strip())
            if image.startswith("//"):
                image = "https:" + image
            return urllib.parse.urljoin(base_url, image)
    return ""


def discover_article_image(url: str) -> str:
    """Best-effort OG/Twitter image lookup. Failure is expected for some publishers."""
    try:
        data, final_url, content_type = fetch_bytes(url, timeout=12)
        if "html" not in content_type.lower() and b"<html" not in data[:1000].lower():
            return ""
        page = data[:1_500_000].decode("utf-8", errors="replace")
        image = extract_meta_image(page, final_url)
        if image and image.startswith(("http://", "https://")):
            return image
    except Exception:
        pass
    return ""


def rss_image(item: ET.Element) -> str:
    # Some RSS providers expose media:content / media:thumbnail even though Google News
    # often does not. Namespace-agnostic matching keeps this future-proof.
    for child in item.iter():
        tag = child.tag.lower()
        if tag.endswith("content") or tag.endswith("thumbnail") or tag.endswith("enclosure"):
            candidate = (child.attrib.get("url") or "").strip()
            if candidate.startswith(("http://", "https://")):
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
        time.sleep(0.7)

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
        if not norm_title or norm_title in seen_title or item["url"] in seen_url:
            continue

        source = item["source"]
        is_trusted = any(h.lower() in source.lower() for h in TRUSTED_HINTS)
        # Cheerleader stories with a known girl can pass even from a smaller outlet;
        # broad sports news requires a recognized source to avoid low-quality scraping.
        if not is_trusted and not matched:
            continue

        hashtags = matched[:]
        if category not in hashtags:
            hashtags.append(category)

        image_url = item.get("rssImage") or ""
        if not image_url:
            image_url = discover_article_image(item["url"])
        if not image_url:
            image_url = FALLBACK_IMAGES.get(category, FALLBACK_IMAGES["綜合"])

        uid = hashlib.sha1((item["url"] or item["title"]).encode("utf-8")).hexdigest()[:16]
        content = f"來源：{source}\n系統自動彙整相關新聞，請點擊「查看原文」閱讀完整報導。"

        output.append({
            "id": f"auto-{uid}",
            "date": dt.strftime("%Y/%m/%d %H:%M"),
            "title": clean_title(item["title"]),
            "tag": category,
            "subtag": matched[0] if matched else category,
            "content": content,
            "hashtags": " ".join(hashtags),
            "url": item["url"],
            "source": source,
            "auto": True,
            "img": image_url,
        })
        seen_title.add(norm_title)
        seen_url.add(item["url"])

        if len(output) >= MAX_ITEMS:
            break

    output.sort(key=lambda x: x["date"], reverse=True)

    out_path = Path("data/auto-news.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(output)} auto news items")


if __name__ == "__main__":
    main()
