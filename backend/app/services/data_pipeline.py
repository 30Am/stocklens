"""
Data pipeline — connects fetchers to the database.
Called by the scheduler. Each function is a standalone async task.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select, text
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.models.db import ForexRate, NewsArticle, Price, Stock
from app.services.forex_fetcher import fetch_usd_inr
from app.services.news_fetcher import fetch_all_news, fetch_indian_news, fetch_us_news
from app.services.price_fetcher import fetch_indian_prices, fetch_us_prices
from app.utils.database import AsyncSessionLocal

log = logging.getLogger(__name__)


# ── Prices ────────────────────────────────────────────────────────────────────

async def _save_prices(price_dicts: list[dict]) -> int:
    if not price_dicts:
        return 0
    async with AsyncSessionLocal() as session:
        rows = [
            Price(
                ticker=p["ticker"],
                timestamp=p["timestamp"],
                open=p.get("open"),
                high=p.get("high"),
                low=p.get("low"),
                close=p["close"],
                volume=p.get("volume"),
            )
            for p in price_dicts
        ]
        session.add_all(rows)
        await session.commit()
    return len(rows)


async def _broadcast_prices(prices: list[dict]) -> None:
    """Push price updates to connected WebSocket clients (non-blocking)."""
    try:
        from app.api.websocket import manager
        await manager.broadcast_prices(prices)
    except Exception:
        pass  # WS broadcast is best-effort


async def run_indian_prices() -> None:
    log.info("[pipeline] fetching Indian prices...")
    prices = await fetch_indian_prices()
    saved = await _save_prices(prices)
    await _broadcast_prices(prices)
    log.info("[pipeline] saved %d Indian price rows", saved)


async def run_us_prices() -> None:
    log.info("[pipeline] fetching US prices...")
    prices = await fetch_us_prices()
    saved = await _save_prices(prices)
    await _broadcast_prices(prices)
    log.info("[pipeline] saved %d US price rows", saved)


# ── News ──────────────────────────────────────────────────────────────────────

async def _save_news(articles: list[dict]) -> int:
    if not articles:
        return 0
    saved = 0
    async with AsyncSessionLocal() as session:
        for a in articles:
            # Skip if URL already exists
            existing = await session.execute(select(NewsArticle).where(NewsArticle.url == a["url"]))
            if existing.scalar_one_or_none():
                continue
            row = NewsArticle(
                headline=a["headline"],
                source=a.get("source"),
                url=a["url"],
                market=a.get("market"),
                published=a.get("published"),
                raw_text=a.get("raw_text", ""),
            )
            session.add(row)
            saved += 1
        await session.commit()
    return saved


async def run_indian_news() -> None:
    log.info("[pipeline] fetching Indian news...")
    articles = await fetch_indian_news()
    saved = await _save_news(articles)
    log.info("[pipeline] saved %d new Indian news articles", saved)


async def run_us_news() -> None:
    log.info("[pipeline] fetching US news...")
    articles = await fetch_us_news()
    saved = await _save_news(articles)
    log.info("[pipeline] saved %d new US news articles", saved)


async def run_all_news() -> None:
    news = await fetch_all_news()
    for market, articles in news.items():
        saved = await _save_news(articles)
        log.info("[pipeline] saved %d new %s news articles", saved, market)


# ── Forex ─────────────────────────────────────────────────────────────────────

async def run_forex_update() -> None:
    log.info("[pipeline] fetching forex rate...")
    rate = await fetch_usd_inr()
    async with AsyncSessionLocal() as session:
        row = ForexRate(pair="USD_INR", rate=rate, updated_at=datetime.now(timezone.utc))
        session.add(row)
        await session.commit()
    log.info("[pipeline] USD/INR = %.4f saved", rate)


# ── Stock universe seed ───────────────────────────────────────────────────────

async def seed_stock_universe() -> None:
    """Insert stock universe on first startup (idempotent)."""
    from app.core.universe import ALL_STOCKS

    async with AsyncSessionLocal() as session:
        for s in ALL_STOCKS:
            existing = await session.execute(select(Stock).where(Stock.ticker == s["ticker"]))
            if existing.scalar_one_or_none():
                continue
            market = "US" if not s["ticker"].endswith((".NS", ".BO")) else "IN"
            exchange = "NSE" if s["ticker"].endswith(".NS") else ("BSE" if s["ticker"].endswith(".BO") else "NYSE")
            row = Stock(
                ticker=s["ticker"],
                name=s["name"],
                exchange=exchange,
                sector=s.get("sector"),
                market=market,
                currency="INR" if market == "IN" else "USD",
                index=s.get("index"),
            )
            session.add(row)
        await session.commit()
    log.info("[pipeline] stock universe seeded")
