"""
Price fetcher — yfinance-based OHLCV data for both IN and US markets.

Usage:
    prices = await fetch_latest_prices(["RELIANCE.NS", "TCS.NS", "AAPL", "MSFT"])
    history = await fetch_history("RELIANCE.NS", period="3mo")
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

import yfinance as yf

from app.core.universe import INDIA_TICKERS, US_TICKERS, get_currency, get_market

log = logging.getLogger(__name__)

# Batch size — keep small to avoid large in-memory DataFrames on free-tier (512 MB)
_BATCH = 10


async def fetch_latest_prices(tickers: list[str]) -> list[dict]:
    """
    Fetch latest price snapshot for a list of tickers.
    Uses period="1d" interval="1d" so yfinance returns a single-row summary
    DataFrame per ticker — drastically lower memory vs minute-by-minute data.
    Batches are processed sequentially (not concurrently) to cap peak RSS.
    Returns a list of price dicts ready to insert into the DB.
    """
    results: list[dict] = []

    def _download_batch(batch: list[str]) -> list[dict]:
        batch_results = []
        try:
            data = yf.download(
                tickers=batch,
                period="1d",
                interval="1d",      # daily bar only — 1 row per ticker, not 390
                group_by="ticker",
                auto_adjust=True,
                progress=False,
                threads=False,      # avoid spawning extra threads on free tier
            )
            if data.empty:
                return batch_results
            for ticker in batch:
                try:
                    if len(batch) == 1:
                        df = data
                    else:
                        df = data[ticker] if ticker in data.columns.get_level_values(0) else None
                    if df is None or df.empty:
                        continue
                    row = df.iloc[-1]
                    batch_results.append({
                        "ticker": ticker,
                        "close": float(row["Close"]),
                        "open": float(row["Open"]),
                        "high": float(row["High"]),
                        "low": float(row["Low"]),
                        "volume": int(row["Volume"]),
                        "timestamp": datetime.now(timezone.utc),
                        "market": get_market(ticker),
                        "currency": get_currency(ticker),
                    })
                except Exception as e:
                    log.debug("skip %s: %s", ticker, e)
        except Exception as e:
            log.warning("batch download failed: %s", e)
        return batch_results

    # Run batches sequentially in threadpool — avoids concurrent RAM spikes
    loop = asyncio.get_event_loop()
    batches = [tickers[i : i + _BATCH] for i in range(0, len(tickers), _BATCH)]
    for batch in batches:
        br = await loop.run_in_executor(None, _download_batch, batch)
        results.extend(br)

    log.info("fetched prices for %d/%d tickers", len(results), len(tickers))
    return results


async def fetch_indian_prices() -> list[dict]:
    """Fetch latest prices for all 100 Indian stocks."""
    return await fetch_latest_prices(INDIA_TICKERS)


async def fetch_us_prices() -> list[dict]:
    """Fetch latest prices for all 50 US stocks."""
    return await fetch_latest_prices(US_TICKERS)


async def fetch_history(ticker: str, period: str = "3mo") -> list[dict]:
    """
    Fetch OHLCV history for a single ticker.
    period: 1d, 5d, 1mo, 3mo, 6mo, 1y
    """
    def _get_history() -> list[dict]:
        try:
            df = yf.Ticker(ticker).history(period=period, auto_adjust=True)
            rows = []
            for ts, row in df.iterrows():
                rows.append({
                    "ticker": ticker,
                    "timestamp": ts.to_pydatetime().replace(tzinfo=timezone.utc),
                    "open": float(row["Open"]),
                    "high": float(row["High"]),
                    "low": float(row["Low"]),
                    "close": float(row["Close"]),
                    "volume": int(row["Volume"]),
                    "market": get_market(ticker),
                    "currency": get_currency(ticker),
                })
            return rows
        except Exception as e:
            log.error("history fetch failed for %s: %s", ticker, e)
            return []

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _get_history)
