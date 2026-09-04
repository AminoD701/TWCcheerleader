from __future__ import annotations

import re
from datetime import datetime


def install(platform) -> None:
    """Install deterministic rules for jcl700912 / 板橋第一家卡店."""
    prev_primary = platform.primary_girls_for_row
    prev_build = platform.build_event
    prev_strict_date = platform.strict_event_date

    def is_jcl_row(row: dict) -> bool:
        account = platform.normalize_account(platform.username_from_item(row))
        body = platform.clean_post_body(row)
        return account == "jcl700912" or "板橋第一家卡店" in body

    def jcl_girl(row: dict, girls: list[dict]) -> list[str]:
        text = platform.clean_post_body(row)
        patterns = [
            r"特別邀請\s*([^\s，,。！!\n]{2,16})\s*擔任\s*一日店長",
            r"邀請\s*([^\s，,。！!\n]{2,16})\s*擔任\s*一日店長",
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
        if is_jcl_row(row):
            featured = jcl_girl(row, girls)
            if featured:
                return featured, "jcl_featured_girl"
        return prev_primary(row, platform_name, girls, source_mapping, explicit_mapping)

    def strict_event_date(text: str):
        if "板橋第一家卡店" in text or "擔任一日店長" in text:
            m = re.search(
                r"(?<!\d)(20\d{2})\s*[/／.\-]\s*(\d{1,2})\s*[/／.\-]\s*(\d{1,2})(?:\([^)]*\)|（[^）]*）)?\s*(?:PM|下午)?\s*\d{1,2}\s*(?:點|:)",
                text,
                re.I,
            )
            if not m:
                m = re.search(
                    r"(?<!\d)(20\d{2})\s*[/／.\-]\s*(\d{1,2})\s*[/／.\-]\s*(\d{1,2})(?:\([^)]*\)|（[^）]*）)?",
                    text,
                )
            if m:
                try:
                    return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=platform.TZ)
                except ValueError:
                    pass
        return prev_strict_date(text)

    def parse_hour(raw: str, pm: bool = False) -> int:
        hour = int(raw)
        if pm and hour < 12:
            hour += 12
        return hour

    def jcl_time(text: str) -> str:
        # Prefer explicit per-session times because they are more precise.
        m1 = re.search(r"第一場\s*(\d{1,2}):(\d{2})\s*[-–~～]\s*(\d{1,2}):(\d{2})", text)
        m2 = re.search(r"第二場\s*(\d{1,2}):(\d{2})\s*[-–~～]\s*(\d{1,2}):(\d{2})", text)
        if m1 and m2:
            a = f"{int(m1.group(1)):02d}:{m1.group(2)}-{int(m1.group(3)):02d}:{m1.group(4)}"
            b = f"{int(m2.group(1)):02d}:{m2.group(2)}-{int(m2.group(3)):02d}:{m2.group(4)}"
            return f"{a} / {b}"

        m = re.search(r"(?:PM|下午)\s*(\d{1,2})\s*點\s*[-–~～]\s*(\d{1,2})\s*點", text, re.I)
        if m:
            start = parse_hour(m.group(1), True)
            end = parse_hour(m.group(2), True)
            return f"{start:02d}:00-{end:02d}:00"
        return ""

    def jcl_address(text: str) -> str:
        m = re.search(r"活動地址\s*[:：]\s*\n?\s*([^\n]+)", text)
        if not m:
            return ""
        addr = m.group(1).strip()
        addr = re.sub(r"\s+", "", addr)
        return addr

    def build_event(item: dict, platform_name: str, girls: list[dict], stats: dict):
        event = prev_build(item, platform_name, girls, stats)
        if not event or not is_jcl_row(item):
            return event

        text = platform.clean_post_body(item)
        event["host"] = "板橋第一家卡店"
        event["organizer"] = "板橋第一家卡店"
        event["venue"] = "板橋第一家卡店"
        event["activity_type"] = "一日店長"
        event["eventname"] = "板橋第一家卡店｜一日店長"

        slots = jcl_time(text)
        if slots:
            event["time"] = slots

        address = jcl_address(text)
        if address:
            event["address"] = address

        event["note"] = "主辦：板橋第一家卡店。日期以活動抬頭為準；出席女孩只認『特別邀請 XXX 擔任一日店長』；時間優先採各場次資訊。"
        return event

    platform.primary_girls_for_row = primary_girls_for_row
    platform.strict_event_date = strict_event_date
    platform.build_event = build_event
