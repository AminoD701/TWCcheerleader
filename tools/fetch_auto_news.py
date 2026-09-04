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
    "台灣 啦啦隊",
    "中職 啦啦隊",
    "職籃 啦啦隊",
    "排球 啦啦隊 台灣",
    "韓籍 啦啦隊 台灣",
]

TRUSTED_HINTS = [
    "ETtoday", "NOWnews", "三立", "TVBS", "聯合", "自由時報", "自由體育",
    "中時", "Yahoo", "鏡週刊", "民視", "華視", "緯來", "TSNA", "運動視界",
    "中央社", "壹蘋", "CTWANT", "太報", "udn", "SETN"
]

TEAM_TERMS = [
    "Passion Sisters", "Dragon Beauties", "Rakuten Girls", "Wing Stars",
    "Uni Girls", "Fubon Angels", "樂天女孩", "富邦悍將", "味全龍",
    "中信兄弟", "統一獅", "台鋼雄鷹", "啦啦隊"
]

MAX_AGE_DAYS = 14
MAX_ITEMS = 80
USER_AGENT = "Mozilla/5.0 (compatible; TWCcheerleaderNewsBot/1.0)"


def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=25) as resp:
        return resp.read().decode("utf-8", errors="replace")


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


def source_from_item(item: ET.Element) -> str:
    source = item.find("source")
    if source is not None and (source.text or "").strip():
        return (source.text or "").strip()
    title = (item.findtext("title") or "").strip()
    if " - " in title:
        return title.rsplit(" - ", 1)[-1].strip()
    return "新聞來源"


def is_relevant(title: str, desc: str, girl_names: list[str]) -> tuple[bool, list[str]]:
    hay = f"{title} {desc}"
    matched = [n for n in girl_names if n in hay]
    has_team_term = any(term.lower() in hay.lower() for term in TEAM_TERMS)
    has_cheer = "啦啦隊" in hay or "cheer" in hay.lower()
    return bool(matched or (has_team_term and has_cheer)), matched[:6]


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
        })
    return result


def main() -> None:
    girl_names = load_girl_names()
    cutoff = datetime.now(timezone(timedelta(hours=8))) - timedelta(days=MAX_AGE_DAYS)

    pool: list[dict] = []
    for query in QUERIES:
        try:
            pool.extend(fetch_query(query))
        except Exception as exc:
            print(f"query failed: {query}: {exc}")
        time.sleep(1)

    seen_title: set[str] = set()
    seen_url: set[str] = set()
    output: list[dict] = []

    for item in pool:
        dt = parse_pubdate(item["pubDate"])
        if not dt or dt < cutoff:
            continue

        relevant, matched = is_relevant(item["title"], item["description"], girl_names)
        if not relevant:
            continue

        norm_title = normalize_title(item["title"])
        if not norm_title or norm_title in seen_title or item["url"] in seen_url:
            continue

        source = item["source"]
        # Keep broad coverage, but deprioritize unknown aggregators by requiring a matched girl.
        if not any(h.lower() in source.lower() for h in TRUSTED_HINTS) and not matched:
            continue

        hashtags = matched[:]
        if "啦啦隊" not in hashtags:
            hashtags.append("啦啦隊")

        uid = hashlib.sha1((item["url"] or item["title"]).encode("utf-8")).hexdigest()[:16]
        content = f"來源：{source}\n系統自動彙整相關新聞，請點擊「查看原文」閱讀完整報導。"

        output.append({
            "id": f"auto-{uid}",
            "date": dt.strftime("%Y/%m/%d %H:%M"),
            "title": re.sub(r"\s+-\s+[^-]{2,40}$", "", item["title"]).strip(),
            "tag": "自動新聞",
            "subtag": matched[0] if matched else "綜合",
            "content": content,
            "hashtags": " ".join(hashtags),
            "url": item["url"],
            "source": source,
            "auto": True,
            "img": "",
        })
        seen_title.add(norm_title)
        seen_url.add(item["url"])

    output.sort(key=lambda x: x["date"], reverse=True)
    output = output[:MAX_ITEMS]

    out_path = Path("data/auto-news.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(output)} auto news items")


if __name__ == "__main__":
    main()
