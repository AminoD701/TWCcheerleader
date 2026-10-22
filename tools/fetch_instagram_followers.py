from __future__ import annotations

import csv
import html
import io
import json
import os
import random
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

SHEET_CSV = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vT9l-hRhzMwcRdyQHsRs_97fja0Gg4RCcDDMk31u-dSbbQmk_JIUmbPTAj2gaNYmb6bYTwUvv4_1IxN/"
    "pub?output=csv&gid=0"
)
OUT_PATH = Path("data/instagram-followers.json")
TW = timezone(timedelta(hours=8))
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/155.0 Safari/537.36",
]

def fetch_text(url: str, timeout: int = 25) -> str:
    req = urllib.request.Request(url, headers={
        "User-Agent": random.choice(USER_AGENTS),
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.7",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Cache-Control": "no-cache",
    })
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")

def username_from_ig(value: str) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""
    if raw.startswith("@"):
        return raw[1:].strip().lower()
    try:
        parsed = urllib.parse.urlparse(raw if "://" in raw else "https://" + raw)
        if "instagram.com" not in parsed.netloc.lower():
            return ""
        username = parsed.path.strip("/").split("/")[0]
    except Exception:
        return ""
    return "" if username.lower() in {"p","reel","stories","explore"} else username.lower()

def is_active(row: dict[str, str]) -> bool:
    if (row.get("departure_season") or row.get("departureseason") or "").strip():
        return False
    if re.search(r"已離隊|離隊|已退隊|退隊|不續約|前成員", (row.get("note") or "").strip()):
        return False
    return (row.get("team") or "").strip() != "Little Witches"

def parse_compact_number(raw: str) -> int | None:
    value = html.unescape((raw or "").strip()).replace(",", "").replace(" ", "")
    m = re.fullmatch(r"([0-9]+(?:\.[0-9]+)?)([KMB萬億]?)", value, flags=re.I)
    if not m:
        return None
    factor = {"":1,"K":1000,"M":1000000,"B":1000000000,"萬":10000,"億":100000000}.get(m.group(2).upper(),1)
    return int(round(float(m.group(1)) * factor))

def fetch_profile_api(username: str) -> int | None:
    urls = [
        f"https://i.instagram.com/api/v1/users/web_profile_info/?username={urllib.parse.quote(username)}",
        f"https://www.instagram.com/api/v1/users/web_profile_info/?username={urllib.parse.quote(username)}",
    ]
    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "*/*",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.7",
        "X-IG-App-ID": "936619743392459",
        "Referer": f"https://www.instagram.com/{username}/",
    }
    last_error = None
    for url in urls:
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=20) as resp:
                body = resp.read().decode("utf-8", errors="replace")
            payload = json.loads(body)
            user = (payload.get("data") or {}).get("user") or {}
            for key in ("edge_followed_by",):
                node = user.get(key) or {}
                if isinstance(node.get("count"), int):
                    return int(node["count"])
            for key in ("follower_count", "followers_count"):
                if isinstance(user.get(key), int):
                    return int(user[key])
            last_error = ValueError("profile API returned no follower count")
        except Exception as exc:
            last_error = exc
    if last_error:
        raise last_error
    return None

def parse_followers(page: str) -> int | None:
    for pattern in [
        r'"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)',
        r'"follower_count"\s*:\s*(\d+)',
        r'"followers_count"\s*:\s*(\d+)',
        r'"followers"\s*:\s*\{\s*"count"\s*:\s*(\d+)',
    ]:
        m = re.search(pattern, page, flags=re.I)
        if m:
            return int(m.group(1))
    for meta in re.findall(r'<meta[^>]+content=["\']([^"\']+)["\']', page, flags=re.I):
        text = html.unescape(meta)
        m = re.search(r'([0-9][0-9,.]*\s*[KMB萬億]?)\s*(?:Followers|位追蹤者|追蹤者)', text, flags=re.I)
        if m:
            value = parse_compact_number(m.group(1))
            if value is not None:
                return value
    return None

def load_previous() -> dict:
    try:
        data = json.loads(OUT_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {"profiles":{}}
    except Exception:
        return {"profiles":{}}

def main() -> None:
    rows = list(csv.DictReader(io.StringIO(fetch_text(SHEET_CSV))))
    test_limit = int(os.environ.get("IG_TEST_LIMIT", "0") or "0")
    targets, seen = [], set()
    for row in rows:
        if not is_active(row):
            continue
        username = username_from_ig(row.get("ig") or "")
        if not username or username in seen:
            continue
        seen.add(username)
        targets.append({
            "username": username,
            "ig": (row.get("ig") or "").strip(),
            "realName": (row.get("realName") or row.get("realname") or "").strip(),
            "nickname": (row.get("nickname") or "").strip(),
            "team": (row.get("team") or "").strip(),
        })
        if test_limit and len(targets) >= test_limit:
            break

    previous = load_previous()
    old_profiles = previous.get("profiles") if isinstance(previous.get("profiles"), dict) else {}
    now = datetime.now(TW).isoformat(timespec="seconds")
    profiles, success, failed = {}, 0, 0

    for idx, target in enumerate(targets, 1):
        username = target["username"]
        old = old_profiles.get(username) if isinstance(old_profiles, dict) else None
        try:
            try:
                followers = fetch_profile_api(username)
            except Exception as api_exc:
                followers = parse_followers(fetch_text(f"https://www.instagram.com/{username}/", 20))
                if followers is None:
                    raise ValueError(f"API+HTML failed: {api_exc}")
            if followers is None:
                raise ValueError("follower count not found")
            profiles[username] = {**target, "followers": followers, "lastSuccess": now, "status":"ok"}
            success += 1
            print(f"[{idx}/{len(targets)}] {username}: {followers}")
        except Exception as exc:
            failed += 1
            if isinstance(old, dict) and isinstance(old.get("followers"), int):
                profiles[username] = {**target, "followers": old["followers"], "lastSuccess": old.get("lastSuccess",""), "status":"stale", "lastError":str(exc)[:160]}
            else:
                profiles[username] = {**target, "followers": None, "lastSuccess":"", "status":"unavailable", "lastError":str(exc)[:160]}
            print(f"[{idx}/{len(targets)}] {username}: {profiles[username]['status']} ({exc})")
        if idx < len(targets):
            time.sleep(random.uniform(1.4, 2.8))

    ranking = [
        {"username":u,"followers":p["followers"],"realName":p.get("realName",""),"nickname":p.get("nickname",""),"team":p.get("team",""),"ig":p.get("ig","")}
        for u,p in profiles.items() if isinstance(p.get("followers"), int)
    ]
    ranking.sort(key=lambda x: x["followers"], reverse=True)
    payload = {
        "updatedAt": now,
        "source": "instagram-public-page",
        "note": "Best-effort public-page snapshot. Failed profiles keep their previous successful count.",
        "profileCount": len(targets),
        "successCount": success,
        "failedCount": failed,
        "profiles": profiles,
        "ranking": ranking,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(targets)} profiles; success={success}, failed={failed}")

if __name__ == "__main__":
    main()
