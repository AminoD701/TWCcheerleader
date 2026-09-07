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


def test_known_roster_name_is_valid_context_without_cheer_word():
    news.SAFE_ROSTER_NAMES = ["安娜"]
    news.SITE_TEAMS = []
    assert news.has_roster_context("安娜分享近期生活近況", "接受媒體專訪")


def test_generic_goddess_story_does_not_pass_context_gate():
    news.SAFE_ROSTER_NAMES = ["安娜"]
    news.SITE_TEAMS = ["Fubon Angels"]
    assert not news.has_strict_cheer_context("夏日女神穿搭推薦", "盤點本季流行服飾")
    assert not news.has_roster_context("夏日女神穿搭推薦", "盤點本季流行服飾")
