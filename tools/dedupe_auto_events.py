from __future__ import annotations

import json
import re
from pathlib import Path

EVENTS_FILE = Path("data/auto-events.json")


def norm(value: str) -> str:
    return re.sub(r"[\s\W_]+", "", str(value or "")).lower()


def norm_time(value: str) -> str:
    value = str(value or "TBA").strip().replace("：", ":")
    m = re.fullmatch(r"(\d{1,2}):(\d{2})", value)
    if m:
        return f"{int(m.group(1)):02d}:{m.group(2)}"
    return value.upper() or "TBA"


def split_girls(value: str) -> list[str]:
    return [x.strip() for x in re.split(r"[、,，/]+", str(value or "")) if x.strip()]


def merge_girls(a: str, b: str) -> str:
    seen = set()
    out = []
    for name in split_girls(a) + split_girls(b):
        if name not in seen:
            seen.add(name)
            out.append(name)
    return "、".join(out)


def event_key(item: dict) -> tuple[str, str, str]:
    date = str(item.get("date", "")).strip()
    time = norm_time(item.get("time", "TBA"))

    # Apify records carry a stable activity signature based on activity type + host.
    # This lets an Instagram caption and a Threads caption for the same activity merge
    # even when their wording is not identical.
    signature = str(item.get("activity_signature", "")).strip()
    if signature:
        parts = signature.split("|")
        activity = "|".join(parts[2:]) if len(parts) >= 4 else signature
        return (date, time, norm(activity))

    activity_type = norm(item.get("activity_type", ""))
    host = norm(item.get("host", ""))
    if activity_type and host:
        return (date, time, f"{activity_type}|{host}")

    # Legacy/manual-like auto records fall back to the visible activity title.
    return (date, time, norm(item.get("eventname", "")))


def completeness(item: dict) -> int:
    score = 0
    for field in ("img", "link", "address", "host", "note", "girls"):
        value = str(item.get(field, "")).strip()
        if value and value not in ("詳見官方公告", "TBA"):
            score += 1
    return score


def main() -> None:
    if not EVENTS_FILE.exists():
        return
    items = json.loads(EVENTS_FILE.read_text(encoding="utf-8"))
    merged: dict[tuple[str, str, str], dict] = {}
    order: list[tuple[str, str, str]] = []

    for item in items:
        key = event_key(item)
        if not all(key):
            continue
        if key not in merged:
            merged[key] = dict(item)
            merged[key]["time"] = norm_time(item.get("time", "TBA"))
            order.append(key)
            continue

        old = merged[key]
        better, other = (item, old) if completeness(item) > completeness(old) else (old, item)
        combined = dict(better)
        combined["girls"] = merge_girls(old.get("girls", ""), item.get("girls", ""))
        for field in ("img", "link", "address", "host", "note", "source", "activity_type", "activity_signature"):
            if not str(combined.get(field, "")).strip():
                combined[field] = other.get(field, "")
        combined["auto"] = bool(old.get("auto") or item.get("auto"))
        merged[key] = combined

    out = [merged[k] for k in order]
    out.sort(key=lambda x: (x.get("date", "9999/99/99"), norm_time(x.get("time", "TBA")), norm(x.get("eventname", ""))))
    EVENTS_FILE.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"deduped {len(items)} events to {len(out)} events")


if __name__ == "__main__":
    main()
