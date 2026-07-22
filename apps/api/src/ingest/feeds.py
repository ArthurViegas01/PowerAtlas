"""RSS/Atom fetching and parsing (F5b).

feedparser does the heavy lifting (RSS 2.0 + Atom, CDATA, date quirks); this
module normalizes entries into FeedItem and strips markup from the
feed-provided summaries. By design there is NO article-page scraping in F5:
`content` is exactly what the feed itself published (PLAN, decisões da F5).
"""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from html.parser import HTMLParser
from typing import Any

import feedparser
import httpx
from pydantic import BaseModel


class FeedItem(BaseModel):
    title: str
    url: str
    published_at: datetime | None
    content: str


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def strip_html(markup: str) -> str:
    """Reduce feed-provided HTML to whitespace-normalized plain text."""
    parser = _TextExtractor()
    parser.feed(markup)
    return " ".join("".join(parser.parts).split())


def _entry_content(entry: Any) -> str:
    # content:encoded beats summary/description when the feed carries both.
    contents = entry.get("content") or []
    if contents:
        return strip_html(contents[0].get("value", ""))
    return strip_html(entry.get("summary", ""))


def _entry_published(entry: Any) -> datetime | None:
    parsed = entry.get("published_parsed") or entry.get("updated_parsed")
    if not parsed:
        return None
    year, month, day, hour, minute, second = parsed[:6]
    return datetime(year, month, day, hour, minute, second, tzinfo=UTC)


def parse_feed(raw: bytes) -> list[FeedItem]:
    parsed = feedparser.parse(raw)
    items: list[FeedItem] = []
    for entry in parsed.entries:
        url = entry.get("link", "").strip()
        title = strip_html(entry.get("title", "")).strip()
        if not url or not title:
            continue  # unusable as evidence: nothing to cite later
        items.append(
            FeedItem(
                title=title,
                url=url,
                published_at=_entry_published(entry),
                content=_entry_content(entry),
            )
        )
    return items


def content_hash(item: FeedItem) -> str:
    """sha256 over url+title+content, so re-fetches of the same story dedup."""
    digest = hashlib.sha256()
    digest.update(item.url.encode())
    digest.update(b"\n")
    digest.update(item.title.encode())
    digest.update(b"\n")
    digest.update(item.content.encode())
    return digest.hexdigest()


async def fetch_feed(client: httpx.AsyncClient, url: str) -> bytes:
    resp = await client.get(url)
    resp.raise_for_status()
    return resp.content
