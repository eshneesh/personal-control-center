#!/usr/bin/env python3
"""Convert a Telegram Desktop/Aigis JSON export into a public-safe deploy summary.

The output intentionally excludes raw messages, sender IDs, chat IDs, URLs,
email addresses and tokens. It is safe to review and publish as static JSON.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
from pathlib import Path
from typing import Any, Iterable


DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "site/data/deployments.json"
DEPLOY_WORDS = re.compile(r"deploy|deployment|deployed|релиз|выклад|депло", re.IGNORECASE)
FIELD_PATTERNS = {
    "project": re.compile(r"(?:project|проект|service|сервис|app)\s*[:=]\s*([^\n|]{2,60})", re.IGNORECASE),
    "environment": re.compile(r"(?:environment|env|контур|среда)\s*[:=]\s*([^\n|]{2,30})", re.IGNORECASE),
    "version": re.compile(r"(?:version|версия|commit|tag)\s*[:=]\s*([A-Za-z0-9._/-]{2,40})", re.IGNORECASE),
}
SECRET_PATTERNS = (
    re.compile(r"\b\d{8,12}:[A-Za-z0-9_-]{25,}\b"),
    re.compile(r"\b(?:oauth|token|secret|password|chat[_ -]?id)\s*[:=]\s*\S+", re.IGNORECASE),
    re.compile(r"https?://\S+", re.IGNORECASE),
    re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE),
    re.compile(r"\b(?:10|127)\.\d{1,3}\.\d{1,3}\.\d{1,3}\b"),
    re.compile(r"\b192\.168\.\d{1,3}\.\d{1,3}\b"),
)


def flatten_text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        parts = []
        for item in value:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                parts.append(str(item.get("text", "")))
        return "".join(parts)
    return ""


def scrub(value: Any, limit: int) -> str:
    text = str(value or "")
    for pattern in SECRET_PATTERNS:
        text = pattern.sub("[скрыто]", text)
    text = re.sub(r"\s+", " ", text).strip(" -|·\n\t")
    return text[:limit]


def status_from_text(text: str) -> str:
    if re.search(r"❌|failed|failure|error|ошиб|неуспеш", text, re.IGNORECASE):
        return "failed"
    if re.search(r"⏳|pending|running|progress|ожида|в процессе", text, re.IGNORECASE):
        return "pending"
    if re.search(r"✅|success|successful|deployed|готов|успеш", text, re.IGNORECASE):
        return "success"
    return "pending"


def field(name: str, text: str, fallback: str) -> str:
    match = FIELD_PATTERNS[name].search(text)
    return scrub(match.group(1), 60) if match else fallback


def normalize_environment(value: str, text: str) -> str:
    combined = f"{value} {text}".lower()
    if re.search(r"\b(prod|production|прод)\b", combined):
        return "production"
    if re.search(r"\b(stage|staging|стейдж)\b", combined):
        return "staging"
    if re.search(r"\b(test|testing|тест)\b", combined):
        return "test"
    if re.search(r"\b(dev|development|разработ)\b", combined):
        return "development"
    return scrub(value, 24) or "unknown"


def safe_summary(text: str, project: str) -> str:
    pieces = [scrub(piece, 180) for piece in re.split(r"[\n|]", text) if scrub(piece, 180)]
    candidates = [
        piece
        for piece in pieces
        if not any(pattern.search(piece) for pattern in FIELD_PATTERNS.values())
        and not DEPLOY_WORDS.search(piece)
        and not re.fullmatch(r"[✅❌⏳\s]+", piece)
    ]
    summary = candidates[0] if candidates else f"Обновление {project}"
    summary = re.sub(r"^[✅❌⏳🚀\s]+", "", summary).strip()
    return summary[:140] or f"Обновление {project}"


def telegram_messages(payload: Any) -> Iterable[dict[str, Any]]:
    if isinstance(payload, dict) and isinstance(payload.get("messages"), list):
        return (item for item in payload["messages"] if isinstance(item, dict))
    if isinstance(payload, list):
        return (item for item in payload if isinstance(item, dict))
    return iter(())


def build_from_export(payload: Any, limit: int, include_all: bool) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    for message in telegram_messages(payload):
        text = flatten_text(message.get("text"))
        if not text or (not include_all and not DEPLOY_WORDS.search(text)):
            continue
        project = field("project", text, "Aigis")
        environment = normalize_environment(field("environment", text, "unknown"), text)
        version = field("version", text, "—")
        date = scrub(message.get("date"), 40) or dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
        fingerprint = hashlib.sha256(f"{date}|{project}|{version}".encode()).hexdigest()[:16]
        items.append(
            {
                "id": f"aigis-{fingerprint}",
                "project": project,
                "environment": environment,
                "status": status_from_text(text),
                "version": version,
                "deployed_at": date,
                "summary": safe_summary(text, project),
            }
        )
    items.sort(key=lambda item: item["deployed_at"], reverse=True)
    return items[:limit]


def build_from_canonical(payload: dict[str, Any], limit: int) -> list[dict[str, str]]:
    raw_items = payload.get("items") if isinstance(payload.get("items"), list) else []
    items = []
    for index, raw in enumerate(raw_items[:limit]):
        if not isinstance(raw, dict):
            continue
        project = scrub(raw.get("project"), 60) or "Aigis"
        date = scrub(raw.get("deployed_at"), 40) or dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
        version = scrub(raw.get("version"), 40) or "—"
        fingerprint = hashlib.sha256(f"{date}|{project}|{index}".encode()).hexdigest()[:16]
        status = raw.get("status") if raw.get("status") in {"success", "failed", "pending"} else "pending"
        items.append(
            {
                "id": f"aigis-{fingerprint}",
                "project": project,
                "environment": normalize_environment(scrub(raw.get("environment"), 24), ""),
                "status": status,
                "version": version,
                "deployed_at": date,
                "summary": scrub(raw.get("summary"), 140) or f"Обновление {project}",
            }
        )
    return items


def main() -> int:
    parser = argparse.ArgumentParser(description="Sanitize an Aigis/Telegram JSON export for the control center")
    parser.add_argument("source", type=Path, help="Telegram Desktop result.json or canonical JSON")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--limit", type=int, default=12)
    parser.add_argument("--include-all", action="store_true", help="Include messages without deploy keywords")
    args = parser.parse_args()

    payload = json.loads(args.source.expanduser().read_text(encoding="utf-8"))
    if isinstance(payload, dict) and isinstance(payload.get("items"), list):
        items = build_from_canonical(payload, max(1, args.limit))
    else:
        items = build_from_export(payload, max(1, args.limit), args.include_all)

    snapshot = {
        "version": 1,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "source": "aigis-export:sanitized",
        "items": items,
    }
    output = args.output.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(output.suffix + ".tmp")
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(output)
    print(f"Деплои: {len(items)}; исходные сообщения в результат не включены")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
