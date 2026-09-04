from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import fetch_priority_store_events as core

TIMEOUT_SECONDS = 35
HTTP_TIMEOUT_SECONDS = 25
MAX_WORKERS = 8


def fast_apify_sync(actor: str, payload: dict, token: str) -> list[dict]:
    """Hard-limit every Apify sync request used by the priority-store crawler."""
    actor_id = actor.replace("/", "~")
    quoted = core.base.urllib.parse.quote(token)
    url = (
        f"https://api.apify.com/v2/acts/{actor_id}/run-sync-get-dataset-items"
        f"?token={quoted}&clean=true&timeout={HTTP_TIMEOUT_SECONDS}"
    )
    result = core.base.http_json(url, payload=payload, timeout=HTTP_TIMEOUT_SECONDS)
    return result if isinstance(result, list) else []


# Patch every route used by the dedicated store crawler, including fallback fetchers.
core.base.apify_sync = fast_apify_sync
core.legacy.base.apify_sync = fast_apify_sync
if hasattr(core.legacy, "platform"):
    core.legacy.platform.apify_sync = fast_apify_sync


def worker(platform_name: str, account: str, output_path: str) -> int:
    token = os.environ.get("APIFY_TOKEN", "").strip()
    if not token:
        Path(output_path).write_text("[]\n", encoding="utf-8")
        print(f"WORKER {platform_name} @{account}: APIFY_TOKEN missing")
        return 0

    girls = core.base.load_girls()
    parser = core.PARSERS.get(account)
    if not parser:
        Path(output_path).write_text("[]\n", encoding="utf-8")
        return 0

    try:
        if platform_name == "instagram":
            rows = core.legacy.fetch_instagram(token, [account])
        elif platform_name == "threads":
            rows = core.legacy.fetch_threads(token, [account], [])
        else:
            rows = []

        found = []
        for row in rows:
            row_acc = core.row_account(row)
            if row_acc and row_acc != account:
                continue
            event = parser(row, platform_name, girls)
            if event:
                found.append(event)

        Path(output_path).write_text(
            json.dumps(found, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"WORKER {platform_name} @{account}: rows={len(rows)} accepted={len(found)}")
        return 0
    except Exception as exc:
        Path(output_path).write_text("[]\n", encoding="utf-8")
        print(f"WORKER {platform_name} @{account} FAILED: {type(exc).__name__}: {exc}")
        return 0


def run_one(platform_name: str, account: str) -> list[dict]:
    with tempfile.NamedTemporaryFile(prefix="priority-events-", suffix=".json", delete=False) as fh:
        output_path = fh.name

    try:
        cmd = [sys.executable, str(Path(__file__).resolve()), "--worker", platform_name, account, output_path]
        try:
            result = subprocess.run(
                cmd,
                timeout=TIMEOUT_SECONDS,
                check=False,
                text=True,
                capture_output=True,
                env=os.environ.copy(),
            )
            if result.stdout:
                print(result.stdout.strip())
            if result.stderr:
                print(result.stderr.strip())
            if result.returncode != 0:
                print(f"SKIP {platform_name} @{account}: worker exit={result.returncode}")
                return []
        except subprocess.TimeoutExpired:
            print(f"TIMEOUT {platform_name} @{account}: skipped after {TIMEOUT_SECONDS}s")
            return []

        try:
            return json.loads(Path(output_path).read_text(encoding="utf-8"))
        except Exception as exc:
            print(f"SKIP {platform_name} @{account}: invalid worker output ({exc})")
            return []
    finally:
        try:
            Path(output_path).unlink(missing_ok=True)
        except Exception:
            pass


def main() -> None:
    preserved = [e for e in core.load_events() if not core.belongs_priority_event(e)]
    seeds = core.confirmed_seed_events()
    found: list[dict] = []

    jobs = [
        (platform_name, account)
        for account in core.PRIORITY_ACCOUNTS
        for platform_name in ("instagram", "threads")
    ]

    print(
        f"START parallel priority crawl: jobs={len(jobs)} "
        f"worker_timeout={TIMEOUT_SECONDS}s http_timeout={HTTP_TIMEOUT_SECONDS}s"
    )
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_map = {
            executor.submit(run_one, platform_name, account): (platform_name, account)
            for platform_name, account in jobs
        }
        for future in as_completed(future_map):
            platform_name, account = future_map[future]
            try:
                events = future.result()
                found.extend(events)
                print(f"DONE {platform_name} @{account}: events={len(events)}")
            except Exception as exc:
                print(f"FAILED {platform_name} @{account}: {type(exc).__name__}: {exc}")

    merged_priority = {}
    for event in seeds + found:
        key = (event.get("date"), event.get("host"), event.get("girls"))
        merged_priority[key] = event

    merged = preserved + list(merged_priority.values())
    core.EVENTS_FILE.write_text(
        json.dumps(merged, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"SAFE PRIORITY REFRESH COMPLETE: preserved={len(preserved)} "
        f"seeds={len(seeds)} crawled={len(found)} total={len(merged)}"
    )


if __name__ == "__main__":
    if len(sys.argv) >= 5 and sys.argv[1] == "--worker":
        raise SystemExit(worker(sys.argv[2], sys.argv[3], sys.argv[4]))
    main()
