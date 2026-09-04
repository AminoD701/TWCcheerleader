from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parents[1] / "tools"))

from fetch_priority_stores_direct import parse_public_html


def test_instagram_public_meta_is_normalized_to_row():
    row = parse_public_html(
        "https://www.instagram.com/p/ABC123/",
        """<html><head>
        <meta property="og:title" content="silbi_house on Instagram">
        <meta property="og:description" content="9月12日女神降臨\n特別邀請超人氣女神 — 韓志恩 @xanjieun">
        <meta property="og:image" content="https://cdn.test/ig.jpg">
        </head></html>""",
    )
    assert row["url"].endswith("/ABC123/")
    assert "韓志恩" in row["caption"]
    assert row["image"] == "https://cdn.test/ig.jpg"


def test_threads_public_meta_is_normalized_to_row():
    row = parse_public_html(
        "https://www.threads.com/@silbi_house/post/XYZ789",
        """<meta property="og:title" content="全州喜比食堂">
        <meta property="og:description" content="活動時間：2026.9.12 第一場下午2:10">
        <meta property="og:image" content="https://cdn.test/threads.jpg">""",
    )
    assert row["url"].endswith("/XYZ789")
    assert row["caption"].startswith("活動時間：2026.9.12")
    assert row["image"] == "https://cdn.test/threads.jpg"
