from __future__ import annotations

import csv
import hashlib
import html
import io
import json
import os
import re
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

SHEET_CSV = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vT9l-hRhzMwcRdyQHsRs_97fja0Gg4RCcDDMk31u-dSbbQmk_JIUmbPTAj2gaNYmb6bYTwUvv4_1IxN/"
    "pub?output=csv&gid=0"
)
SOURCES_FILE = Path("data/event-social-sources.json")
POSTS_FILE = Path("data/event-social-posts.json")
EVENTS_FILE = Path("data/auto-events.json")
TZ = timezone(timedelta(hours=8))
MAX_FUTURE_DAYS = 240

EVENT_TERMS = [
    "一日店長", "一日店員", "一日經理", "見面會", "粉絲見面會", "簽名會", "拍照會",
    "握手會", "合照會", "品牌活動", "品牌大使", "開幕活動", "站台", "商演", "快閃店",
    "快閃活動", "新品發表", "記者會", "活動嘉賓", "擔任嘉賓", "公開活動", "路跑",
    "應援活動", "粉絲活動", "派對",
]
CONTEXT_HINTS = ["活動", "現場", "報名", "登場", "出席", "來店", "見面", "合照", "簽名", "場次", "時間", "地點", "日期"]
TEXT_KEYS = {
    "caption", "captiontext", "text", "description", "title", "body", "content", "alt", "alttext",
    "accessibilitycaption", "message", "posttext", "rawtext",
}


def http_json(url: str, payload: dict | None = None, timeout: int = 300):
    data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": "TWCcheerleaderEventBot/5.0"},
        method="POST" if data is not None else "GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))


def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "zh-TW,zh;q=0.9"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def clean_alias(value: str) -> str:
    value = html.unescape(str(value or "")).strip()
    if not value:
        return ""
    if "instagram.com/" in value or "threads.com/" in value or "threads.net/" in value:
        m = re.search(r"/@?([A-Za-z0-9._-]+)", value)
        if m:
            value = m.group(1)
    return value.strip().lstrip("@").strip("/ ")


def load_girls() -> list[dict]:
    rows = csv.DictReader(io.StringIO(fetch_text(SHEET_CSV)))
    out, seen = [], set()
    alias_hints = ("nickname", "realname", "姓名", "綽號", "藝名", "ig", "instagram", "threads", "帳號", "英文", "english", "韓文", "korean")
    for row in rows:
        real = (row.get("realname") or row.get("姓名") or row.get("藝名") or row.get("nickname") or "").strip()
        nick = (row.get("nickname") or row.get("綽號") or row.get("藝名") or "").strip()
        image = (row.get("img") or row.get("image") or row.get("圖片") or "").strip()
        if not real or real.lower() in seen:
            continue
        seen.add(real.lower())
        aliases = {clean_alias(real), clean_alias(nick)}
        for key, value in row.items():
            kl = str(key or "").lower()
            if any(h in kl for h in alias_hints):
                for part in re.split(r"[,，、;/\s]+", str(value or "")):
                    a = clean_alias(part)
                    if len(a) >= 2:
                        aliases.add(a)
        out.append({"realname": real, "aliases": sorted(a for a in aliases if len(a) >= 2), "img": image})
    return out


def normalize_for_match(value: str) -> str:
    return re.sub(r"[\s@._\-·•]+", "", str(value or "")).lower()


def girl_matches(text: str, girls: list[dict]) -> list[dict]:
    raw = str(text or "")
    compact = normalize_for_match(raw)
    found = []
    for girl in girls:
        for alias in girl["aliases"]:
            norm = normalize_for_match(alias)
            if (alias and alias in raw) or (len(norm) >= 2 and norm in compact):
                found.append(girl)
                break
        if len(found) >= 12:
            break
    return found


def _collect_content(value, depth: int = 0) -> list[str]:
    if depth > 5:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    if isinstance(value, list):
        out = []
        for v in value[:50]:
            out.extend(_collect_content(v, depth + 1))
        return out
    if isinstance(value, dict):
        out = []
        for k, v in value.items():
            kl = str(k).lower().replace("_", "")
            if kl in TEXT_KEYS:
                out.extend(_collect_content(v, depth + 1))
            elif isinstance(v, (dict, list)) and kl in {"post", "media", "node", "data", "item"}:
                out.extend(_collect_content(v, depth + 1))
        return out
    return []


def post_text(item: dict) -> str:
    parts = _collect_content(item)
    if not parts:
        # Very conservative fallback: only known top-level textual fields, never scrape metadata values.
        for key in ("caption", "text", "description", "title", "body", "content", "postText"):
            v = item.get(key)
            if isinstance(v, str) and v.strip():
                parts.append(v)
    seen, clean = set(), []
    for p in parts:
        p = html.unescape(str(p)).strip()
        if p and p not in seen:
            seen.add(p)
            clean.append(p)
    return "\n".join(clean)


def find_event_term(text: str) -> str:
    return next((term for term in EVENT_TERMS if term in text), "")


def _event_term_positions(text: str) -> list[int]:
    pos = []
    for term in EVENT_TERMS:
        start = 0
        while True:
            i = text.find(term, start)
            if i < 0:
                break
            pos.append(i)
            start = i + len(term)
    return pos


def candidate_dates(text: str) -> list[tuple[datetime, int, str]]:
    now = datetime.now(TZ)
    patterns = [
        (re.compile(r"(?<!\d)(?P<y>20\d{2})(?P<m>\d{2})(?P<d>\d{2})(?!\d)"), "compact"),
        (re.compile(r"(?P<y>20\d{2})\s*[年/.-]\s*(?P<m>\d{1,2})\s*[月/.-]\s*(?P<d>\d{1,2})\s*日?"), "ymd"),
        (re.compile(r"(?<!\d)(?P<m>\d{1,2})\s*月\s*(?P<d>\d{1,2})\s*日"), "md_zh"),
        (re.compile(r"(?<!\d)(?P<m>\d{1,2})\s*[/.-]\s*(?P<d>\d{1,2})(?!\d)"), "md"),
    ]
    out = []
    for pat, kind in patterns:
        for m in pat.finditer(text):
            try:
                has_year = bool(m.groupdict().get("y"))
                year = int(m.groupdict().get("y") or now.year)
                dt = datetime(year, int(m.group("m")), int(m.group("d")), tzinfo=TZ)
                if dt < now - timedelta(days=1) and not has_year:
                    dt = dt.replace(year=year + 1)
                if now - timedelta(days=1) <= dt <= now + timedelta(days=MAX_FUTURE_DAYS):
                    out.append((dt, m.start(), kind))
            except Exception:
                pass
    # Dedupe same date/position patterns.
    uniq = {}
    for dt, pos, kind in out:
        uniq[(dt.date(), pos)] = (dt, pos, kind)
    return list(uniq.values())


def choose_event_date(text: str) -> datetime | None:
    candidates = candidate_dates(text)
    if not candidates:
        return None
    term_positions = _event_term_positions(text)
    if term_positions:
        # Prefer a date in the same local context as an event term instead of the earliest date globally.
        scored = []
        for dt, pos, kind in candidates:
            distance = min(abs(pos - tp) for tp in term_positions)
            explicit_bonus = 0 if kind in {"compact", "ymd", "md_zh"} else 25
            scored.append((distance + explicit_bonus, dt))
        scored.sort(key=lambda x: (x[0], x[1]))
        return scored[0][1]
    return sorted(c[0] for c in candidates)[0]


def extract_time(text: str) -> str:
    # Only called with caption/body text, so scrapedAt / createdAt cannot contaminate event time.
    patterns = [
        re.compile(r"(?:時間|活動時間|開始|入場|開場)?\s*[:：]?\s*(?<!\d)([01]?\d|2[0-3])\s*[:：]\s*(\d{2})(?!\d)"),
        re.compile(r"(上午|中午|下午|晚上)\s*(\d{1,2})(?:\s*[:：點]\s*(\d{1,2}))?"),
    ]
    m = patterns[0].search(text)
    if m:
        return f"{int(m.group(1)):02d}:{int(m.group(2)):02d}"
    m = patterns[1].search(text)
    if m:
        part, hour, minute = m.group(1), int(m.group(2)), int(m.group(3) or 0)
        if part in ("下午", "晚上") and hour < 12:
            hour += 12
        if part == "中午" and hour < 11:
            hour += 12
        return f"{hour:02d}:{minute:02d}"
    return "TBA"


def flatten_strings(value, depth: int = 0) -> list[str]:
    if depth > 5:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    if isinstance(value, dict):
        out = []
        for v in value.values():
            out.extend(flatten_strings(v, depth + 1))
        return out
    if isinstance(value, list):
        out = []
        for v in value[:50]:
            out.extend(flatten_strings(v, depth + 1))
        return out
    return []


def first_image(item: dict) -> str:
    candidates = []
    for key in ("displayUrl", "display_url", "imageUrl", "image_url", "thumbnailUrl", "thumbnail_url"):
        v = item.get(key)
        if isinstance(v, str) and v.startswith("http"):
            candidates.append(v)
    for s in flatten_strings(item):
        if isinstance(s, str) and s.startswith("http") and re.search(r"\.(?:jpg|jpeg|png|webp)(?:\?|$)", s, re.I):
            candidates.append(s)
    return candidates[0] if candidates else ""


def username_from_item(item: dict) -> str:
    for key in ("ownerUsername", "username", "owner_username", "authorUsername"):
        v = item.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip().lstrip("@")
    for key in ("owner", "author", "user"):
        v = item.get(key)
        if isinstance(v, dict):
            for sub in ("username", "handle"):
                if isinstance(v.get(sub), str) and v.get(sub).strip():
                    return v[sub].strip().lstrip("@")
    return ""


def post_url(item: dict, platform: str) -> str:
    for key in ("url", "postUrl", "post_url", "shortCodeUrl", "shortcodeUrl", "inputUrl"):
        v = item.get(key)
        if isinstance(v, str) and v.startswith("http"):
            return v
    code = item.get("shortCode") or item.get("shortcode") or item.get("code")
    account = username_from_item(item)
    if code and platform == "instagram":
        return f"https://www.instagram.com/p/{code}/"
    if code and platform == "threads" and account:
        return f"https://www.threads.net/@{account}/post/{code}"
    return ""


def _clean_name(name: str) -> str:
    name = re.sub(r"[#@]", "", str(name or ""))
    name = re.sub(r"\s+", " ", name).strip(" ~～—–-|｜,，。.!！?:：()（）[]【】✨")
    return name


def extract_context_names(text: str) -> list[str]:
    """Extract names from common commercial-event caption patterns.

    This is a fallback when the site roster aliases do not match. It intentionally only
    accepts names directly attached to strong event language, avoiding arbitrary nouns.
    """
    names = []
    patterns = [
        r"(?:一日店長|一日店員|一日經理)[~～：:\s]+([^\n#@，,。！!｜|]{1,24})",
        r"([^\n#@，,。！!｜|]{1,24})\s+(?:一日店長|一日店員|一日經理)",
        r"[×Xx]\s*([^×\n]{1,18})\s*[×Xx]\s*([^\n]{1,18})\s+(?:一日店長|一日店員|一日經理)",
        r"(?:邀請|特別邀請|女神)[^—\n]{0,20}[—-]\s*([^，,。\n]{1,36})[，,]\s*化身為[「\"]?(?:一日店長|一日店員)",
    ]
    for pat in patterns:
        for m in re.finditer(pat, text, re.I):
            for group in m.groups():
                if not group:
                    continue
                # Split paired names such as 娜比 與 Wendy / A、B / A & B.
                parts = re.split(r"\s*(?:與|和|及|、|&|＆|\+|×)\s*", group)
                for part in parts:
                    part = _clean_name(part)
                    # Strip obvious brand/preamble words and Korean parenthetical duplicates.
                    part = re.sub(r"^(?:ASKIN保溫瓶專家|ASKIN|女神|超人氣女神)\s*", "", part, flags=re.I)
                    part = re.sub(r"\s+[가-힣]{2,}$", "", part)
                    if 1 < len(part) <= 20 and not any(x in part for x in ("圓滿落幕", "活動", "現場", "料理派對", "保溫瓶", "專家")):
                        names.append(part)
    # Captions often include a direct profile mention right after the name; retain handle as a last-resort identity.
    for handle in re.findall(r"@([A-Za-z0-9._]{3,})", text):
        if handle not in names:
            names.append("@" + handle)
    seen, result = set(), []
    for name in names:
        key = normalize_for_match(name)
        if key and key not in seen:
            seen.add(key)
            result.append(name)
    return result[:6]


def resolve_girl_names(text: str, girls: list[dict]) -> tuple[list[str], list[dict]]:
    matched = girl_matches(text, girls)
    if matched:
        return [g["realname"] for g in matched], matched
    extracted = extract_context_names(text)
    # If extracted text itself maps to a roster alias, canonicalize it.
    canonical = []
    matched_objs = []
    for name in extracted:
        m = girl_matches(name, girls)
        if m:
            for g in m:
                if g["realname"] not in canonical:
                    canonical.append(g["realname"])
                    matched_objs.append(g)
        elif not name.startswith("@") and name not in canonical:
            canonical.append(name)
    return canonical, matched_objs


def clean_event_title(text: str, term: str, names: list[str], event_dt: datetime) -> str:
    lines = [re.sub(r"\s+", " ", x).strip(" -|｜") for x in text.splitlines() if x.strip()]
    for line in lines:
        if len(line) <= 130 and term in line:
            return line
    return f"{'、'.join(names[:4]) if names else '公開活動'} {term}｜{event_dt.month}/{event_dt.day}"


def build_event(item: dict, platform: str, girls: list[dict], stats: dict) -> dict | None:
    if item.get("error"):
        stats["actor_error"] += 1
        return None
    if platform == "threads" and (item.get("itemType") == "profile" or item.get("isReply") is True):
        stats["non_post"] += 1
        return None

    text = post_text(item)
    if not text:
        stats["no_text"] += 1
        return None

    term = find_event_term(text)
    if not term:
        stats["no_event_signal"] += 1
        return None

    event_dt = choose_event_date(text)
    if not event_dt:
        stats["no_date"] += 1
        return None

    names, matched_objs = resolve_girl_names(text, girls)
    mapped_raw = str(item.get("_mapped_girls") or "").strip()
    if mapped_raw:
        names = [x for x in re.split(r"[、,，;/]+", mapped_raw) if x.strip()]
    if not names:
        stats["no_girl"] += 1
        return None

    event_time = extract_time(text)
    account = username_from_item(item)
    title = clean_event_title(text, term, names, event_dt)
    image = first_image(item) or next((g["img"] for g in matched_objs if g.get("img")), "")
    url = post_url(item, platform)
    signature = f"{event_dt:%Y/%m/%d}|{event_time}|{platform}|{account.lower()}|{term}|{'、'.join(names)}"
    uid = hashlib.sha1((signature + "|" + url).encode("utf-8")).hexdigest()[:16]
    stats["accepted"] += 1
    return {
        "id": f"auto-event-apify-{uid}",
        "date": event_dt.strftime("%Y/%m/%d"),
        "time": event_time,
        "girls": "、".join(names),
        "eventname": title,
        "host": f"@{account}" if account else "",
        "address": "詳見原始活動貼文",
        "note": f"自動發現來源：{platform}。活動日期與人物以貼文正文解析；細節請以原始貼文最新公告為準。",
        "img": image,
        "link": url,
        "source": f"{platform} @{account}" if account else platform,
        "activity_type": term,
        "activity_signature": signature,
        "needs_girl_review": False,
        "auto": True,
    }


def apify_sync(actor: str, payload: dict, token: str) -> list[dict]:
    actor_id = actor.replace("/", "~")
    url = f"https://api.apify.com/v2/acts/{actor_id}/run-sync-get-dataset-items?token={urllib.parse.quote(token)}&clean=true"
    result = http_json(url, payload=payload, timeout=300)
    return result if isinstance(result, list) else []


def normalize_threads_url(url: str) -> str:
    url = url.replace("threads.com", "threads.net")
    m = re.search(r"threads\.net/share/([A-Za-z0-9_-]+)", url)
    if m:
        return f"https://www.threads.net/t/{m.group(1)}"
    return url
