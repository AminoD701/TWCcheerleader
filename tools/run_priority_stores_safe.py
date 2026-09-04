from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import fetch_priority_store_events as core

WORKER_TIMEOUT_SECONDS = 45
HTTP_TIMEOUT_SECONDS = 30
MAX_WORKERS = 8
INSTAGRAM_ACTOR = "apify/instagram-api-scraper"
THREADS_ACTOR = "themineworks/threads-scraper"


def fast_apify_sync(actor: str, payload: dict, token: str) -> list[dict]:
    actor_id = actor.replace("/", "~")
    quoted = core.base.urllib.parse.quote(token)
    url = (
        f"https://api.apify.com/v2/acts/{actor_id}/run-sync-get-dataset-items"
        f"?token={quoted}&clean=true&timeout={HTTP_TIMEOUT_SECONDS}"
    )
    result = core.base.http_json(url, payload=payload, timeout=HTTP_TIMEOUT_SECONDS)
    if not isinstance(result, list):
        raise RuntimeError(f"actor returned {type(result).__name__}, expected dataset rows")
    return result


def fetch_rows(platform: str, account: str, token: str) -> list[dict]:
    if platform == "instagram":
        return fast_apify_sync(INSTAGRAM_ACTOR, {
            "directUrls": [f"https://www.instagram.com/{account}/"],
            "resultsType": "posts",
            "resultsLimit": 12,
        }, token)
    return fast_apify_sync(THREADS_ACTOR, {
        "usernames": [account],
        "maxResults": 20,
    }, token)


def worker(platform: str, account: str, output_path: str) -> int:
    token = os.environ.get("APIFY_TOKEN", "").strip()
    if not token:
        print(f"{platform.title()} @{account} rows=0 ERROR APIFY_TOKEN missing")
        return 2
    try:
        rows = fetch_rows(platform, account, token)
        girls = core.base.load_girls()
        parser = core.PARSERS[account]
        events = []
        for row in rows:
            row_account = core.row_account(row)
            if row_account and row_account != account:
                continue
            event = parser(row, platform, girls)
            if event:
                events.append(event)
        Path(output_path).write_text(json.dumps({"rows": len(rows), "events": events}, ensure_ascii=False), encoding="utf-8")
        print(f"{platform.title()} @{account} rows={len(rows)} parsed={len(events)}")
        return 0
    except Exception as exc:
        Path(output_path).write_text(json.dumps({"rows": 0, "events": []}), encoding="utf-8")
        print(f"{platform.title()} @{account} rows=0 ERROR {type(exc).__name__}: {exc}")
        return 1


def run_one(platform: str, account: str) -> tuple[int, list[dict], int]:
    with tempfile.NamedTemporaryFile(prefix="priority-events-", suffix=".json", delete=False) as fh:
        output_path = fh.name
    try:
        cmd = [sys.executable, str(Path(__file__).resolve()), "--worker", platform, account, output_path]
        try:
            result = subprocess.run(cmd, timeout=WORKER_TIMEOUT_SECONDS, check=False, text=True,
                                    capture_output=True, env=os.environ.copy())
        except subprocess.TimeoutExpired:
            print(f"{platform.title()} @{account} rows=0 ERROR worker timeout after {WORKER_TIMEOUT_SECONDS}s")
            return 0, [], 1
        if result.stdout:
            print(result.stdout.strip())
        if result.stderr:
            print(result.stderr.strip())
        try:
            payload = json.loads(Path(output_path).read_text(encoding="utf-8"))
        except Exception:
            payload = {"rows": 0, "events": []}
        return int(payload.get("rows", 0)), payload.get("events", []), result.returncode
    finally:
        Path(output_path).unlink(missing_ok=True)


def main() -> int:
    preserved = [e for e in core.load_events() if not core.belongs_priority_event(e)]
    jobs = [(platform, account) for account in core.PRIORITY_ACCOUNTS for platform in ("instagram", "threads")]
    all_events, total_rows, failures = [], 0, 0
    print(f"START priority crawl jobs={len(jobs)} worker_timeout={WORKER_TIMEOUT_SECONDS}s http_timeout={HTTP_TIMEOUT_SECONDS}s")
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(run_one, platform, account): (platform, account) for platform, account in jobs}
        for future in as_completed(futures):
            platform, account = futures[future]
            rows, events, status = future.result()
            total_rows += rows
            failures += int(status != 0)
            all_events.extend(events)
    merged = {}
    for event in all_events:
        key = (event.get("date"), event.get("time"), event.get("host"), event.get("activity_type"))
        old = merged.get(key)
        if old is None or sum(bool(event.get(k)) for k in ("img", "link", "address")) > sum(bool(old.get(k)) for k in ("img", "link", "address")):
            merged[key] = event
    if total_rows == 0:
        print("ERROR: all eight Instagram/Threads sources returned zero rows; refusing to publish")
        return 1
    core.EVENTS_FILE.write_text(json.dumps(preserved + list(merged.values()), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"PRIORITY REFRESH COMPLETE rows={total_rows} parsed={len(all_events)} unique={len(merged)} failures={failures}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) >= 5 and sys.argv[1] == "--worker":
        raise SystemExit(worker(sys.argv[2], sys.argv[3], sys.argv[4]))
    raise SystemExit(main())
