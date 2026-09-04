from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "tools"))

from fetch_priority_store_events import parse_goddess, parse_hhpuppy, parse_jcl, parse_silbi


GIRLS = [
    {"realname": "韓志恩", "aliases": ["xanjieun"]},
    {"realname": "千昭允", "aliases": []},
    {"realname": "南和侖", "aliases": []},
    {"realname": "文慧真", "aliases": []},
    {"realname": "金娜賢", "aliases": []},
]


def row(account: str, caption: str, url: str = "https://www.instagram.com/p/TEST123/") -> dict:
    return {"ownerUsername": account, "caption": caption, "url": url, "displayUrl": "https://example.test/poster.jpg"}


def test_silbi_parser_uses_activity_info_date_and_ignores_ticket_sale():
    event = parse_silbi(row("silbi_house", """9月12日女神降臨
全州喜比食堂 特別邀請超人氣女神 — 韓志恩 @xanjieun
09/04 12:00開始購票
活動資訊
活動地點： 全州喜比食堂 (臺北市信義區吳興街 345 號)
活動時間： 2026.9.12 第一場下午2:10 開始進場/第二場 下午3:40 開始進場"""), "instagram", GIRLS)
    assert event["girls"] == "韓志恩"
    assert event["date"] == "2026/09/12"
    assert event["time"] == "14:10 / 15:40"
    assert event["address"] == "臺北市信義區吳興街345號"


def test_goddess_parser_uses_activity_date_not_registration_date_and_location_is_dynamic():
    event = parse_goddess(row("goddess._.meet", """三星獅2位女神「千昭允➕南和侖」來囉
跟千昭允還有南和侖一起吃美食簽名拍照！
報名方式：2026/8/24(一) 17:00 開放電話報名
活動時間：2026/9/14(一)
19:00-19:50 / 20:00-20:50
活動地點：TGI FRIDAYS 華泰餐廳
(桃園市中壢區青埔里春德路189號)
主辦單位：女神來見面"""), "threads", GIRLS)
    assert event["girls"] == "千昭允、南和侖"
    assert event["date"] == "2026/09/14"
    assert event["time"] == "19:00-19:50 / 20:00-20:50"
    assert event["venue"] == "TGI FRIDAYS 華泰餐廳"
    assert event["address"] == "桃園市中壢區青埔里春德路189號"


def test_hhpuppy_parser_keeps_total_time_and_accepts_publicly_listed_non_public_event():
    event = parse_hhpuppy(row("hhpuppy_studio", """💈歡迎光臨《心碎療癒室》💈
【 2026/9/26(六) 】16:00-18:00
今天の心碎療癒師✨女神「文慧真」
本活動為非公開活動
活動地址：
桃園市中壢區領航南路四段53號1F"""), "instagram", GIRLS)
    assert event["girls"] == "文慧真"
    assert event["date"] == "2026/09/26"
    assert event["time"] == "16:00-18:00"
    assert event["address"] == "桃園市中壢區領航南路四段53號1F"


def test_jcl_parser_only_uses_explicit_invited_girl_and_prefers_slots():
    event = parse_jcl(row("jcl700912", """板橋第一家卡店《一日店長》活動來囉!!
2026/9/12(六)PM2點~4點
特別邀請 金娜賢 擔任一日店長!!!
JC 妡0 娣奇 俐蓁
第一場14:00~14:50
第二場15:00~16:00
活動地址:
新北市板橋區文化路一段379號 3 樓"""), "threads", GIRLS)
    assert event["girls"] == "金娜賢"
    assert "JC" not in event["girls"]
    assert event["date"] == "2026/09/12"
    assert event["time"] == "14:00-14:50 / 15:00-16:00"
    assert event["address"] == "新北市板橋區文化路一段379號3樓"
