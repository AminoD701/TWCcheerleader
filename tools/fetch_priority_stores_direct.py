from __future__ import annotations

import hashlib
import html
import json
import re
import sys
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, urljoin
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
EVENTS_FILE = ROOT / "data/auto-events.json"
POSTS_FILE = ROOT / "data/event-social-posts.json"
ACCOUNTS = {
    "silbi_house": ("全州喜比食堂", "全州喜比食堂", "一日店長"),
    "goddess._.meet": ("女神來見面", "女神來見面", "粉絲見面活動"),
    "hhpuppy_studio": ("心碎小狗", "心碎小狗", "粉絲互動簽名合照活動"),
    "jcl700912": ("板橋第一家卡店", "板橋第一家卡店", "一日店長"),
}
UA = "Mozilla/5.0 (compatible; TWCcheerleader/1.0; +https://aminod701.github.io/TWCcheerleader/)"


class MetaParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta = {}
        self.json_blocks = []
        self._script = False
        self._buf = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag.lower() == "meta":
            key = attrs.get("property") or attrs.get("name")
            if key and attrs.get("content"):
                self.meta[key.lower()] = html.unescape(attrs["content"]).strip()
        if tag.lower() == "script" and attrs.get("type") == "application/ld+json":
            self._script, self._buf = True, []

    def handle_data(self, data):
        if self._script:
            self._buf.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "script" and self._script:
            self.json_blocks.append("".join(self._buf))
            self._script = False


def fetch_html(url: str, timeout: int = 25) -> str:
    request = Request(url, headers={"User-Agent": UA, "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8"})
    with urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def parse_public_html(source_url: str, document: str) -> dict:
    parser = MetaParser()
    parser.feed(document)
    meta = parser.meta
    return {
        "url": source_url,
        "title": meta.get("og:title", ""),
        "caption": meta.get("og:description", ""),
        "image": meta.get("og:image", ""),
        "json_ld": parser.json_blocks,
    }


def account_from_url(url: str) -> str:
    match = re.search(r"(?:instagram\.com|threads\.(?:net|com))/(?:@([^/]+)|p/|reel/|t/|share/)", url, re.I)
    return match.group(1).lower() if match and match.group(1) else ""


def clean_address(value: str) -> str:
    return re.sub(r"\s+", "", str(value or ""))


def dt(y, m, d):
    try:
        return datetime(int(y), int(m), int(d)).strftime("%Y/%m/%d")
    except ValueError:
        return ""


def parse_silbi(text: str):
    date = re.search(r"活動時間\s*[:：]\s*(20\d{2})\s*[./／-]\s*(\d{1,2})\s*[./／-]\s*(\d{1,2})", text)
    if date:
        date_value = dt(*date.groups())
    else:
        date = re.search(r"(?:^|\n)\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*女神降臨", text)
        date_value = dt(datetime.now().year, date.group(1), date.group(2)) if date else ""
    girl = re.search(r"特別邀請\s*(?:超人氣)?女神\s*[—–\-:：]?\s*([^\s@，,。！!\n]{2,16})\s*@", text)
    loc = re.search(r"活動地點\s*[:：]\s*([^\n(（]+)\s*[（(]([^）)]+)[）)]", text)
    slots = []
    for label in ("第一場", "第二場"):
        m = re.search(rf"{label}\s*(下午|上午|晚上)?\s*(\d{{1,2}}):(\d{{2}})", text)
        if m:
            hour = int(m.group(2)) + (12 if m.group(1) in ("下午", "晚上") and int(m.group(2)) < 12 else 0)
            slots.append(f"{hour:02d}:{m.group(3)}")
    if not date_value or not girl:
        return None
    return date_value, " / ".join(slots) or "TBA", [girl.group(1)], loc.group(1).strip() if loc else "全州喜比食堂", clean_address(loc.group(2) if loc else "")


def parse_goddess(text: str):
    date = re.search(r"活動時間\s*[:：]\s*(20\d{2})\s*[/／.\-]\s*(\d{1,2})\s*[/／.\-]\s*(\d{1,2})", text)
    girls = re.search(r"跟\s*([^\s，,。！!\n]{2,12})\s*(?:還有|和|與|\+|➕|＆|&)\s*([^\s，,。！!\n]{2,12})\s*一起", text)
    if not girls:
        girls = re.search(r"([\u3400-\u9fff]{2,6})\s*(?:\+|➕|＆|&)\s*([\u3400-\u9fff]{2,6})", text)
    if not date or not girls:
        return None
    loc = re.search(r"活動地點\s*[:：]\s*([^\n]+)", text)
    tail = text[loc.end():] if loc else ""
    address = re.search(r"[（(]([^）)\n]+)[）)]", tail)
    ranges = re.findall(r"(?<!\d)(\d{1,2}:\d{2})\s*[-–~～]\s*(\d{1,2}:\d{2})(?!\d)", text)
    return dt(*date.groups()), " / ".join(f"{a}-{b}" for a, b in ranges[:2]) or "TBA", [girls.group(1), girls.group(2)], loc.group(1).strip() if loc else "", clean_address(address.group(1) if address else "")


def parse_hhpuppy(text: str):
    date = re.search(r"[【\[]\s*(20\d{2})\s*[/／.\-]\s*(\d{1,2})\s*[/／.\-]\s*(\d{1,2})[^】\]]*[】\]]", text)
    girl = re.search(r"心碎療癒師[^\n]{0,16}?女神\s*[「『\"“]([^」』\"”]{2,16})[」』\"”]", text)
    total = re.search(r"[】\]]\s*(\d{1,2}:\d{2})\s*[-–~～]\s*(\d{1,2}:\d{2})", text)
    address = re.search(r"活動地址\s*[:：]\s*(?:\n\s*)?([^\n]+)", text)
    if not date or not girl:
        return None
    return dt(*date.groups()), f"{total.group(1)}-{total.group(2)}" if total else "TBA", [girl.group(1)], "心碎小狗", clean_address(address.group(1) if address else "")


def parse_jcl(text: str):
    date = re.search(r"(20\d{2})\s*[/／.\-]\s*(\d{1,2})\s*[/／.\-]\s*(\d{1,2})", text)
    girl = re.search(r"特別邀請\s+([^\s，,。！!\n]{2,16})\s+擔任一日店長", text)
    address = re.search(r"活動地址\s*[:：]\s*(?:\n\s*)?([^\n（(]+)", text)
    slots = re.findall(r"第[一二]場\s*(\d{1,2}:\d{2})\s*[-–~～]\s*(\d{1,2}:\d{2})", text)
    if not date or not girl:
        return None
    total = " / ".join(f"{a}-{b}" for a, b in slots[:2])
    if not total:
        pm = re.search(r"PM\s*(\d{1,2})\s*點\s*[~～-]\s*(\d{1,2})\s*點", text, re.I)
        total = f"{int(pm.group(1))+12:02d}:00-{int(pm.group(2))+12:02d}:00" if pm else "TBA"
    return dt(*date.groups()), total, [girl.group(1)], "板橋第一家卡店", clean_address(address.group(1) if address else "")


PARSERS = {"silbi_house": parse_silbi, "goddess._.meet": parse_goddess, "hhpuppy_studio": parse_hhpuppy, "jcl700912": parse_jcl}


def make_event(account: str, platform: str, url: str, image: str, parsed):
    date_value, time_value, girls, venue, address = parsed
    host, organizer, activity_type = ACCOUNTS[account]
    sig = f"{date_value}|{time_value}|{host}|{activity_type}"
    event_id = hashlib.sha1((sig + "|" + url).encode()).hexdigest()[:16]
    return {
        "id": f"priority-direct-{event_id}", "date": date_value, "time": time_value,
        "girls": "、".join(dict.fromkeys(girls)), "eventname": f"{host}｜{activity_type}",
        "host": host, "organizer": organizer, "venue": venue, "address": address,
        "note": f"匿名公開 HTML 自動整理；來源：{platform} @{account}。", "img": image,
        "link": url, "source": f"direct {platform} @{account}", "activity_type": activity_type,
        "activity_signature": sig, "needs_girl_review": False, "auto": True,
    }


def load_targets():
    values = []
    for file in (POSTS_FILE, ROOT / "data/event-social-sources.json"):
        try:
            data = json.loads(file.read_text(encoding="utf-8"))
        except Exception:
            data = []
        for item in data:
            account = str(item.get("account") or "").lstrip("@").lower()
            if account in ACCOUNTS and item.get("url"):
                values.append((str(item.get("platform") or platform_for(item["url"])).lower(), account, item["url"]))
    # Always attempt profile discovery for the four requested accounts.
    for account in ACCOUNTS:
        for platform in ("instagram", "threads"):
            host = "www.instagram.com" if platform == "instagram" else "www.threads.com"
            values.append((platform, account, f"https://{host}/@{account}" if platform == "threads" else f"https://{host}/{account}/"))
    seen = set()
    return [x for x in values if not (x in seen or seen.add(x))]


def platform_for(url):
    return "instagram" if "instagram.com" in url else "threads"


def main():
    current = []
    try:
        current = json.loads(EVENTS_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    preserved = [e for e in current if not any(a in " ".join(str(e.get(k, "")).lower() for k in ("source", "host", "link")) for a in ACCOUNTS)]
    events, rows_by_source, errors = [], {}, []
    for platform, account, url in load_targets():
        key = (platform, account)
        try:
            parsed_html = parse_public_html(url, fetch_html(url))
            caption = parsed_html["caption"]
            # A post URL with public og metadata is a real fetched row. Profile HTML is only a discovery row when it exposes post URLs.
            is_post = bool(re.search(r"/(?:p|reel|post|t|share)/", url))
            if is_post and caption:
                rows_by_source[key] = rows_by_source.get(key, 0) + 1
                parsed = PARSERS[account](caption)
                if parsed:
                    events.append(make_event(account, platform, url, parsed_html["image"], parsed))
            elif not is_post:
                matches = re.findall(r"https?://(?:www\.)?(?:instagram\.com/(?:p|reel)/[^\"'<> ]+|threads\.(?:net|com)/(?:@[^/]+/post|t)/[^\"'<> ]+)", caption)
                rows_by_source[key] = rows_by_source.get(key, 0) + len(matches)
            print(f"SOURCE {platform} @{account} posts={rows_by_source.get(key, 0)}")
        except Exception as exc:
            errors.append((platform, account, f"{type(exc).__name__}: {exc}"))
            rows_by_source.setdefault(key, 0)
            print(f"SOURCE {platform} @{account} FAILED reason={type(exc).__name__}: {exc}")
    merged = {}
    for event in events:
        key = (event["date"], event["host"], event["activity_type"])
        old = merged.get(key)
        if old is None or sum(bool(event.get(k)) for k in ("link", "img", "address")) > sum(bool(old.get(k)) for k in ("link", "img", "address")):
            merged[key] = event
    if not any(rows_by_source.values()):
        raise SystemExit("No public post rows were fetched; refusing to write automatic events")
    EVENTS_FILE.write_text(json.dumps(preserved + list(merged.values()), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"DIRECT REFRESH COMPLETE fetched_posts={sum(rows_by_source.values())} parsed_events={len(events)} errors={len(errors)}")


if __name__ == "__main__":
    main()
