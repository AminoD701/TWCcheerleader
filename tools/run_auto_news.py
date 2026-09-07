from __future__ import annotations

import fetch_auto_news as core

# The source filtering, sports caps and story deduplication now live in
# fetch_auto_news.py. Keep this runner intentionally thin so stale override logic
# cannot re-enable old publishers or depend on removed constants.

if __name__ == "__main__":
    core.main()
