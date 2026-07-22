"""F5b ingestion unit tests: parsing, stripping, hashing, mocked fetch.

The DB-backed dedup path lives in test_ingest_db.py (integration marker).
"""

from __future__ import annotations

from datetime import UTC, datetime

import httpx
import pytest
import respx

from src.ingest.feeds import FeedItem, content_hash, fetch_feed, parse_feed, strip_html

SAMPLE_RSS = b"""<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Feed de Teste</title>
    <item>
      <title>Nova politica &amp; economia</title>
      <link>https://example.org/noticia-1</link>
      <description><![CDATA[<p>Resumo com <b>markup</b> &amp; entidades.</p>]]></description>
      <pubDate>Tue, 21 Jul 2026 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Segunda noticia</title>
      <link>https://example.org/noticia-2</link>
      <description>Sem markup.</description>
    </item>
    <item>
      <title>Sem link, deve ser ignorada</title>
      <description>x</description>
    </item>
  </channel>
</rss>
"""


def test_parse_feed_extracts_items() -> None:
    items = parse_feed(SAMPLE_RSS)
    assert [i.url for i in items] == [
        "https://example.org/noticia-1",
        "https://example.org/noticia-2",
    ]
    first = items[0]
    assert first.title == "Nova politica & economia"
    assert first.content == "Resumo com markup & entidades."
    assert first.published_at == datetime(2026, 7, 21, 10, 0, tzinfo=UTC)
    assert items[1].published_at is None


def test_strip_html_normalizes_whitespace() -> None:
    assert strip_html("<p>a</p>\n\n  <span>b</span>") == "a b"


def test_content_hash_is_stable_and_sensitive() -> None:
    item = FeedItem(title="t", url="u", published_at=None, content="c")
    same = FeedItem(title="t", url="u", published_at=None, content="c")
    other = FeedItem(title="t", url="u", published_at=None, content="c2")
    assert content_hash(item) == content_hash(same)
    assert content_hash(item) != content_hash(other)


@respx.mock
async def test_fetch_feed_returns_body() -> None:
    route = respx.get("https://example.org/rss").respond(content=SAMPLE_RSS)
    async with httpx.AsyncClient() as client:
        raw = await fetch_feed(client, "https://example.org/rss")
    assert route.called
    assert raw == SAMPLE_RSS


@respx.mock
async def test_fetch_feed_raises_on_http_error() -> None:
    respx.get("https://example.org/rss").respond(status_code=503)
    async with httpx.AsyncClient() as client:
        with pytest.raises(httpx.HTTPStatusError):
            await fetch_feed(client, "https://example.org/rss")
