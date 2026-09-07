from __future__ import annotations

import csv
import difflib
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
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

from googlenewsdecoder import new_decoderv1

SHEET_CSV = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vT9l-hRhzMwcRdyQHsRs_97fja0Gg4RCcDDMk31u-dSbbQmk_JIUmbPTAj2gaNYmb6bYTwUvv4_1IxN/"
    "pub?output=csv&gid=0"
)

# Automatic intel is intentionally source-focused. These queries target the
# entertainment/sports desks the site owner actually wants instead of the whole
# Google News sports firehose.
BASE_QUERIES = [
    "site:setn.com 啦啦隊",
    "site:setn.com 娛樂 啦啦隊",
    "site:setn.com 體育 啦啦隊",
    "site:ctwant.com 啦啦隊",
    "site:ctwant.com 娛樂 啦啦隊",
    "site:ctwant.com 體育 啦啦隊",
    "site:setn.com 中職 CPBL",
    "site:setn.com MLB 大聯盟",
    "site:setn.com TPBL OR PLG OR 職籃",
    "site:setn.com TVBL OR 職排",
    "site:ctwant.com 中職 CPBL",
    "site:ctwant.com MLB 大聯盟",
    "site:ctwant.com TPBL OR PLG OR 職籃",
    "site:ctwant.com TVBL OR 職排",
    "site:today.line.me 中職 CPBL",
]

# Only these publishers are accepted into the automatic feed.
PREFERRED_SOURCE_HINTS = [
    "三立", "SETN", "三立新聞網", "娛樂星聞",
    "CTWANT", "周刊王",
    "LINE TODAY", "LINE TODAY台灣", "LINE Today",
]

PREFERRED_HOSTS = (
    "setn.com",
    "ctwant.com",
    "today.line.me",
)

SPORT_RULES = [
    ("棒球情報", "MLB", ["MLB", "大聯盟", "道奇", "洋基", "大谷翔平", "鄧愷威", "鈴木誠也", "今永昇太", "菊池雄星"]),
    ("棒球情報", "中職", ["CPBL", "中華職棒", "中職", "中信兄弟", "統一獅", "樂天桃猿", "味全龍", "富邦悍將", "台鋼雄鷹"]),
    ("籃球情報", "TPBL", ["TPBL", "台灣職業籃球大聯盟", "新北國王", "福爾摩沙夢想家", "高雄全家海神", "新竹御嵿攻城獅", "臺北台新戰神", "桃園台啤永豐雲豹", "新北中信特攻"]),
    ("籃球情報", "PLG", ["P. LEAGUE+", "P.LEAGUE+", "PLG", "台北富邦勇士", "桃園璞園領航猿"]),
    ("排球情報", "TVBL", ["TVBL", "TPVL", "台灣職業排球聯盟", "職排", "職業排球"]),
]

CHEER_TERMS = [
    "Passion Sisters", "Dragon Beauties", "Rakuten Girls", "Wing Stars",
    "Uni Girls", "Fubon Angels", "樂天女孩", "小龍女", "PS女孩",
    "啦啦隊", "應援團", "應援女孩", "啦啦隊女神", "啦啦隊女孩"
]

IMPORTANT_SPORT_TERMS = [
    "冠軍", "總冠軍", "季後賽", "封王", "淘汰", "晉級", "交易", "簽約", "加盟",
    "傷退", "受傷", "復出", "紀錄", "破紀錄", "MVP", "國家隊", "亞運", "經典賽",
    "明星賽", "全壘打", "完封", "無安打", "再見", "延長", "大谷翔平", "鄧愷威",
]

FALLBACK_IMAGES = {
    "棒球情報": "baseball-bg.png",
    "籃球情報": "basketball-bg.png",
    "排球情報": "volleyball-bg.png",
    "啦啦隊情報": "baseball-bg.png",
    "綜合情報": "baseball-bg.png",
}

MAX_AGE_DAYS = 10
CHEER_ITEM_LIMIT = 36
CHEER_GENERIC_LIMIT = 8
# Sports are intentionally a small side stream. CPBL gets a little more room
# because LINE TODAY is specifically included as a CPBL source.
SPORT_ITEM_LIMITS = {"MLB": 2, "中職": 4, "TPBL": 2, "PLG": 2, "TVBL": 1}
SPORT_TOTAL_LIMIT = 7
SPORT_SOURCE_LIMIT = 2
NAME_QUERY_BATCH_SIZE = 8
MAX_NAME_QUERY_BATCHES = 24
TEAM_QUERY_BATCH_SIZE = 6
MAX_TEAM_QUERY_BATCHES = 8
NEAR_DUPLICATE_RATIO = 0.76
RELATED_DUPLICATE_RATIO = 0.66
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


def load_site_entities() -> tuple[list[str], list[str]]:
    raw = fetch_text(SHEET_CSV)
    rows = csv.DictReader(io.StringIO(raw))
    names: set[str] = set()
    teams: set[str] = set()
    for row in rows:
        for key in ("realname", "nickname", "name", "姓名", "藝名"):
            value = (row.get(key) or "").strip()
            if 2 <= len(value) <= 20 and value not in {"未知", "無", "-"}:
                names.add(value)
        for key in ("team", "球隊", "隊伍"):
            value = (row.get(key) or "").strip()
            if 2 <= len(value) <= 40 and value not in {"未知", "無", "-", "全部啦啦隊"}:
                teams.add(value)
    return sorted(names, key=len, reverse=True), sorted(teams, key=len, reverse=True)


AMBIGUOUS_LATIN_NAMES = {
    "ai", "et", "iu", "tv", "mvp", "mlb", "cpbl", "plg", "tpbl", "tvbl", "nba", "kbo",
}


def is_cjk_name(value: str) -> bool:
    return bool(re.search(r"[\u3400-\u9fff]", value))


def usable_girl_name(value: str) -> bool:
    name = (value or "").strip()
    if not name:
        return False
    if is_cjk_name(name):
        return len(name) >= 2
    compact = re.sub(r"[^a-z0-9]", "", name.lower())
    return len(compact) >= 3 and compact not in AMBIGUOUS_LATIN_NAMES


def girl_name_matches(name: str, hay: str) -> bool:
    if not usable_girl_name(name):
        return False
    if is_cjk_name(name):
        return name in hay
    return re.search(rf"(?<![A-Za-z0-9]){re.escape(name)}(?![A-Za-z0-9])", hay, flags=re.I) is not None


def build_queries(girl_names: list[str], site_teams: list[str]) -> list[str]:
    girl_names = [name for name in girl_names if usable_girl_name(name)]
    site_teams = [team.strip() for team in site_teams if team and team.strip()]
    queries = list(BASE_QUERIES)

    # Roster-specific searches are also restricted to the two entertainment/sports
    # publishers. This catches stories that omit the word "啦啦隊" in the headline.
    for start in range(0, min(len(girl_names), NAME_QUERY_BATCH_SIZE * MAX_NAME_QUERY_BATCHES), NAME_QUERY_BATCH_SIZE):
        batch = girl_names[start:start + NAME_QUERY_BATCH_SIZE]
        if not batch:
            break
        names_expr = " OR ".join(f'"{name}"' for name in batch)
        queries.append(f"site:setn.com ({names_expr})")
        queries.append(f"site:ctwant.com ({names_expr})")

    # Team searches remain cheer-specific so a team name alone cannot flood the feed.
    for start in range(0, min(len(site_teams), TEAM_QUERY_BATCH_SIZE * MAX_TEAM_QUERY_BATCHES), TEAM_QUERY_BATCH_SIZE):
        batch = site_teams[start:start + TEAM_QUERY_BATCH_SIZE]
        if not batch:
            break
        teams_expr = " OR ".join(f'"{team}"' for team in batch)
        queries.append(f"site:setn.com ({teams_expr}) 啦啦隊")
        queries.append(f"site:ctwant.com ({teams_expr}) 啦啦隊")
    return queries


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


def clean_title(title: str) -> str:
    return re.sub(r"\s+-\s+[^-]{2,40}$", "", title).strip()


def normalize_title(title: str) -> str:
    title = clean_title(title)
    title = re.sub(r"^(快訊|獨家|影|圖|新聞)[:：｜|\s-]*", "", title, flags=re.I)
    return re.sub(r"[\s\W_]+", "", title).lower()


def title_similarity(left: str, right: str) -> float:
    a = normalize_title(left)
    b = normalize_title(right)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    if min(len(a), len(b)) >= 12 and (a in b or b in a):
        return 0.95
    return difflib.SequenceMatcher(None, a, b).ratio()


def is_duplicate_story(item: dict, accepted: list[dict]) -> bool:
    for previous in accepted:
        ratio = title_similarity(item["title"], previous["title"])
        if ratio >= NEAR_DUPLICATE_RATIO:
            return True

        current_people = set(item.get("matched_girls") or [])
        previous_people = set(previous.get("matched_girls") or [])
        same_people = bool(current_people & previous_people)
        current_teams = set(item.get("matched_teams") or [])
        previous_teams = set(previous.get("matched_teams") or [])
        same_team = bool(current_teams & previous_teams)
        same_day = item.get("dt") and previous.get("dt") and abs((item["dt"] - previous["dt"]).total_seconds()) <= 36 * 3600

        if ratio >= RELATED_DUPLICATE_RATIO and same_day and (same_people or same_team):
            return True
    return False


def canonicalize_url(url: str) -> str:
    try:
        parsed = urllib.parse.urlsplit(url)
        query = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
        query = [
            (key, value)
            for key, value in query
            if not key.lower().startswith("utm_")
            and key.lower() not in {"fbclid", "gclid", "igshid", "ref", "source", "src"}
        ]
        clean_query = urllib.parse.urlencode(query, doseq=True)
        path = re.sub(r"/+$", "", parsed.path) or "/"
        return urllib.parse.urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), path, clean_query, ""))
    except Exception:
        return url


def source_from_item(item: ET.Element) -> str:
    source = item.find("source")
    if source is not None and (source.text or "").strip():
        return (source.text or "").strip()
    title = (item.findtext("title") or "").strip()
    if " - " in title:
        return title.rsplit(" - ", 1)[-1].strip()
    return "新聞來源"


def preferred_source_name(source: str) -> bool:
    source_lower = (source or "").lower()
    return any(hint.lower() in source_lower for hint in PREFERRED_SOURCE_HINTS)


def preferred_article_host(url: str) -> bool:
    try:
        host = urllib.parse.urlsplit(url).netloc.lower().split(":", 1)[0]
        return any(host == allowed or host.endswith("." + allowed) for allowed in PREFERRED_HOSTS)
    except Exception:
        return False


def has_cheer_context(title: str, desc: str, matched_girls: list[str]) -> bool:
    hay = f"{title} {desc}".lower()
    if any(term.lower() in hay for term in CHEER_TERMS):
        return True
    return bool(matched_girls)


def classify_news(
    title: str,
    desc: str,
    matched_girls: list[str],
    matched_teams: list[str],
) -> tuple[str, str] | None:
    hay = f"{title} {desc}"
    hay_lower = hay.lower()
    has_cheer_word = any(term.lower() in hay_lower for term in CHEER_TERMS)

    if has_cheer_word:
        return "啦啦隊情報", (matched_girls[0] if matched_girls else (matched_teams[0] if matched_teams else "綜合"))

    for main_category, subcategory, terms in SPORT_RULES:
        if any(term.lower() in hay_lower for term in terms):
            return main_category, subcategory

    if matched_girls:
        return "啦啦隊情報", matched_girls[0]
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


def sports_importance_score(item: dict) -> int:
    hay = f"{item['title']} {item['description']}"
    score = sum(4 for term in IMPORTANT_SPORT_TERMS if term.lower() in hay.lower())
    score += sum(2 for term in IMPORTANT_SPORT_TERMS if term.lower() in item["title"].lower())
    # LINE TODAY CPBL is explicitly desired, so slightly prefer it inside the CPBL bucket.
    if item.get("subcategory") == "中職" and "line" in item.get("source", "").lower():
        score += 3
    return score


def select_candidates(candidates: list[dict]) -> list[dict]:
    cheer = [item for item in candidates if item["main_category"] == "啦啦隊情報"]
    sports = [item for item in candidates if item["main_category"] != "啦啦隊情報"]

    cheer.sort(
        key=lambda item: (
            bool(item["matched_girls"]),
            len(item["matched_girls"]),
            item["dt"],
        ),
        reverse=True,
    )
    selected_cheer: list[dict] = []
    generic_count = 0
    for item in cheer:
        is_generic = not item["matched_girls"] and not item["matched_teams"]
        if is_generic and generic_count >= CHEER_GENERIC_LIMIT:
            continue
        if is_duplicate_story(item, selected_cheer):
            continue
        selected_cheer.append(item)
        generic_count += int(is_generic)
        if len(selected_cheer) >= CHEER_ITEM_LIMIT:
            break

    selected_sports: list[dict] = []
    for subcategory, limit in SPORT_ITEM_LIMITS.items():
        bucket = [item for item in sports if item["subcategory"] == subcategory]
        bucket.sort(key=lambda item: (sports_importance_score(item), item["dt"]), reverse=True)
        source_counts: Counter[str] = Counter()
        for item in bucket:
            if len(selected_sports) >= SPORT_TOTAL_LIMIT:
                break
            source_key = item["source"].lower()
            if source_counts[source_key] >= SPORT_SOURCE_LIMIT:
                continue
            if is_duplicate_story(item, selected_sports):
                continue
            selected_sports.append(item)
            source_counts[source_key] += 1
            if sum(1 for x in selected_sports if x["subcategory"] == subcategory) >= limit:
                break
        if len(selected_sports) >= SPORT_TOTAL_LIMIT:
            break

    return sorted(selected_cheer + selected_sports, key=lambda item: item["dt"], reverse=True)


def main() -> None:
    girl_names, site_teams = load_site_entities()
    cutoff = datetime.now(timezone(timedelta(hours=8))) - timedelta(days=MAX_AGE_DAYS)

    pool: list[dict] = []
    for query in build_queries(girl_names, site_teams):
        try:
            for item in fetch_query(query):
                item["query"] = query
                pool.append(item)
        except Exception as exc:
            print(f"query failed: {query}: {exc}")
        time.sleep(0.35)

    candidates: list[dict] = []
    for item in pool:
        dt = parse_pubdate(item["pubDate"])
        if not dt or dt < cutoff:
            continue

        # Google News source labels are the first allow-list check.
        if not preferred_source_name(item["source"]):
            continue

        hay = f"{item['title']} {item['description']}"
        matched_girls = [name for name in girl_names if girl_name_matches(name, hay)][:6]
        matched_teams = [team for team in site_teams if team in hay][:4]
        classified = classify_news(item["title"], item["description"], matched_girls, matched_teams)
        if not classified:
            continue

        main_category, subcategory = classified

        # Cheer stories need cheer context/name. Sports stories are allowed without a
        # cheer match, but only because the source/query set is now narrowly curated.
        if main_category == "啦啦隊情報" and not has_cheer_context(item["title"], item["description"], matched_girls):
            continue

        norm_title = normalize_title(item["title"])
        if not norm_title:
            continue

        item.update({
            "dt": dt,
            "norm_title": norm_title,
            "main_category": main_category,
            "subcategory": subcategory,
            "matched_girls": matched_girls,
            "matched_teams": matched_teams,
        })

        if is_duplicate_story(item, candidates):
            continue
        candidates.append(item)

    selected = select_candidates(candidates)
    seen_url: set[str] = set()
    emitted_items: list[dict] = []
    output: list[dict] = []

    for item in selected:
        original_url = resolve_google_news_url(item["url"])
        final_url, publisher_image, publisher_summary = discover_article_metadata(original_url)
        article_url = final_url if "news.google.com" not in final_url else original_url

        # Second allow-list check uses the actual decoded publisher URL. This prevents
        # an unexpected source label from sneaking a non-preferred publisher through.
        if "news.google.com" not in article_url and not preferred_article_host(article_url):
            continue

        canonical_url = canonicalize_url(article_url)
        if canonical_url in seen_url:
            continue
        if is_duplicate_story(item, emitted_items):
            continue

        main_category = item["main_category"]
        subcategory = item["subcategory"]
        hashtags = item["matched_girls"][:] or item["matched_teams"][:]
        for tag in (main_category, subcategory):
            if tag and tag not in hashtags:
                hashtags.append(tag)

        image_url = publisher_image or item.get("rssImage") or ""
        if not image_url or is_google_placeholder_image(image_url):
            image_url = FALLBACK_IMAGES.get(main_category, FALLBACK_IMAGES["綜合情報"])

        summary = strip_html(publisher_summary or item.get("description") or "")
        if len(summary) < 20:
            summary = "本則為系統自動彙整之最新相關新聞，請點擊下方「查看原文」閱讀完整報導。"

        uid = hashlib.sha1((canonical_url or item["title"]).encode("utf-8")).hexdigest()[:16]
        content = f"來源：{item['source']}\n\n新聞摘要：{summary}"
        output.append({
            "id": f"auto-{uid}",
            "date": item["dt"].strftime("%Y/%m/%d %H:%M"),
            "title": clean_title(item["title"]),
            "tag": main_category,
            "subtag": subcategory,
            "content": content,
            "hashtags": " ".join(hashtags),
            "url": article_url,
            "source": item["source"],
            "auto": True,
            "img": image_url,
        })
        seen_url.add(canonical_url)
        emitted_items.append(item)

    output.sort(key=lambda x: x["date"], reverse=True)

    out_path = Path("data/auto-news.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    category_counts = Counter(item["tag"] for item in output)
    subcategory_counts = Counter(item["subtag"] for item in output if item["tag"] != "啦啦隊情報")
    source_counts = Counter(item["source"] for item in output)
    print(f"wrote {len(output)} auto news items")
    print(f"main categories: {dict(category_counts)}")
    print(f"sports subcategories: {dict(subcategory_counts)}")
    print(f"sources: {dict(source_counts)}")


if __name__ == "__main__":
    main()
