#!/usr/bin/env python3
"""Build a small, secret-free telecom news snapshot from public RSS feeds."""

from __future__ import annotations

import argparse
import datetime as dt
import email.utils
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any


DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "site/data/news.json"
USER_AGENT = "PersonalControlCenter/1.0 (+https://github.com/eshneesh)"
QUERIES = (
    ("mts", 'МТС OR МГТС телеком when:7d'),
    ("telecom", 'телеком связь операторы Россия when:7d'),
    ("infrastructure", 'инфраструктура связи ЦОД оптоволокно Россия when:7d'),
)


def rss_url(query: str) -> str:
    encoded = urllib.parse.quote_plus(query)
    return f"https://news.google.com/rss/search?q={encoded}&hl=ru&gl=RU&ceid=RU:ru"


def clean_text(value: str) -> str:
    value = re.sub(r"\s+", " ", value or "").strip()
    return value[:260]


def parse_date(value: str) -> str:
    try:
        parsed = email.utils.parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(dt.timezone.utc).isoformat(timespec="seconds")
    except (TypeError, ValueError, OverflowError):
        return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def source_name(item: ET.Element, title: str) -> tuple[str, str]:
    source = item.find("source")
    source_text = clean_text(source.text if source is not None else "")
    if source_text:
        suffix = f" - {source_text}"
        if title.endswith(suffix):
            title = title[: -len(suffix)].rstrip()
    return title, source_text or "Google News"


def fetch_feed(category: str, query: str, timeout: int = 20) -> list[dict[str, str]]:
    request = urllib.request.Request(rss_url(query), headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = response.read()
    root = ET.fromstring(payload)
    results: list[dict[str, str]] = []
    for item in root.findall("./channel/item")[:8]:
        title = clean_text(item.findtext("title", ""))
        link = clean_text(item.findtext("link", ""))
        published = parse_date(item.findtext("pubDate", ""))
        title, source = source_name(item, title)
        if not title or not link.startswith("https://"):
            continue
        results.append(
            {
                "category": category,
                "title": title,
                "url": link,
                "source": source,
                "published_at": published,
            }
        )
    return results


def build_snapshot() -> dict[str, Any]:
    items: list[dict[str, str]] = []
    errors: list[str] = []
    for category, query in QUERIES:
        try:
            items.extend(fetch_feed(category, query))
        except (OSError, TimeoutError, ET.ParseError) as error:
            errors.append(f"{category}:{type(error).__name__}")

    seen: set[str] = set()
    deduplicated: list[dict[str, str]] = []
    for item in sorted(items, key=lambda value: value["published_at"], reverse=True):
        key = re.sub(r"[^a-zа-яё0-9]", "", item["title"].lower())[:100]
        if not key or key in seen:
            continue
        seen.add(key)
        deduplicated.append(item)

    return {
        "version": 1,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "source": "public-rss",
        "errors": errors,
        "items": deduplicated[:18],
    }


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser(description="Update public telecom news for the control center")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    snapshot = build_snapshot()
    write_json(args.output.expanduser().resolve(), snapshot)
    print(f"Новости: {len(snapshot['items'])}; ошибок источников: {len(snapshot['errors'])}")
    return 0 if snapshot["items"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
