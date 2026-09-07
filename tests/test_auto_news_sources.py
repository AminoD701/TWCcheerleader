from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parents[1] / "tools"))

import run_auto_news as news


def test_entertainment_domains_include_recent_missing_publishers():
    assert "ttshow.tw" in news.ENTERTAINMENT_DOMAINS
    assert "setn.com" in news.ENTERTAINMENT_DOMAINS
    assert "storm.mg" in news.ENTERTAINMENT_DOMAINS


def test_build_queries_adds_source_level_scans():
    queries = news.build_expanded_queries(["安娜", "李珠珢"], ["Fubon Angels"])
    assert 'site:ttshow.tw (啦啦隊 OR 應援 OR "啦啦隊女神" OR "應援女孩" OR "應援女神")' in queries
    assert 'site:setn.com (啦啦隊 OR 應援 OR "啦啦隊女神" OR "應援女孩" OR "應援女神")' in queries
    assert 'site:storm.mg (啦啦隊 OR 應援 OR "啦啦隊女神" OR "應援女孩" OR "應援女神")' in queries


def test_bare_roster_name_is_not_enough_for_personality_story():
    news.SAFE_ROSTER_NAMES = ["喬喬"]
    news.SITE_TEAMS = []
    assert news.has_roster_context("喬喬護理師分享工作日常", "醫院輪班生活")
    assert not news.has_safe_person_context("喬喬護理師分享工作日常", "醫院輪班生活")


def test_cheer_context_allows_roster_person_story():
    news.SAFE_ROSTER_NAMES = ["喬喬"]
    news.SITE_TEAMS = ["Fubon Angels"]
    assert news.has_safe_person_context("啦啦隊女孩喬喬分享近況", "Fubon Angels 成員接受專訪")


def test_index_and_topic_pages_are_rejected():
    assert news.looks_like_index_page("喬喬護理師相關報導", "三立新聞幫您整理新聞懶人包")


def test_ambiguous_team_word_does_not_create_fake_sports_story():
    news.SAFE_ROSTER_NAMES = []
    news.SITE_TEAMS = []
    result = news.strict_classify_news("陳時中談兄弟情誼與近況", "人物專訪分享生活", [], [])
    assert result is None


def test_real_sports_context_still_passes():
    result = news.strict_classify_news("中職／中信兄弟擊敗味全龍", "棒球賽事最新戰況", [], [])
    assert result == ("棒球情報", "中職")


def test_same_setn_story_with_small_title_variation_is_duplicate():
    a = "YURI才任創隊隊長！巫苡萱嗨曝新身份 「九天璇女」也驚喜加入"
    b = "YURI才任創隊隊長！巫苡萱嗨曝新身份「九天璇女」也驚喜加入| 星聞"
    assert news.titles_are_near_duplicates(a, b)


def test_different_stories_are_not_deduped():
    assert not news.titles_are_near_duplicates(
        "富邦悍將啦啦隊安娜達成校花三連霸",
        "樂天女孩Rina推出首本個人寫真",
    )


def test_generic_goddess_story_does_not_pass_context_gate():
    news.SAFE_ROSTER_NAMES = ["安娜"]
    news.SITE_TEAMS = ["Fubon Angels"]
    assert not news.has_strict_cheer_context("夏日女神穿搭推薦", "盤點本季流行服飾")
    assert not news.has_roster_context("夏日女神穿搭推薦", "盤點本季流行服飾")
