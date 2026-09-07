from __future__ import annotations

import re

import fetch_auto_news as core

# Strict relevance layer for the public news feed.
# Source allow-listing happens in fetch_auto_news.py; this file adds topic-level
# gates so politics, finance, fashion and keyword collisions cannot enter merely
# because they were published by an allowed outlet.

POLITICAL_TERMS = (
    "總統", "副總統", "行政院", "立法院", "立委", "議員", "市長", "縣長",
    "政黨", "民進黨", "國民黨", "民眾黨", "時代力量", "選舉", "罷免", "公投",
    "國會", "內閣", "黨團", "政治獻金", "兩岸", "國安", "外交部", "國防部",
    "賴清德", "蕭美琴", "柯文哲", "黃國昌", "朱立倫", "盧秀燕", "蔣萬安",
)

OFF_TOPIC_TITLE_TERMS = (
    "股市", "台股", "美股", "ETF", "房市", "房價", "匯率", "理財", "投資",
    "財報", "營收", "科技股", "AI伺服器", "手機評測", "3C", "星座", "命理",
    "穿搭", "必買", "購物", "精品", "球帽", "棒球帽", "手袋", "包包",
)

CHEER_SUPPORT_TERMS = (
    "啦啦隊", "應援", "女孩", "女神", "成員", "隊長", "練習生", "舞蹈",
    "球場", "主場", "球迷", "粉絲", "球隊", "職棒", "中職", "職籃", "職排",
    "開球", "寫真", "見面會", "一日店長", "活動", "退役", "加盟", "離隊",
)

SPORT_ACTION_TERMS = (
    "比賽", "賽事", "先發", "登板", "投手", "打者", "球員", "教練", "球隊",
    "全壘打", "安打", "打點", "三振", "完封", "勝投", "敗投", "得分", "比分",
    "連勝", "連敗", "封王", "季後賽", "總冠軍", "冠軍", "晉級", "淘汰",
    "交易", "簽約", "加盟", "續約", "傷退", "受傷", "復出", "紀錄", "MVP",
    "球季", "開幕戰", "明星賽", "延長賽", "再見", "國家隊", "經典賽",
)

STRICT_SPORT_RULES = (
    ("棒球情報", "MLB", (
        "MLB", "大聯盟", "洛杉磯道奇", "道奇", "紐約洋基", "洋基",
        "大谷翔平", "鄧愷威", "鈴木誠也", "今永昇太", "菊池雄星",
    )),
    ("棒球情報", "中職", (
        "CPBL", "中華職棒", "中職", "中信兄弟", "統一獅", "樂天桃猿",
        "味全龍", "富邦悍將", "台鋼雄鷹",
    )),
    ("籃球情報", "TPBL", (
        "TPBL", "台灣職業籃球大聯盟", "新北國王", "福爾摩沙夢想家",
        "高雄全家海神", "新竹御嵿攻城獅", "臺北台新戰神",
        "桃園台啤永豐雲豹", "新北中信特攻",
    )),
    ("籃球情報", "PLG", (
        "P. LEAGUE+", "P.LEAGUE+", "PLG", "台北富邦勇士", "桃園璞園領航猿",
    )),
    ("排球情報", "TVBL", (
        "TVBL", "TPVL", "台灣職業排球聯盟", "職排", "職業排球",
    )),
)


def contains_any(text: str, terms: tuple[str, ...] | list[str]) -> bool:
    value = (text or "").lower()
    return any(term.lower() in value for term in terms)


def has_political_context(title: str, desc: str) -> bool:
    return contains_any(f"{title} {desc}", POLITICAL_TERMS)


def girl_is_in_title(name: str, title: str) -> bool:
    try:
        return core.girl_name_matches(name, title)
    except Exception:
        return bool(name and name.lower() in (title or "").lower())


def strict_cheer_context(
    title: str,
    desc: str,
    matched_girls: list[str],
    matched_teams: list[str] | None = None,
) -> bool:
    if has_political_context(title, desc):
        return False

    hay = f"{title} {desc}"
    if contains_any(hay, tuple(core.CHEER_TERMS)):
        return True

    title_girls = [name for name in matched_girls if girl_is_in_title(name, title)]
    if not title_girls:
        return False

    # A long/exact roster name in the headline is a strong signal for individual
    # entertainment stories. Short aliases such as 小安 need an extra cheer cue to
    # avoid collisions with unrelated people.
    strong_name = any(
        (len(re.sub(r"\s+", "", name)) >= 3 if core.is_cjk_name(name) else len(name) >= 4)
        for name in title_girls
    )
    if strong_name:
        return True

    return contains_any(hay, CHEER_SUPPORT_TERMS) or bool(matched_teams)


def strict_sport_match(title: str, category_terms: tuple[str, ...]) -> bool:
    if not contains_any(title, category_terms):
        return False

    # Reject obvious non-sports uses such as fashion articles about baseball caps
    # even when a league/team keyword appears in the headline.
    if contains_any(title, OFF_TOPIC_TITLE_TERMS) and not contains_any(title, SPORT_ACTION_TERMS):
        return False

    # League abbreviations or full league names are strong enough on their own.
    strong_markers = (
        "MLB", "大聯盟", "CPBL", "中華職棒", "中職", "TPBL", "PLG",
        "P. LEAGUE+", "P.LEAGUE+", "TVBL", "TPVL", "職排", "職業排球",
    )
    if contains_any(title, strong_markers):
        return True

    # A team/player name alone must be accompanied by an actual sports-action word.
    return contains_any(title, SPORT_ACTION_TERMS)


def strict_classify_news(
    title: str,
    desc: str,
    matched_girls: list[str],
    matched_teams: list[str],
) -> tuple[str, str] | None:
    if has_political_context(title, desc):
        return None

    if strict_cheer_context(title, desc, matched_girls, matched_teams):
        return "啦啦隊情報", (
            matched_girls[0] if matched_girls else (matched_teams[0] if matched_teams else "綜合")
        )

    for main_category, subcategory, terms in STRICT_SPORT_RULES:
        if strict_sport_match(title, terms):
            return main_category, subcategory

    return None


def strict_has_cheer_context(title: str, desc: str, matched_girls: list[str]) -> bool:
    return strict_cheer_context(title, desc, matched_girls, [])


# Replace the permissive classifier used by core.main(). All later URL/source
# allow-listing, deduplication and output handling remain in fetch_auto_news.py.
core.classify_news = strict_classify_news
core.has_cheer_context = strict_has_cheer_context

if __name__ == "__main__":
    core.main()
