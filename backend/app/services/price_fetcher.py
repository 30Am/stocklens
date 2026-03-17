"""
Price fetcher — direct Yahoo Finance JSON API via httpx.

No yfinance / pandas / numpy — each ticker is one async HTTP request,
keeping peak memory well under Railway's 512 MB free-tier limit.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

import httpx

from app.core.universe import INDIA_TICKERS, US_TICKERS, get_currency, get_market

log = logging.getLogger(__name__)

_YF_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; StockLens/4.0; +https://stocklens.vercel.app)"}
_CONCURRENCY = 5   # max simultaneous Yahoo Finance requests


async def _fetch_one(client: httpx.AsyncClient, ticker: str, sem: asyncio.Semaphore) -> dict | None:
    """Fetch the latest OHLCV snapshot for a single ticker."""
    async with sem:
        try:
            resp = await client.get(
                _YF_CHART.format(ticker=ticker),
                params={"interval": "1d", "range": "1d"},
                headers=_HEADERS,
                timeout=12,
            )
            resp.raise_for_status()
            data = resp.json()
            result = data.get("chart", {}).get("result") or []
            if not result:
                return None
            meta = result[0].get("meta", {})
            price = (
                meta.get("regularMarketPrice")
                or meta.get("chartPreviousClose")
                or meta.get("previousClose")
            )
            if price is None:
                return None
            return {
                "ticker": ticker,
                "close":  float(price),
                "open":   float(meta.get("regularMarketOpen")    or price),
                "high":   float(meta.get("regularMarketDayHigh") or price),
                "low":    float(meta.get("regularMarketDayLow")  or price),
                "volume": int(meta.get("regularMarketVolume")    or 0),
                "timestamp": datetime.now(timezone.utc),
                "market":   get_market(ticker),
                "currency": get_currency(ticker),
            }
        except Exception as e:
            log.debug("skip %s: %s", ticker, e)
            return None


async def fetch_latest_prices(tickers: list[str]) -> list[dict]:
    """
    Fetch latest price snapshot for every ticker concurrently via Yahoo
    Finance JSON API.  No pandas / numpy — pure async httpx.
    """
    sem = asyncio.Semaphore(_CONCURRENCY)
    async with httpx.AsyncClient() as client:
        tasks = [_fetch_one(client, t, sem) for t in tickers]
        fetched = await asyncio.gather(*tasks)
    results = [r for r in fetched if r is not None]
    log.info("fetched prices for %d/%d tickers", len(results), len(tickers))
    return results


async def fetch_indian_prices() -> list[dict]:
    """Fetch latest prices for all Indian stocks."""
    return await fetch_latest_prices(INDIA_TICKERS)


async def fetch_us_prices() -> list[dict]:
    """Fetch latest prices for all US stocks."""
    return await fetch_latest_prices(US_TICKERS)


async def fetch_history(ticker: str, period: str = "3mo") -> list[dict]:
    """
    Fetch OHLCV history for a single ticker via Yahoo Finance JSON API.
    period: 1d | 5d | 1mo | 3mo | 6mo | 1y
    """
    _range_map = {"1d": "1d", "5d": "5d", "1mo": "1mo", "3mo": "3mo", "6mo": "6mo", "1y": "1y"}
    yf_range = _range_map.get(period, "3mo")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                _YF_CHART.format(ticker=ticker),
                params={"interval": "1d", "range": yf_range},
                headers=_HEADERS,
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            result = data.get("chart", {}).get("result") or []
            if not result:
                return []

            chart = result[0]
            timestamps = chart.get("timestamp", [])
            q = chart.get("indicators", {}).get("quote", [{}])[0]
            opens   = q.get("open",   [])
            highs   = q.get("high",   [])
            lows    = q.get("low",    [])
            closes  = q.get("close",  [])
            volumes = q.get("volume", [])

            rows = []
            for i, ts in enumerate(timestamps):
                close = closes[i] if i < len(closes) else None
                if close is None:
                    continue
                rows.append({
                    "ticker":    ticker,
                    "timestamp": datetime.fromtimestamp(ts, tz=timezone.utc),
                    "open":   float(opens[i])   if i < len(opens)   and opens[i]   else float(close),
                    "high":   float(highs[i])   if i < len(highs)   and highs[i]   else float(close),
                    "low":    float(lows[i])    if i < len(lows)    and lows[i]    else float(close),
                    "close":  float(close),
                    "volume": int(volumes[i])   if i < len(volumes) and volumes[i] else 0,
                    "market":   get_market(ticker),
                    "currency": get_currency(ticker),
                })
            return rows
    except Exception as e:
        log.error("history fetch failed for %s: %s", ticker, e)
        return []
