"""
Forex fetcher — USD/INR rate updated hourly.

Primary:  ExchangeRate-API (free, 1500 req/month)
Fallback:  Frankfurter API (ECB-based, completely free, no key)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)

_PAIR = "USD_INR"
_cached_rate: float | None = None
_prev_rate: float | None = None        # rate before the most recent update
_cached_at: datetime | None = None

_FALLBACK_RATE = 86.0  # approximate rate — only used if all live sources fail


def get_cached_change_pct() -> float | None:
    """Return % change between the last two fetched rates, or None if unavailable."""
    if _cached_rate and _prev_rate and _prev_rate != 0:
        return round((_cached_rate - _prev_rate) / _prev_rate * 100, 3)
    return None


async def fetch_usd_inr() -> float:
    """
    Returns current USD→INR exchange rate.
    Caches in-memory; scheduler refreshes every hour.
    Each call saves the previous rate so change_pct can be derived.
    """
    global _cached_rate, _prev_rate, _cached_at

    # Try ExchangeRate-API if key is set
    if settings.exchange_rate_api_key:
        rate = await _from_exchangerate_api()
        if rate:
            _prev_rate = _cached_rate
            _cached_rate = rate
            _cached_at = datetime.now(timezone.utc)
            return rate

    # Fallback 1: Frankfurter API (ECB rates, no key required)
    rate = await _from_frankfurter()
    if rate:
        _prev_rate = _cached_rate
        _cached_rate = rate
        _cached_at = datetime.now(timezone.utc)
        return rate

    # Last resort: return cached value or hard-coded fallback
    if _cached_rate:
        log.warning("forex: using stale cached rate %.2f", _cached_rate)
        return _cached_rate

    log.error("forex: all sources failed, using fallback %.2f", _FALLBACK_RATE)
    return _FALLBACK_RATE


async def _from_exchangerate_api() -> float | None:
    url = f"https://v6.exchangerate-api.com/v6/{settings.exchange_rate_api_key}/pair/USD/INR"
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            rate = float(data["conversion_rate"])
            log.info("forex: USD/INR = %.4f (ExchangeRate-API)", rate)
            return rate
    except Exception as e:
        log.warning("ExchangeRate-API failed: %s", e)
        return None


async def _from_frankfurter() -> float | None:
    """Frankfurter API — ECB reference rates, free with no key required."""
    url = "https://api.frankfurter.app/latest?from=USD&to=INR"
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            rate = float(data["rates"]["INR"])
            log.info("forex: USD/INR = %.4f (Frankfurter/ECB)", rate)
            return rate
    except Exception as e:
        log.warning("Frankfurter API failed: %s", e)
        return None


def get_cached_rate() -> float:
    """Return the last fetched rate (or _FALLBACK_RATE if never fetched)."""
    return _cached_rate or _FALLBACK_RATE
