"""
News fetcher — RSS feeds (IN + US) and NewsAPI.

Indian sources:  Economic Times, Moneycontrol, LiveMint, Business Standard
US sources:      Yahoo Finance (per-ticker), CNBC, Reuters via NewsAPI
"""
import asyncio
import hashlib
import logging
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any

import feedparser
import httpx

from app.core.config import settings

log = logging.getLogger(__name__)

# ── RSS feed URLs ─────────────────────────────────────────────────────────────
INDIAN_RSS_FEEDS: list[dict] = [
    {
        "source": "Economic Times",
        "url": "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
        "market": "IN",
    },
    {
        "source": "Moneycontrol",
        "url": "https://www.moneycontrol.com/rss/business.xml",
        "market": "IN",
    },
    {
        "source": "LiveMint",
        "url": "https://www.livemint.com/rss/markets",
        "market": "IN",
    },
    {
        "source": "Business Standard",
        "url": "https://www.business-standard.com/rss/markets-106.rss",
        "market": "IN",
    },
]

US_RSS_FEEDS: list[dict] = [
    {
        "source": "CNBC Markets",
        "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069",
        "market": "US",
    },
    {
        "source": "Reuters Business",
        "url": "https://feeds.reuters.com/reuters/businessNews",
        "market": "US",
    },
    {
        "source": "Seeking Alpha",
        "url": "https://seekingalpha.com/market_currents.xml",
        "market": "US",
    },
]

NEWSAPI_QUERIES = {
    "IN": "Nifty OR Sensex OR SEBI OR RBI OR BSE OR NSE stock",
    "US": "S&P 500 OR NASDAQ OR NYSE OR Federal Reserve OR earnings stock",
}


def _stable_id(url: str, headline: str) -> str:
    """Deterministic ID so we can deduplicate on re-fetch."""
    return hashlib.sha1(f"{url}|{headline}".encode()).hexdigest()[:16]


def _parse_date(entry: Any) -> datetime:
    try:
        if hasattr(entry, "published"):
            return parsedate_to_datetime(entry.published).replace(tzinfo=timezone.utc)
    except Exception:
        pass
    return datetime.now(timezone.utc)


def _parse_feed(feed_meta: dict) -> list[dict]:
    """Parse a single RSS feed synchronously (feedparser is sync)."""
    articles: list[dict] = []
    try:
        parsed = feedparser.parse(feed_meta["url"])
        for entry in parsed.entries[:20]:  # cap at 20 per source
            headline = entry.get("title", "").strip()
            url = entry.get("link", "").strip()
            if not headline or not url:
                continue
            articles.append({
                "id": _stable_id(url, headline),
                "headline": headline,
                "source": feed_meta["source"],
                "url": url,
                "market": feed_meta["market"],
                "published": _parse_date(entry),
                "raw_text": entry.get("summary", ""),
            })
    except Exception as e:
        log.warning("RSS fetch failed [%s]: %s", feed_meta["source"], e)
    return articles


async def _fetch_feeds_async(feeds: list[dict]) -> list[dict]:
    """Fetch multiple RSS feeds concurrently using threadpool."""
    loop = asyncio.get_event_loop()
    tasks = [loop.run_in_executor(None, _parse_feed, f) for f in feeds]
    results = await asyncio.gather(*tasks)
    all_articles: list[dict] = []
    for r in results:
        all_articles.extend(r)
    # Deduplicate by URL
    seen: set[str] = set()
    deduped = []
    for a in all_articles:
        if a["url"] not in seen:
            seen.add(a["url"])
            deduped.append(a)
    return deduped


async def fetch_indian_news() -> list[dict]:
    """Fetch news from all Indian RSS sources."""
    articles = await _fetch_feeds_async(INDIAN_RSS_FEEDS)
    log.info("fetched %d Indian news articles", len(articles))
    return articles


async def fetch_us_news() -> list[dict]:
    """Fetch news from all US RSS sources."""
    articles = await _fetch_feeds_async(US_RSS_FEEDS)
    log.info("fetched %d US news articles", len(articles))
    return articles


async def fetch_yahoo_finance_news(ticker: str) -> list[dict]:
    """Fetch Yahoo Finance RSS for a specific ticker."""
    feed = {
        "source": f"Yahoo Finance ({ticker})",
        "url": f"https://finance.yahoo.com/rss/headline?s={ticker}",
        "market": "US" if "." not in ticker else "IN",
    }
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _parse_feed, feed)


async def fetch_newsapi(market: str = "IN", page_size: int = 20) -> list[dict]:
    """
    Fetch from NewsAPI (100 req/day free tier).
    market: 'IN' or 'US'
    """
    if not settings.news_api_key:
        log.debug("NEWS_API_KEY not set, skipping NewsAPI fetch")
        return []

    query = NEWSAPI_QUERIES.get(market, "stock market")
    params = {
        "q": query,
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": page_size,
        "apiKey": settings.news_api_key,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get("https://newsapi.org/v2/everything", params=params)
            resp.raise_for_status()
            data = resp.json()
            articles = []
            for item in data.get("articles", []):
                headline = (item.get("title") or "").strip()
                url = (item.get("url") or "").strip()
                if not headline or not url or headline == "[Removed]":
                    continue
                published_raw = item.get("publishedAt", "")
                try:
                    published = datetime.fromisoformat(published_raw.replace("Z", "+00:00"))
                except Exception:
                    published = datetime.now(timezone.utc)
                articles.append({
                    "id": _stable_id(url, headline),
                    "headline": headline,
                    "source": item.get("source", {}).get("name", "NewsAPI"),
                    "url": url,
                    "market": market,
                    "published": published,
                    "raw_text": item.get("description", "") or "",
                })
            log.info("NewsAPI returned %d articles for market=%s", len(articles), market)
            return articles
    except Exception as e:
        log.warning("NewsAPI fetch failed: %s", e)
        return []


async def fetch_all_news() -> dict[str, list[dict]]:
    """Fetch Indian + US news concurrently. Returns {'IN': [...], 'US': [...]}."""
    indian, us, newsapi_in, newsapi_us = await asyncio.gather(
        fetch_indian_news(),
        fetch_us_news(),
        fetch_newsapi("IN"),
        fetch_newsapi("US"),
    )

    def merge(base: list[dict], extra: list[dict]) -> list[dict]:
        seen = {a["url"] for a in base}
        for a in extra:
            if a["url"] not in seen:
                seen.add(a["url"])
                base.append(a)
        return base

    return {
        "IN": merge(indian, newsapi_in),
        "US": merge(us, newsapi_us),
    }
