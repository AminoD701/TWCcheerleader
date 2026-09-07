from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

NEWS_PATH = Path("data/auto-news.json")
META_PATH = Path("data/auto-news-meta.json")
TAIPEI = timezone(timedelta(hours=8))


def main() -> None:
    items = []
    if NEWS_PATH.exists():
        try:
            parsed = json.loads(NEWS_PATH.read_text(encoding="utf-8"))
            if isinstance(parsed, list):
                items = parsed
        except (OSError, json.JSONDecodeError) as exc:
            print(f"unable to read {NEWS_PATH}: {exc}")

    latest_item_date = ""
    if items:
        latest_item_date = str(items[0].get("date") or "")

    payload = {
        "updatedAt": datetime.now(TAIPEI).isoformat(timespec="seconds"),
        "itemCount": len(items),
        "latestItemDate": latest_item_date,
    }
    META_PATH.parent.mkdir(parents=True, exist_ok=True)
    META_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {META_PATH} with {len(items)} items")


if __name__ == "__main__":
    main()
