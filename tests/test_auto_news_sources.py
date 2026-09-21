from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parents[1] / "tools"))

import fetch_auto_news as core
import run_auto_news as news


def test_source_queries_remain_curated():
    assert "site:setn.com 啦啦隊" in core.BASE_QUERIES
    assert "site:ctwant.com 啦啦隊" in core.BASE_QUERIES
    assert "site:today.line.me 中職 CPBL" in core.BASE_QUERIES


def test_bare_short_roster_name_is_not_enough():
    result = news.strict_classify_news(
        "喬喬護理師分享工作日常",
        "醫院輪班生活",
        ["喬喬"],
        [],
    )
    assert result is None


def test_cheer_context_allows_roster_person_story():
    result = news.strict_classify_news(
        "啦啦隊女孩喬喬分享近況",
        "Fubon Angels 成員接受專訪",
        ["喬喬"],
        ["Fubon Angels"],
    )
    assert result == ("啦啦隊情報", "喬喬")


def test_topic_style_unrelated_page_is_rejected():
    result = news.strict_classify_news(
        "喬喬護理師相關報導",
        "三立新聞幫您整理護理師新聞懶人包",
        ["喬喬"],
        [],
    )
    assert result is None


def test_ambiguous_team_word_does_not_create_fake_sports_story():
    result = news.strict_classify_news(
        "陳時中談兄弟情誼與近況",
        "人物專訪分享生活",
        [],
        [],
    )
    assert result is None


def test_political_context_is_rejected():
    result = news.strict_classify_news(
        "立委談中信兄弟新球季",
        "政治人物受訪分享看法",
        [],
        [],
    )
    assert result is None


def test_real_sports_context_still_passes():
    result = news.strict_classify_news(
        "中職／中信兄弟擊敗味全龍",
        "棒球賽事最新戰況",
        [],
        [],
    )
    assert result == ("棒球情報", "中職")


def test_same_story_with_small_title_variation_is_duplicate():
    a = "YURI才任創隊隊長！巫苡萱嗨曝新身份 「九天璇女」也驚喜加入"
    b = "YURI才任創隊隊長！巫苡萱嗨曝新身份「九天璇女」也驚喜加入| 星聞"
    assert core.title_similarity(a, b) >= core.NEAR_DUPLICATE_RATIO


def test_different_stories_are_not_duplicates():
    a = "富邦悍將啦啦隊安娜達成校花三連霸"
    b = "樂天女孩Rina推出首本個人寫真"
    assert core.title_similarity(a, b) < core.NEAR_DUPLICATE_RATIO


def test_generic_goddess_fashion_story_does_not_pass():
    result = news.strict_classify_news(
        "夏日女神穿搭推薦",
        "盤點本季流行服飾",
        ["安娜"],
        [],
    )
    assert result is None


def test_numeric_spreadsheet_value_is_not_a_girl_name():
    assert not news.safe_usable_girl_name("50萬")
