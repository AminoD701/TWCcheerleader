from __future__ import annotations

import re
from datetime import datetime, timedelta

import fetch_apify_social_events as base

EXTRA_EVENT_TERMS = [
    "女神來見面",
    "女神見面",
    "來見面",
    "見面活動",
    "來店見面",
    "粉絲見面",
    "與你見面",
    "見面日",
    "心碎療癒室",
    "療癒室",
]

for term in reversed(EXTRA_EVENT_TERMS):
    if term not in base.EVENT_TERMS:
        base.EVENT_TERMS.insert(0, term)

import fetch_apify_platform_events as platform

for term in EXTRA_EVENT_TERMS:
    if term not in platform.EVENT_TERMS_LOCAL:
        platform.EVENT_TERMS_LOCAL.append(term)


def fetch_instagram(token: str, accounts: list[str]) -> list[dict]:
    if not accounts:
        return []
    payload = {
        "usernames": accounts,
        "outputFormat": "posts",
        "maxPosts": 12,
        "includeVideoTab": True,
        "includeRelatedProfiles": False,
        "includeRaw": False,
        "proxy": {"useApifyProxy": True, "apifyProxyGroups": ["RESIDENTIAL"]},
    }
    try:
        rows = base.apify_sync("simple.actors/instagram-profile-posts", payload, token)
        print(f"INSTAGRAM PRIMARY ACTOR rows={len(rows)}")
        return rows
    except Exception as exc:
        print(f"INSTAGRAM PRIMARY ACTOR FAILED: {type(exc).__name__}: {exc}")
        return platform.fetch_instagram(token, accounts)


def _threads_short_url(url: str) -> str:
    url = str(url or "").replace("threads.com", "threads.net")
    m = re.search(r"threads\.net/share/([A-Za-z0-9_-]+)", url, re.I)
    if m:
        return f"https://www.threads.net/t/{m.group(1)}"
    return url


def fetch_threads(token: str, accounts: list[str], explicit: list[dict]) -> list[dict]:
    start_urls = [{"url": f"https://www.threads.net/@{a.lstrip('@')}"} for a in accounts]
    seen = {x["url"] for x in start_urls}
    for item in explicit:
        url = item if isinstance(item, str) else item.get("url", "")
        if "threads.net" not in url and "threads.com" not in url:
            continue
        normalized = _threads_short_url(url)
        if normalized and normalized not in seen:
            seen.add(normalized)
            start_urls.append({"url": normalized})
    if not start_urls:
        return []
    payload = {
        "startUrls": start_urls,
        "usernames": accounts,
        "maxItems": 15,
        "proxyConfiguration": {"useApifyProxy": True},
    }
    try:
        rows = base.apify_sync("anyxsolutions/threads-scraper", payload, token)
        print(f"THREADS PRIMARY ACTOR startUrls={len(start_urls)} rows={len(rows)}")
        return rows
    except Exception as exc:
        print(f"THREADS PRIMARY ACTOR FAILED: {type(exc).__name__}: {exc}")
        return platform.fetch_threads(token, accounts, explicit)


# ---- Store-specific parsers -------------------------------------------------
_original_primary_girls = platform.primary_girls_for_row
_original_strict_event_date = platform.strict_event_date
_original_build_event = platform.build_event


# silbi_house / 全州喜比食堂

def _is_silbi_row(row: dict) -> bool:
    account = platform.normalize_account(platform.username_from_item(row))
    body = platform.clean_post_body(row)
    return account == "silbi_house" or "全州喜比食堂" in body


def _silbi_featured_girl(row: dict, girls: list[dict]) -> list[str]:
    text = platform.clean_post_body(row)
    patterns = [
        r"特別邀請\s*(?:超人氣)?女神\s*[—–\-:：]?\s*([^\s@，,。！!\n]{2,16})\s*@([A-Za-z0-9._-]+)",
        r"(?:超人氣)?女神\s*[—–\-:：]?\s*([^\s@，,。！!\n]{2,16})\s*@([A-Za-z0-9._-]+)",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.I)
        if not m:
            continue
        raw_name, handle = m.group(1).strip(), m.group(2).strip()
        exact = platform.exact_realname_matches(raw_name, girls)
        if exact:
            return exact[:1]
        by_handle = platform.safe_alias_matches("@" + handle, girls)
        if by_handle:
            return by_handle[:1]
        if not platform.looks_like_date_or_label(raw_name):
            return [raw_name]
    return []


# goddess._.meet / 女神來見面

def _is_goddess_meet_row(row: dict) -> bool:
    account = platform.normalize_account(platform.username_from_item(row))
    body = platform.clean_post_body(row)
    return account == "goddess._.meet" or "主辦單位：女神來見面" in body or "主辦單位:女神來見面" in body


def _goddess_meet_girls(row: dict, girls: list[dict]) -> list[str]:
    text = platform.clean_post_body(row)
    m = re.search(r"跟\s*([^\s，,。！!\n]{2,12})\s*(?:還有|和|與|\+|➕|＆|&)\s*([^\s，,。！!\n]{2,12})\s*一起", text)
    if not m:
        m = re.search(r"([\u3400-\u9fff]{2,6})\s*(?:\+|➕|＆|&|和|與)\s*([\u3400-\u9fff]{2,6})", text)
    if not m:
        return []
    names = []
    for raw in (m.group(1).strip(), m.group(2).strip()):
        exact = platform.exact_realname_matches(raw, girls)
        if exact:
            for name in exact:
                if name not in names:
                    names.append(name)
        elif raw not in names:
            names.append(raw)
    return names[:2]


# hhpuppy_studio / 心碎小狗

def _is_hhpuppy_row(row: dict) -> bool:
    account = platform.normalize_account(platform.username_from_item(row))
    body = platform.clean_post_body(row)
    return account == "hhpuppy_studio" or "心碎小狗" in body or "心碎療癒室" in body


def _hhpuppy_girl(row: dict, girls: list[dict]) -> list[str]:
    text = platform.clean_post_body(row)
    patterns = [
        r"今天[の的]\s*心碎療癒師[^\n]{0,12}?女神\s*[「『\"“]?([^」』\"”\s💙❤💔，,。！!\n]{2,16})",
        r"心碎療癒師[^\n]{0,12}?女神\s*[「『\"“]?([^」』\"”\s💙❤💔，,。！!\n]{2,16})",
        r"女神\s*[「『\"“]([^」』\"”]{2,16})[」』\"”]",
    ]
    for pat in patterns:
        m = re.search(pat, text)
        if not m:
            continue
        raw = m.group(1).strip()
        exact = platform.exact_realname_matches(raw, girls)
        if exact:
            return exact[:1]
        aliases = platform.safe_alias_matches(raw, girls)
        if aliases:
            return aliases[:1]
        if not platform.looks_like_date_or_label(raw):
            return [raw]
    return []


def primary_girls_for_row(row, platform_name, girls, source_mapping, explicit_mapping):
    if _is_silbi_row(row):
        featured = _silbi_featured_girl(row, girls)
        if featured:
            return featured, "silbi_featured_girl"
    if _is_goddess_meet_row(row):
        featured = _goddess_meet_girls(row, girls)
        if featured:
            return featured, "goddess_meet_featured_girls"
    if _is_hhpuppy_row(row):
        featured = _hhpuppy_girl(row, girls)
        if featured:
            return featured, "hhpuppy_featured_girl"
    return _original_primary_girls(row, platform_name, girls, source_mapping, explicit_mapping)


def strict_event_date(text: str):
    # 心碎小狗：日期固定放在【YYYY/M/D(週)】的活動抬頭，後面的場次/報名資訊都不是活動日。
    if "心碎小狗" in text or "心碎療癒室" in text:
        m = re.search(r"[【\[]\s*(20\d{2})\s*[/／.\-]\s*(\d{1,2})\s*[/／.\-]\s*(\d{1,2})(?:\([^)]*\)|（[^）]*）)?\s*[】\]]", text)
        if m:
            try:
                return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=platform.TZ)
            except ValueError:
                pass

    # 女神來見面：只認「活動時間」標籤後的日期。
    if "女神來見面" in text:
        m = re.search(r"活動時間\s*[:：]\s*(20\d{2})\s*[/／.\-]\s*(\d{1,2})\s*[/／.\-]\s*(\d{1,2})", text)
        if m:
            try:
                return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=platform.TZ)
            except ValueError:
                pass

    # 全州喜比食堂：開頭「9月12日女神降臨」是活動日；售票日不算。
    if "全州喜比食堂" in text or "女神降臨" in text:
        m = re.search(r"(?:^|\n)\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*女神降臨", text)
        if m:
            now = datetime.now(platform.TZ)
            month, day = int(m.group(1)), int(m.group(2))
            try:
                dt = datetime(now.year, month, day, tzinfo=platform.TZ)
                if dt < now - timedelta(days=1) and now.month >= 11 and month <= 2:
                    dt = dt.replace(year=now.year + 1)
                if now - timedelta(days=1) <= dt <= now + timedelta(days=240):
                    return dt
            except ValueError:
                pass
    return _original_strict_event_date(text)


def _goddess_meet_time(text: str) -> str:
    m = re.search(
        r"活動時間\s*[:：][^\n]*\n?\s*(\d{1,2}:\d{2}\s*[-–~～]\s*\d{1,2}:\d{2})\s*[/／]\s*(\d{1,2}:\d{2}\s*[-–~～]\s*\d{1,2}:\d{2})",
        text,
    )
    if m:
        return f"{m.group(1).replace(' ', '')} / {m.group(2).replace(' ', '')}"
    return ""


def _hhpuppy_time(text: str) -> str:
    m = re.search(
        r"[【\[]\s*20\d{2}\s*[/／.\-]\s*\d{1,2}\s*[/／.\-]\s*\d{1,2}(?:\([^)]*\)|（[^）]*）)?\s*[】\]]\s*(\d{1,2}:\d{2})\s*[-–~～]\s*(\d{1,2}:\d{2})",
        text,
    )
    if m:
        return f"{m.group(1)}-{m.group(2)}"
    return ""


def _hhpuppy_address(text: str) -> str:
    m = re.search(r"活動地址\s*[:：]\s*([^\n]+)", text)
    return m.group(1).strip() if m else ""


def build_event(item: dict, platform_name: str, girls: list[dict], stats: dict):
    event = _original_build_event(item, platform_name, girls, stats)
    if not event:
        return event

    if _is_silbi_row(item):
        event["host"] = "全州喜比食堂"
        event["organizer"] = "全州喜比食堂"

    if _is_goddess_meet_row(item):
        text = platform.clean_post_body(item)
        event["host"] = "女神來見面"
        event["organizer"] = "女神來見面"
        event["venue"] = "TGI FRIDAYS 華泰餐廳"
        event["address"] = "TGI FRIDAYS 華泰餐廳｜桃園市中壢區青埔里春德路189號"
        event["activity_type"] = "粉絲見面活動"
        event["eventname"] = "女神來見面｜粉絲互動簽名拍照"
        slots = _goddess_meet_time(text)
        if slots:
            event["time"] = slots
        event["note"] = "主辦：女神來見面；地點：TGI FRIDAYS 華泰餐廳。活動日期與場次以貼文『活動時間』欄位為準。"

    if _is_hhpuppy_row(item):
        text = platform.clean_post_body(item)
        event["host"] = "心碎小狗"
        event["organizer"] = "心碎小狗"
        event["activity_type"] = "粉絲互動簽名合照活動"
        event["eventname"] = "心碎小狗｜心碎療癒室"
        slots = _hhpuppy_time(text)
        if slots:
            event["time"] = slots
        address = _hhpuppy_address(text)
        if address:
            event["address"] = address
        event["note"] = "主辦：心碎小狗。活動日期、時間與出席女孩以貼文『心碎療癒室』抬頭資訊為準。"
    return event


platform.fetch_instagram = fetch_instagram
platform.fetch_threads = fetch_threads
platform.primary_girls_for_row = primary_girls_for_row
platform.strict_event_date = strict_event_date
platform.build_event = build_event


if __name__ == "__main__":
    platform.main()
