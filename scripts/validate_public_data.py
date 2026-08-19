#!/usr/bin/env python3
"""Fail when the GitHub Pages artifact contains a likely secret or private URL."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
PATTERNS = {
    "Telegram token": re.compile(r"\b\d{8,12}:[A-Za-z0-9_-]{25,}\b"),
    "secret assignment": re.compile(r"\b(?:oauth|token|secret|password|chat[_ -]?id)\s*[:=]\s*[^\s\],}]+", re.IGNORECASE),
    "home path": re.compile(r"/(?:Users|home)/[^\s\"']+"),
    "private IPv4": re.compile(r"\b(?:10\.|127\.|192\.168\.)\d{1,3}(?:\.\d{1,3}){1,2}\b"),
    "internal URL": re.compile(r"https?://[^\s\"']+\.(?:local|corp|lan)(?:[/:]|$)", re.IGNORECASE),
}


def main() -> int:
    errors: list[str] = []
    for path in sorted(SITE.rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT)
        if path.name.startswith(".env") or path.suffix in {".key", ".pem", ".p12"}:
            errors.append(f"{relative}: запрещённый тип файла")
            continue
        if path.suffix == ".json":
            try:
                json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as error:
                errors.append(f"{relative}: некорректный JSON ({error})")
                continue
        if path.suffix not in {".html", ".css", ".js", ".json", ".txt", ""}:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for label, pattern in PATTERNS.items():
            if pattern.search(text):
                errors.append(f"{relative}: найдено потенциально приватное значение ({label})")

    if errors:
        print("Публичная проверка не пройдена:")
        print("\n".join(f"- {error}" for error in errors))
        return 1
    print("Публичная проверка пройдена: секреты и внутренние адреса не обнаружены")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
