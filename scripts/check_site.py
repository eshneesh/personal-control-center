#!/usr/bin/env python3
"""Small dependency-free structural check for the static site."""

from __future__ import annotations

import json
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()
        self.duplicates: set[str] = set()
        self.buttons_without_labels = 0
        self.has_main = False
        self.has_h1 = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        element_id = values.get("id")
        if element_id:
            if element_id in self.ids:
                self.duplicates.add(element_id)
            self.ids.add(element_id)
        if tag == "main":
            self.has_main = True
        if tag == "h1":
            self.has_h1 = True
        if tag == "button" and not values.get("aria-label") and not values.get("title"):
            self.buttons_without_labels += 1


def main() -> int:
    parser = PageParser()
    parser.feed((SITE / "index.html").read_text(encoding="utf-8"))
    errors = []
    if parser.duplicates:
        errors.append(f"duplicate ids: {sorted(parser.duplicates)}")
    if not parser.has_main or not parser.has_h1:
        errors.append("missing main landmark or h1")
    for filename in ("config.json", "operations.json", "deployments.json", "news.json"):
        json.loads((SITE / "data" / filename).read_text(encoding="utf-8"))
    for filename in ("assets/styles.css", "assets/app.js"):
        if not (SITE / filename).is_file():
            errors.append(f"missing {filename}")
    if errors:
        print("\n".join(errors))
        return 1
    print(f"Структура сайта корректна; уникальных id: {len(parser.ids)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
