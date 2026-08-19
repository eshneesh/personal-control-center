#!/usr/bin/env python3
"""Run an existing local monitor collector and publish only a scrubbed snapshot."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any


DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "site/data/operations.json"
ALLOWED_STATES = {"ok", "warning", "error", "checking"}
SECRET_PATTERNS = (
    re.compile(r"\b\d{8,12}:[A-Za-z0-9_-]{25,}\b"),
    re.compile(r"\b(?:oauth|token|secret|password|chat[_ -]?id)\s*[:=]\s*\S+", re.IGNORECASE),
    re.compile(r"https?://\S+", re.IGNORECASE),
    re.compile(r"/(?:Users|home)/[^\s]+"),
    re.compile(r"\b(?:10|127)\.\d{1,3}\.\d{1,3}\.\d{1,3}\b"),
    re.compile(r"\b192\.168\.\d{1,3}\.\d{1,3}\b"),
)


def scrub(value: Any, limit: int) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    for pattern in SECRET_PATTERNS:
        text = pattern.sub("[скрыто]", text)
    return text[:limit]


def sanitize_snapshot(raw: dict[str, Any]) -> dict[str, Any]:
    raw_items = raw.get("items") if isinstance(raw.get("items"), list) else []
    items = []
    for raw_item in raw_items[:8]:
        if not isinstance(raw_item, dict):
            continue
        state = raw_item.get("state") if raw_item.get("state") in ALLOWED_STATES else "checking"
        items.append(
            {
                "id": re.sub(r"[^a-z0-9_-]", "", str(raw_item.get("id", "operation")).lower())[:40] or "operation",
                "title": scrub(raw_item.get("title"), 70) or "Операция",
                "state": state,
                "detail": scrub(raw_item.get("detail"), 120) or "Нет деталей",
                "meta": scrub(raw_item.get("meta"), 100),
            }
        )

    overall = raw.get("overall") if isinstance(raw.get("overall"), dict) else {}
    overall_state = overall.get("state") if overall.get("state") in ALLOWED_STATES else "checking"
    return {
        "version": 1,
        "visibility": "sanitized",
        "checked_at": scrub(raw.get("checked_at"), 40),
        "overall": {
            "state": overall_state,
            "title": scrub(overall.get("title"), 90) or "Состояние операций",
            "detail": scrub(overall.get("detail"), 140),
        },
        "items": items,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Publish a sanitized operations snapshot")
    parser.add_argument("--collector", type=Path, required=True, help="Path to collect_monitor_status.py")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--local-only", action="store_true", help="Skip network checks in the source collector")
    parser.add_argument("--timeout", type=int, default=90, help="Collector timeout in seconds (default: 90)")
    args = parser.parse_args()

    collector = args.collector.expanduser().resolve()
    if not collector.is_file():
        parser.error(f"collector not found: {collector}")
    command = [sys.executable, str(collector)]
    if args.local_only:
        command.append("--local-only")
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=max(5, args.timeout),
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise SystemExit(
            f"Коллектор не завершился за {max(5, args.timeout)} секунд. "
            "Повторите с --local-only или увеличьте --timeout."
        ) from error
    if not result.stdout.strip():
        raise SystemExit("Коллектор не вернул JSON")
    try:
        raw = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise SystemExit(f"Некорректный JSON коллектора: {error}") from error

    snapshot = sanitize_snapshot(raw)
    output = args.output.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(output.suffix + ".tmp")
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(output)
    print(f"Операции: {len(snapshot['items'])}; итог: {snapshot['overall']['state']}")
    return 0 if result.returncode == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
