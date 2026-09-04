from __future__ import annotations

import fetch_apify_social_events as base

# Extend event wording without duplicating the core parser. These are common commercial
# event phrases used by Taiwanese stores / organizers that do not necessarily contain
# the exact term "見面會".
EXTRA_EVENT_TERMS = [
    "女神來見面",
    "女神見面",
    "來見面",
    "見面活動",
    "來店見面",
    "粉絲見面",
    "與你見面",
    "見面日",
]

for term in reversed(EXTRA_EVENT_TERMS):
    if term not in base.EVENT_TERMS:
        base.EVENT_TERMS.insert(0, term)

import fetch_apify_platform_events as platform


if __name__ == "__main__":
    platform.main()
