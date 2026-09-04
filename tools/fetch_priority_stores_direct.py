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
# Anonymous-only crawler (workflow also patches index): no tokens, cookies, browser sessions, or paid services.
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


def fetch_html(url: str, timeout: int = 8) -> str:
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



def canonical_post(platform, url):
    url = url.split("?")[0].rstrip("/")
    if platform == "instagram":
        m = re.search(r"instagram\.com/(?:p|reel)/([^/]+)", url, re.I)
        return ("instagram", m.group(1)) if m else None
    m = re.search(r"threads\.(?:net|com)/(@[^/]+/post/[^/?]+|t/[^/?]+)", url, re.I)
    return ("threads", url) if m else None


def extract_post_urls(platform, text):
    if platform == "instagram":
        pattern = r"https?://(?:www\.)?instagram\.com/(?:p|reel)/[A-Za-z0-9_-]+"
    else:
        pattern = r"https?://(?:www\.)?threads\.(?:net|com)/(?:@[^/]+/post/|t/)[A-Za-z0-9_-]+"
    return list(dict.fromkeys(canonical_post(platform, u)[1] if platform == "threads" else u for u in re.findall(pattern, text or "", re.I)))


def search_post_urls(platform, account):
    query = f"site:{'instagram.com' if platform == 'instagram' else 'threads.com'} {account}"
    try:
        document = fetch_html("https://html.duckduckgo.com/html/?q=" + quote(query), timeout=6)
        urls = extract_post_urls(platform, document)
        return urls[:20]
    except Exception:
        return []


def known_post_urls(platform, account):
    urls = []
    for file in (POSTS_FILE, ROOT / "data/event-social-sources.json"):
        try:
            data = json.loads(file.read_text(encoding="utf-8"))
        except Exception:
            data = []
        for item in data:
            if str(item.get("account") or "").lstrip("@").lower() != account:
                continue
            url = str(item.get("url") or "")
            if platform_for(url) == platform and canonical_post(platform, url):
                urls.append(url.split("?")[0].rstrip("/"))
    return list(dict.fromkeys(urls))


def discover_instaloader(account, limit=18):
    try:
        import instaloader
        loader = instaloader.Instaloader(download_pictures=False, download_videos=False,
                                         download_video_thumbnails=False, save_metadata=False,
                                         quiet=True)
        loader.context.request_timeout = 8
        profile = instaloader.Profile.from_username(loader.context, account)
        results = []
        for post in profile.get_posts():
            url = getattr(post, "url", "") or f"https://www.instagram.com/p/{post.shortcode}/"
            node = getattr(post, "_node", {}) or {}
            results.append({"platform": "instagram", "account": account, "url": url,
                            "caption": getattr(post, "caption", "") or "",
                            "date": getattr(post, "date_utc", None).isoformat() if getattr(post, "date_utc", None) else "",
                            "image": node.get("display_url", "")})
            if len(results) >= limit:
                break
        return results
    except Exception as exc:
        print(f"IG_DISCOVERY instaloader @{account} posts=0 reason={type(exc).__name__}")
        return []


def discover_from_profile(platform, account):
    hosts = ["www.instagram.com"] if platform == "instagram" else ["www.threads.com", "www.threads.net"]
    found = []
    for host in hosts:
        try:
            url = f"https://{host}/{account}/" if platform == "instagram" else f"https://{host}/@{account}"
            found.extend(extract_post_urls(platform, fetch_html(url)))
        except Exception:
            pass
    return list(dict.fromkeys(found))[:20]


def oembed_post(platform, url):
    endpoints = (["https://www.instagram.com/api/v1/oembed/?url=" + quote(url, safe="")]
                 if platform == "instagram" else
                 ["https://www.threads.net/oembed?url=" + quote(url, safe=""),
                  "https://www.threads.com/oembed?url=" + quote(url, safe="")])
    for endpoint in endpoints:
        try:
            raw = fetch_html(endpoint, timeout=6)
            data = json.loads(raw)
            if isinstance(data, dict) and (data.get("title") or data.get("author_name")):
                return {"caption": str(data.get("title") or ""), "image": str(data.get("thumbnail_url") or "")}
        except Exception:
            continue
    return {}


def fetch_post_object(platform, account, url, instaloader_object=None):
    obj = {"platform": platform, "account": account, "url": url, "caption": "", "image": ""}
    if instaloader_object:
        obj.update({k: instaloader_object.get(k, "") for k in ("caption", "image")})
    embedded = oembed_post(platform, url)
    obj.update({k: v for k, v in embedded.items() if v})
    try:
        meta = parse_public_html(url, fetch_html(url))
        if not obj["caption"]:
            obj["caption"] = meta["caption"]
        if not obj["image"]:
            obj["image"] = meta["image"]
        obj["title"] = meta["title"]
        if not obj["caption"] and meta["title"]:
            obj["caption"] = meta["title"]
    except Exception as exc:
        obj["post_error"] = type(exc).__name__
    if platform == "instagram":
        m = re.search(r"/(?:p|reel)/([^/]+)", url)
        obj["shortcode"] = m.group(1) if m else ""
    return obj


def load_state():
    try:
        value = json.loads((ROOT / "data/event-crawler-state.json").read_text(encoding="utf-8"))
    except Exception:
        value = {}
    return value if isinstance(value, dict) else {}


def save_state(state):
    (ROOT / "data/event-crawler-state.json").write_text(
        json.dumps(state, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main():
    current = json.loads(EVENTS_FILE.read_text(encoding="utf-8")) if EVENTS_FILE.exists() else []
    state = load_state()
    all_events, total_discovered = [], 0
    for account in ACCOUNTS:
        previous = state.setdefault(account, {"instagram": [], "threads": []})
        seen_ig, seen_threads = set(previous.get("instagram", [])), set(previous.get("threads", []))
        discovered = {"instagram": [], "threads": []}
        instaloader_objects = {}
        il_posts = discover_instaloader(account)
        for item in il_posts:
            key = canonical_post("instagram", item["url"])
            if key:
                discovered["instagram"].append(item["url"])
                instaloader_objects[key[1]] = item
        print(f"IG_DISCOVERY instaloader @{account} posts={len(discovered['instagram'])}")
        html_ig = discover_from_profile("instagram", account)
        discovered["instagram"].extend(html_ig)
        print(f"IG_DISCOVERY html @{account} posts={len(html_ig)}")
        search_ig = search_post_urls("instagram", account)
        discovered["instagram"].extend(search_ig)
        print(f"IG_DISCOVERY search @{account} posts={len(search_ig)}")
        known_ig = known_post_urls("instagram", account)
        discovered["instagram"].extend(known_ig)
        print(f"IG_DISCOVERY known_urls @{account} posts={len(known_ig)}")

        html_threads = discover_from_profile("threads", account)
        discovered["threads"].extend(html_threads)
        print(f"THREADS_DISCOVERY html @{account} posts={len(html_threads)}")
        search_threads = search_post_urls("threads", account)
        discovered["threads"].extend(search_threads)
        print(f"THREADS_DISCOVERY search @{account} posts={len(search_threads)}")
        known_threads = known_post_urls("threads", account)
        discovered["threads"].extend(known_threads)
        print(f"THREADS_DISCOVERY known_urls @{account} posts={len(known_threads)}")

        unique = {}
        for platform in ("instagram", "threads"):
            for url in discovered[platform]:
                key = canonical_post(platform, url)
                if key:
                    unique[key] = (platform, url)
        total_discovered += len(unique)
        parsed_count = 0
        for key, (platform, url) in unique.items():
            already_seen = key[1] in (seen_ig if platform == "instagram" else seen_threads)
            if already_seen:
                continue
            post = fetch_post_object(platform, account, url, instaloader_objects.get(key[1]))
            caption = post.get("caption", "")
            if caption and account in PARSERS:
                parsed = PARSERS[account](caption)
                if parsed:
                    all_events.append(make_event(account, platform, url, post.get("image", ""), parsed))
                    parsed_count += 1
            if platform == "instagram":
                seen_ig.add(key[1])
            else:
                seen_threads.add(key[1])
        previous["instagram"] = sorted(seen_ig)
        previous["threads"] = sorted(seen_threads)
        print(f"STORE {account} discovered={len(unique)} parsed={parsed_count}")
    if total_discovered == 0:
        raise SystemExit("All four stores had zero public discovery rows across every source")
    merged = {}
    for event in current + all_events:
        key = (event.get("date"), event.get("host"), event.get("activity_type"))
        old = merged.get(key)
        if old is None or sum(bool(event.get(k)) for k in ("link", "img", "address")) > sum(bool(old.get(k)) for k in ("link", "img", "address")):
            merged[key] = event
    EVENTS_FILE.write_text(json.dumps(list(merged.values()), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    save_state(state)
    print(f"DIRECT REFRESH COMPLETE discovered_posts={total_discovered} parsed_events={len(all_events)}")
if __name__ == "__main__":
    main()
