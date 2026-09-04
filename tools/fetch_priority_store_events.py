from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path

import fetch_apify_social_events as base
import run_event_fetch as legacy

EVENTS_FILE = Path("data/auto-events.json")
TZ = timezone(timedelta(hours=8))
PRIORITY_ACCOUNTS = {
    "silbi_house": "全州喜比食堂",
    "goddess._.meet": "女神來見面",
    "hhpuppy_studio": "心碎小狗",
    "jcl700912": "板橋第一家卡店",
}


def load_events():
    try:
        value = json.loads(EVENTS_FILE.read_text(encoding="utf-8"))
        return value if isinstance(value, list) else []
    except Exception:
        return []


def norm_account(value: str) -> str:
    return re.sub(r"[^a-z0-9._-]+", "", str(value or "").lower().lstrip("@"))


def body(row: dict) -> str:
    return legacy.platform.clean_post_body(row)


def row_account(row: dict) -> str:
    return norm_account(legacy.platform.username_from_item(row))


def event_url(row: dict, platform: str) -> str:
    return legacy.platform.post_url(row, platform) or ""


def first_image(row: dict) -> str:
    try:
        return base.first_image(row)
    except Exception:
        return ""


def canonical_name(raw: str, girls: list[dict]) -> str:
    raw = str(raw or "").strip()
    if not raw:
        return ""
    exact = legacy.platform.exact_realname_matches(raw, girls)
    if exact:
        return exact[0]
    aliases = legacy.platform.safe_alias_matches(raw, girls)
    return aliases[0] if aliases else raw


def dt_string(y, m, d):
    try:
        return datetime(int(y), int(m), int(d), tzinfo=TZ).strftime("%Y/%m/%d")
    except Exception:
        return ""


def normalize_address(value: str) -> str:
    return re.sub(r"\\s+", "", str(value or ""))


def clock(hour: str, minute: str, meridiem: str = "") -> str:
    h = int(hour)
    if meridiem in ("下午", "晚上", "PM") and h < 12:
        h += 12
    return f"{h:02d}:{int(minute):02d}"


def parse_silbi(row: dict, platform: str, girls: list[dict]):
    text = body(row)
    date_match = re.search(
        r"活動時間\s*[:：]\s*(20\d{2})\s*[./／-]\s*(\d{1,2})\s*[./／-]\s*(\d{1,2})",
        text,
    )
    if date_match:
        date = dt_string(*date_match.groups())
    else:
        date_match = re.search(r"(?:^|\n)\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*女神降臨", text)
        date = dt_string(datetime.now(TZ).year, date_match.group(1), date_match.group(2)) if date_match else ""
    girl_match = re.search(
        r"特別邀請\s*(?:超人氣)?女神\s*[—–\-:：]?\s*([^\s@，,。！!\n]{2,16})\s*@",
        text,
    )
    loc = re.search(r"活動地點\s*[:：]\s*([^\n(（]+)\s*[（(]([^）)]+)[）)]", text)
    slots = []
    for label in ("第一場", "第二場"):
        match = re.search(rf"{label}\s*(下午|上午|晚上)?\s*(\d{{1,2}}):(\d{{2}})", text)
        if match:
            slots.append(clock(match.group(2), match.group(3), match.group(1)))
    if not date or not girl_match:
        return None
    venue = loc.group(1).strip() if loc else "全州喜比食堂"
    address = normalize_address(loc.group(2) if loc else "")
    return make_event(row, platform, date, " / ".join(slots) or "TBA", [canonical_name(girl_match.group(1), girls)],
                      "全州喜比食堂", venue, address, "一日店長", "全州喜比食堂｜一日店長")


def parse_goddess(row: dict, platform: str, girls: list[dict]):
    text = body(row)
    date_match = re.search(
        r"活動時間\s*[:：]\s*(20\d{2})\s*[/／.\-]\s*(\d{1,2})\s*[/／.\-]\s*(\d{1,2})",
        text,
    )
    girl_match = re.search(
        r"跟\s*([^\s，,。！!\n]{2,12})\s*(?:還有|和|與|\+|➕|＆|&)\s*([^\s，,。！!\n]{2,12})\s*一起",
        text,
    )
    if not girl_match:
        girl_match = re.search(r"([\u3400-\u9fff]{2,6})\s*(?:\+|➕|＆|&)\s*([\u3400-\u9fff]{2,6})", text)
    if not date_match or not girl_match:
        return None
    ranges = re.findall(r"(?<!\d)(\d{1,2}:\d{2})\s*[-–~～]\s*(\d{1,2}:\d{2})(?!\d)", text)
    loc = re.search(r"活動地點\s*[:：]\s*([^\n]+)", text)
    location_text = text[loc.end():] if loc else ""
    addr = re.search(r"[（(]([^）)\\n]+)[）)]", location_text)
    venue = loc.group(1).strip() if loc else ""
    address = normalize_address(addr.group(1) if addr else "")
    names = [canonical_name(girl_match.group(1), girls), canonical_name(girl_match.group(2), girls)]
    return make_event(row, platform, dt_string(*date_match.groups()), " / ".join(f"{a}-{b}" for a, b in ranges[:2]) or "TBA",
                      names, "女神來見面", venue, address, "粉絲見面活動", "女神來見面｜粉絲互動簽名拍照")


def parse_hhpuppy(row: dict, platform: str, girls: list[dict]):
    text = body(row)
    date_match = re.search(r"[【\[]\s*(20\d{2})\s*[/／.\-]\s*(\d{1,2})\s*[/／.\-]\s*(\d{1,2})(?:\([^)]*\)|（[^）]*）)?\s*[】\]]", text)
    girl_match = re.search(r"心碎療癒師[^\n]{0,16}?女神\s*[「『\"“]([^」』\"”]{2,16})[」』\"”]", text)
    total_time = re.search(r"[】\]]\s*(\d{1,2}:\d{2})\s*[-–~～]\s*(\d{1,2}:\d{2})", text)
    address_match = re.search(r"活動地址\s*[:：]\s*(?:\n\s*)?([^\n]+)", text)
    if not date_match or not girl_match:
        return None
    return make_event(row, platform, dt_string(*date_match.groups()),
                      f"{total_time.group(1)}-{total_time.group(2)}" if total_time else "TBA",
                      [canonical_name(girl_match.group(1), girls)], "心碎小狗", "心碎小狗",
                      normalize_address(address_match.group(1) if address_match else ""),
                      "粉絲互動簽名合照活動", "心碎小狗｜心碎療癒室")


def parse_jcl(row: dict, platform: str, girls: list[dict]):
    text = body(row)
    date_match = re.search(r"(20\d{2})\s*[/／.\-]\s*(\d{1,2})\s*[/／.\-]\s*(\d{1,2})", text)
    girl_match = re.search(r"特別邀請\s+([^\s，,。！!\n]{2,16})\s+擔任一日店長", text)
    address_match = re.search(r"活動地址\s*[:：]\s*(?:\n\s*)?([^\n（(]+)", text)
    slots = re.findall(r"第[一二]場\s*(\d{1,2}:\d{2})\s*[-–~～]\s*(\d{1,2}:\d{2})", text)
    if not date_match or not girl_match:
        return None
    if slots:
        time = " / ".join(f"{a}-{b}" for a, b in slots[:2])
    else:
        pm = re.search(r"PM\s*(\d{1,2})\s*點\s*[~～-]\s*(\d{1,2})\s*點", text, re.I)
        time = f"{clock(pm.group(1), '00', 'PM')}-{clock(pm.group(2), '00', 'PM')}" if pm else "TBA"
    return make_event(row, platform, dt_string(*date_match.groups()), time,
                      [canonical_name(girl_match.group(1), girls)], "板橋第一家卡店", "板橋第一家卡店",
                      normalize_address(address_match.group(1) if address_match else ""),
                      "一日店長", "板橋第一家卡店｜一日店長")


def make_event(row, platform, date, time, girls, host, venue, address, activity_type, title):
    url = event_url(row, platform)
    account = row_account(row)
    key = re.sub(r"[^A-Za-z0-9]+", "", url.rstrip("/").rsplit("/", 1)[-1]) or f"{account}-{date}-{time}"
    return {
        "id": f"priority-{account}-{key}",
        "date": date,
        "time": time,
        "girls": "、".join(dict.fromkeys(girls)),
        "eventname": title,
        "host": host,
        "organizer": host,
        "venue": venue,
        "address": address,
        "note": f"專屬店家規則自動整理；來源：{host} 公開貼文。細節請以原始貼文最新公告為準。",
        "img": first_image(row),
        "link": url,
        "source": f"priority {platform} @{account}",
        "activity_type": activity_type,
        "activity_signature": f"{date}|{time}|{host}|{activity_type}",
        "needs_girl_review": False,
        "auto": True,
        "girl_match_method": "store_specific",
    }


PARSERS = {
    "silbi_house": parse_silbi,
    "goddess._.meet": parse_goddess,
    "hhpuppy_studio": parse_hhpuppy,
    "jcl700912": parse_jcl,
}


def belongs_priority_event(event: dict) -> bool:
    hay = " ".join(str(event.get(k, "")) for k in ("source", "host", "organizer", "link")).lower()
    return any(account in hay for account in PRIORITY_ACCOUNTS)


def main():
    token = os.environ.get("APIFY_TOKEN", "").strip()
    if not token:
        raise RuntimeError("APIFY_TOKEN is required; refusing to publish seed-only events")
    girls = base.load_girls()
    preserved = [event for event in load_events() if not belongs_priority_event(event)]
    found = []
    rows_by_source = {}
    accounts = list(PRIORITY_ACCOUNTS)

    rows = legacy.fetch_instagram(token, accounts)
    rows_by_source["instagram"] = rows
    print(f"Instagram total rows={len(rows)}")
    for row in rows:
        account = row_account(row)
        parser = PARSERS.get(account)
        if parser:
            event = parser(row, "instagram", girls)
            if event:
                found.append(event)

    rows = legacy.fetch_threads(token, accounts, [])
    rows_by_source["threads"] = rows
    print(f"Threads total rows={len(rows)}")
    for row in rows:
        account = row_account(row)
        parser = PARSERS.get(account)
        if parser:
            event = parser(row, "threads", girls)
            if event:
                found.append(event)

    if not any(rows_by_source.values()):
        raise RuntimeError("Both Instagram and Threads returned zero rows; no event file was written")

    merged = {}
    for event in found:
        key = (event.get("date"), event.get("time"), event.get("host"), event.get("activity_type"))
        merged[key] = event
    output = preserved + list(merged.values())
    EVENTS_FILE.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Priority refresh complete: instagram={len(rows_by_source['instagram'])} threads={len(rows_by_source['threads'])} parsed={len(found)} total={len(output)}")


if __name__ == "__main__":
    main()
