from __future__ import annotations

import re
from datetime import datetime

import run_event_fetch as legacy

platform = legacy.platform

_original_strict_event_date = platform.strict_event_date
_original_build_event = platform.build_event


def _silbi_activity_block(text: str) -> str:
    m = re.search(r"📍\s*活動資訊(?P<body>[\s\S]{0,700})", text)
    return m.group("body") if m else text


def _silbi_date(text: str):
    if "全州喜比食堂" not in text and "女神降臨" not in text:
        return None
    block = _silbi_activity_block(text)
    m = re.search(
        r"活動時間\s*[:：]\s*(20\d{2})\s*[./／-]\s*(\d{1,2})\s*[./／-]\s*(\d{1,2})",
        block,
    )
    if not m:
        return None
    try:
        return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=platform.TZ)
    except ValueError:
        return None


def strict_event_date(text: str):
    dt = _silbi_date(text)
    if dt:
        return dt
    return _original_strict_event_date(text)


def _silbi_times(text: str) -> str:
    block = _silbi_activity_block(text)
    m = re.search(
        r"活動時間\s*[:：][^\n]*?第一場\s*(?:下午|上午|晚上)?\s*(\d{1,2}:\d{2})[^\n/]*[/／]\s*第二場\s*(?:下午|上午|晚上)?\s*(\d{1,2}:\d{2})",
        block,
    )
    if not m:
        return ""

    def normalize(hm: str, marker_text: str) -> str:
        hour, minute = [int(x) for x in hm.split(":", 1)]
        if "下午" in marker_text or "晚上" in marker_text:
            if hour < 12:
                hour += 12
        return f"{hour:02d}:{minute:02d}"

    first_seg = m.group(0).split("/")[0]
    second_seg = m.group(0).split("/")[-1]
    return f"{normalize(m.group(1), first_seg)} / {normalize(m.group(2), second_seg)}"


def _silbi_location(text: str) -> tuple[str, str]:
    block = _silbi_activity_block(text)
    m = re.search(r"活動地點\s*[:：]\s*([^\n(（]+)\s*[（(]([^）)]+)[）)]", block)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    m = re.search(r"活動地點\s*[:：]\s*([^\n]+)", block)
    if m:
        return m.group(1).strip(), ""
    return "全州喜比食堂", ""


def build_event(item: dict, platform_name: str, girls: list[dict], stats: dict):
    event = _original_build_event(item, platform_name, girls, stats)
    if not event:
        return event

    if legacy._is_silbi_row(item):
        text = platform.clean_post_body(item)
        venue, address = _silbi_location(text)
        slots = _silbi_times(text)
        event["host"] = "全州喜比食堂"
        event["organizer"] = "全州喜比食堂"
        event["venue"] = venue or "全州喜比食堂"
        if address:
            event["address"] = address
        elif venue:
            event["address"] = venue
        if slots:
            event["time"] = slots
        event["activity_type"] = "一日店長"
        event["note"] = "主辦：全州喜比食堂。活動日期、地點與各場進場時間以貼文『📍 活動資訊』區塊為最高優先。購票開始時間不作為活動日期。"
    return event


platform.strict_event_date = strict_event_date
platform.build_event = build_event


if __name__ == "__main__":
    platform.main()
