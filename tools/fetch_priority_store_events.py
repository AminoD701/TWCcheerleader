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
        return json.loads(EVENTS_FILE.read_text(encoding="utf-8"))
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
    if aliases:
        return aliases[0]
    return raw


def dt_string(y, m, d):
    try:
        return datetime(int(y), int(m), int(d), tzinfo=TZ).strftime("%Y/%m/%d")
    except Exception:
        return ""


def parse_silbi(row: dict, platform: str, girls: list[dict]):
    text = body(row)
    if not text:
        return None
    m = re.search(r"活動時間\s*[:：]\s*(20\d{2})\s*[./／-]\s*(\d{1,2})\s*[./／-]\s*(\d{1,2})", text)
    if m:
        date = dt_string(*m.groups())
    else:
        m = re.search(r"(?:^|\n)\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*女神降臨", text)
        date = dt_string(datetime.now(TZ).year, m.group(1), m.group(2)) if m else ""
    gm = re.search(r"特別邀請\s*(?:超人氣)?女神\s*[—–\-:：]?\s*([^\s@，,。！!\n]{2,16})\s*@([A-Za-z0-9._-]+)", text)
    if not gm:
        gm = re.search(r"(?:超人氣)?女神\s*[—–\-:：]?\s*([^\s@，,。！!\n]{2,16})\s*@([A-Za-z0-9._-]+)", text)
    if not date or not gm:
        return None
    girl = canonical_name(gm.group(1), girls)
    loc = re.search(r"活動地點\s*[:：]\s*([^\n(（]+)\s*[（(]([^）)]+)[）)]", text)
    venue = loc.group(1).strip() if loc else "全州喜比食堂"
    address = loc.group(2).strip() if loc else venue
    tm = re.search(r"第一場\s*(下午|上午|晚上)?\s*(\d{1,2}:\d{2})[^\n/]*[/／]\s*第二場\s*(下午|上午|晚上)?\s*(\d{1,2}:\d{2})", text)
    time = "TBA"
    if tm:
        def conv(part, hm):
            h, mi = map(int, hm.split(":"))
            if part in ("下午", "晚上") and h < 12:
                h += 12
            return f"{h:02d}:{mi:02d}"
        time = f"{conv(tm.group(1), tm.group(2))} / {conv(tm.group(3), tm.group(4))}"
    return make_event(row, platform, date, time, [girl], "全州喜比食堂", venue, address, "一日店長", "全州喜比食堂｜一日店長")


def parse_goddess(row: dict, platform: str, girls: list[dict]):
    text = body(row)
    if not text:
        return None
    dm = re.search(r"活動時間\s*[:：]\s*(20\d{2})\s*[/／.\-]\s*(\d{1,2})\s*[/／.\-]\s*(\d{1,2})", text)
    if not dm:
        return None
    date = dt_string(*dm.groups())
    gm = re.search(r"跟\s*([^\s，,。！!\n]{2,12})\s*(?:還有|和|與|\+|➕|＆|&)\s*([^\s，,。！!\n]{2,12})\s*一起", text)
    if not gm:
        gm = re.search(r"([\u3400-\u9fff]{2,6})\s*(?:\+|➕|＆|&|和|與)\s*([\u3400-\u9fff]{2,6})", text)
    if not gm:
        return None
    names = [canonical_name(gm.group(1), girls), canonical_name(gm.group(2), girls)]
    ranges = re.findall(r"(?<!\d)(\d{1,2}:\d{2})\s*[-–~～]\s*(\d{1,2}:\d{2})(?!\d)", text)
    time = " / ".join(f"{a}-{b}" for a, b in ranges[:2]) if ranges else "TBA"
    loc = re.search(r"活動地點\s*[:：]\s*([^\n]+)", text)
    venue = loc.group(1).strip() if loc else "TGI FRIDAYS 華泰餐廳"
    addr = re.search(r"[（(](桃園市中壢區[^）)\n]+)[）)]", text)
    address = addr.group(1).strip() if addr else venue
    return make_event(row, platform, date, time, names, "女神來見面", venue, address, "粉絲見面活動", "女神來見面｜粉絲互動簽名拍照")


def parse_hhpuppy(row: dict, platform: str, girls: list[dict]):
    text = body(row)
    if not text:
        return None
    dm = re.search(r"[【\[]\s*(20\d{2})\s*[/／.\-]\s*(\d{1,2})\s*[/／.\-]\s*(\d{1,2})(?:\([^)]*\)|（[^）]*）)?\s*[】\]]", text)
    gm = re.search(r"(?:心碎療癒師[^\n]{0,16}?女神|女神)\s*[「『\"“]([^」』\"”]{2,16})[」』\"”]", text)
    if not dm or not gm:
        return None
    date = dt_string(*dm.groups())
    girl = canonical_name(gm.group(1), girls)
    tm = re.search(r"[】\]]\s*(\d{1,2}:\d{2})\s*[-–~～]\s*(\d{1,2}:\d{2})", text)
    time = f"{tm.group(1)}-{tm.group(2)}" if tm else "TBA"
    am = re.search(r"活動地址\s*[:：]\s*([^\n]+)", text)
    address = am.group(1).strip() if am else "詳見原始活動貼文"
    return make_event(row, platform, date, time, [girl], "心碎小狗", "心碎小狗", address, "粉絲互動簽名合照活動", "心碎小狗｜心碎療癒室")


def parse_jcl(row: dict, platform: str, girls: list[dict]):
    text = body(row)
    if not text:
        return None
    dm = re.search(r"(20\d{2})\s*[/／.\-]\s*(\d{1,2})\s*[/／.\-]\s*(\d{1,2})", text)
    gm = re.search(r"特別邀請\s+([^\s，,。！!\n]{2,16})\s+擔任一日店長", text)
    if not dm or not gm:
        return None
    date = dt_string(*dm.groups())
    girl = canonical_name(gm.group(1), girls)
    ranges = re.findall(r"第[一二]場\s*(\d{1,2}:\d{2})\s*[-–~～]\s*(\d{1,2}:\d{2})", text)
    time = " / ".join(f"{a}-{b}" for a, b in ranges[:2]) if ranges else "14:00-16:00"
    am = re.search(r"活動地址\s*[:：]\s*\n?\s*([^\n（(]+)", text)
    address = am.group(1).strip() if am else "詳見原始活動貼文"
    return make_event(row, platform, date, time, [girl], "板橋第一家卡店", "板橋第一家卡店", address, "一日店長", "板橋第一家卡店｜一日店長")


def make_event(row, platform, date, time, girls, host, venue, address, activity_type, title):
    url = event_url(row, platform)
    account = row_account(row)
    key = re.sub(r"[^A-Za-z0-9]+", "", (url.rsplit("/", 2)[-2] if url else "")) or f"{account}-{date}-{time}"
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
        "link": url or f"https://www.instagram.com/{account}/",
        "source": f"priority {platform} @{account}",
        "activity_type": activity_type,
        "activity_signature": f"{date}|{time}|{host}|{activity_type}|{'、'.join(girls)}",
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


def belongs_priority_event(e: dict) -> bool:
    hay = " ".join(str(e.get(k, "")) for k in ("source", "host", "organizer", "link" )).lower()
    return any(a in hay for a in PRIORITY_ACCOUNTS)


def confirmed_seed_events():
    return [
        {"id":"priority-seed-silbi-20260905","date":"2026/09/05","time":"TBA","girls":"廉世彬","eventname":"全州喜比食堂｜一日店長料理派對","host":"全州喜比食堂","organizer":"全州喜比食堂","venue":"全州喜比食堂","address":"詳見原始活動貼文","note":"已確認公開活動；後續以店家原始貼文為準。","img":"","link":"https://www.threads.com/@silbi_house/post/DcbHUGAlFar","source":"priority seed @silbi_house","activity_type":"一日店長","activity_signature":"2026/09/05|TBA|全州喜比食堂|一日店長|廉世彬","needs_girl_review":False,"auto":True,"girl_match_method":"confirmed_seed"},
        {"id":"priority-seed-silbi-20260906","date":"2026/09/06","time":"TBA","girls":"以恩、凱莉","eventname":"全州喜比食堂｜一日店長料理派對","host":"全州喜比食堂","organizer":"全州喜比食堂","venue":"全州喜比食堂","address":"詳見原始活動貼文","note":"已確認公開活動；後續以店家原始貼文為準。","img":"","link":"https://www.threads.com/@silbi_house/post/Dcnr2btkzAf","source":"priority seed @silbi_house","activity_type":"一日店長","activity_signature":"2026/09/06|TBA|全州喜比食堂|一日店長|以恩、凱莉","needs_girl_review":False,"auto":True,"girl_match_method":"confirmed_seed"},
        {"id":"priority-seed-silbi-20260910","date":"2026/09/10","time":"TBA","girls":"高佳彬","eventname":"全州喜比食堂｜一日店長料理派對","host":"全州喜比食堂","organizer":"全州喜比食堂","venue":"全州喜比食堂","address":"詳見原始活動貼文","note":"已確認公開活動；後續以店家原始貼文為準。","img":"","link":"https://www.threads.com/@silbi_house/post/Dc09DSeCQby","source":"priority seed @silbi_house","activity_type":"一日店長","activity_signature":"2026/09/10|TBA|全州喜比食堂|一日店長|高佳彬","needs_girl_review":False,"auto":True,"girl_match_method":"confirmed_seed"},
        {"id":"priority-seed-silbi-20260912","date":"2026/09/12","time":"14:10 / 15:40","girls":"韓志恩","eventname":"全州喜比食堂｜一日店長","host":"全州喜比食堂","organizer":"全州喜比食堂","venue":"全州喜比食堂","address":"臺北市信義區吳興街 345 號","note":"活動日期、地點與場次依貼文『活動資訊』欄位。","img":"","link":"https://www.instagram.com/silbi_house/","source":"priority seed @silbi_house","activity_type":"一日店長","activity_signature":"2026/09/12|14:10 / 15:40|全州喜比食堂|一日店長|韓志恩","needs_girl_review":False,"auto":True,"girl_match_method":"confirmed_seed"},
        {"id":"priority-seed-goddess-20260914","date":"2026/09/14","time":"19:00-19:50 / 20:00-20:50","girls":"千昭允、南和侖","eventname":"女神來見面｜粉絲互動簽名拍照","host":"女神來見面","organizer":"女神來見面","venue":"TGI FRIDAYS 華泰餐廳","address":"桃園市中壢區青埔里春德路189號","note":"主辦：女神來見面；活動地點：TGI FRIDAYS 華泰餐廳。","img":"","link":"https://www.instagram.com/p/DcaJALMJ9F5/","source":"priority seed @goddess._.meet","activity_type":"粉絲見面活動","activity_signature":"2026/09/14|19:00-19:50 / 20:00-20:50|女神來見面|粉絲見面活動|千昭允、南和侖","needs_girl_review":False,"auto":True,"girl_match_method":"confirmed_seed"},
        {"id":"priority-seed-hhpuppy-20260926","date":"2026/09/26","time":"16:00-18:00","girls":"文慧真","eventname":"心碎小狗｜心碎療癒室","host":"心碎小狗","organizer":"心碎小狗","venue":"心碎小狗","address":"桃園市中壢區領航南路四段53號1F","note":"活動日期、時間與女孩依心碎療癒室抬頭資訊。","img":"","link":"https://www.instagram.com/p/DcxUzRnJI18/","source":"priority seed @hhpuppy_studio","activity_type":"粉絲互動簽名合照活動","activity_signature":"2026/09/26|16:00-18:00|心碎小狗|粉絲互動簽名合照活動|文慧真","needs_girl_review":False,"auto":True,"girl_match_method":"confirmed_seed"},
        {"id":"priority-seed-jcl-20260912","date":"2026/09/12","time":"14:00-14:50 / 15:00-16:00","girls":"金娜賢","eventname":"板橋第一家卡店｜一日店長","host":"板橋第一家卡店","organizer":"板橋第一家卡店","venue":"板橋第一家卡店","address":"新北市板橋區文化路一段379號3樓","note":"活動日期、場次與女孩依店家公開活動文案。","img":"","link":"https://www.instagram.com/jcl700912/","source":"priority seed @jcl700912","activity_type":"一日店長","activity_signature":"2026/09/12|14:00-14:50 / 15:00-16:00|板橋第一家卡店|一日店長|金娜賢","needs_girl_review":False,"auto":True,"girl_match_method":"confirmed_seed"}
    ]


def main():
    token = os.environ.get("APIFY_TOKEN", "").strip()
    girls = base.load_girls()
    current = [e for e in load_events() if not belongs_priority_event(e)]
    found = []
    accounts = list(PRIORITY_ACCOUNTS)

    if token:
        try:
            rows = legacy.fetch_instagram(token, accounts)
            print(f"PRIORITY INSTAGRAM rows={len(rows)}")
            for row in rows:
                account = row_account(row)
                parser = PARSERS.get(account)
                if parser:
                    event = parser(row, "instagram", girls)
                    if event:
                        found.append(event)
        except Exception as exc:
            print(f"PRIORITY INSTAGRAM FAILED: {type(exc).__name__}: {exc}")

        try:
            rows = legacy.fetch_threads(token, accounts, [])
            print(f"PRIORITY THREADS rows={len(rows)}")
            for row in rows:
                account = row_account(row)
                parser = PARSERS.get(account)
                if parser:
                    event = parser(row, "threads", girls)
                    if event:
                        found.append(event)
        except Exception as exc:
            print(f"PRIORITY THREADS FAILED: {type(exc).__name__}: {exc}")

    seeds = confirmed_seed_events()
    by_sig = {}
    for e in seeds + found:
        sig = e.get("activity_signature") or e.get("id")
        # crawler result replaces seed when both describe the same date/host/girls closely enough
        key = (e.get("date"), e.get("host"), e.get("girls"))
        by_sig[key] = e
    merged = current + list(by_sig.values())
    EVENTS_FILE.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Priority-store refresh complete: preserved={len(current)} seeds={len(seeds)} crawled={len(found)} total={len(merged)}")


if __name__ == "__main__":
    main()
