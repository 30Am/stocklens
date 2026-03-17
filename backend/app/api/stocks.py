from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import desc, select, or_

from app.models.db import NewsArticle, Price, Signal, Stock
from app.schemas.stock import PriceCandle, PriceOut, StockDetail, StockOut
from app.services.price_fetcher import fetch_history, fetch_ticker_info
from app.utils.database import AsyncSessionLocal

router = APIRouter(prefix="/stocks", tags=["stocks"])

_YF_SEARCH = "https://query2.finance.yahoo.com/v1/finance/search"
_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; StockLens/4.0)"}


@router.get("", response_model=list[StockOut])
async def list_stocks(market: str | None = Query(None, description="IN or US")):
    async with AsyncSessionLocal() as session:
        q = select(Stock)
        if market:
            q = q.where(Stock.market == market.upper())
        rows = (await session.execute(q)).scalars().all()
        return rows


# ── Search — MUST be defined before /{ticker} to avoid route shadowing ────────
@router.get("/search", response_model=list[dict])
async def search_stocks(q: str = Query(..., min_length=1, max_length=50)):
    """
    Autocomplete: search by ticker or company name.
    Checks local DB first, then Yahoo Finance autocomplete.
    Returns up to 8 results: [{ticker, name, market, exchange}]
    """
    q_raw = q.strip()
    results: list[dict] = []

    # 1. Local DB search
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(
            select(Stock)
            .where(or_(
                Stock.ticker.ilike(f"{q_raw.upper()}%"),
                Stock.ticker.ilike(f"%{q_raw.upper()}.NS%"),
                Stock.name.ilike(f"%{q_raw}%"),
            ))
            .order_by(Stock.ticker)
            .limit(6)
        )).scalars().all()
        results = [
            {"ticker": r.ticker, "name": r.name, "market": r.market, "exchange": r.exchange}
            for r in rows
        ]

    # 2. Yahoo Finance autocomplete for remaining slots
    if len(results) < 6:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    _YF_SEARCH,
                    params={
                        "q": q_raw,
                        "quotesCount": 10,
                        "newsCount": 0,
                        "enableFuzzyQuery": "true",
                        "lang": "en-US",
                        "region": "US",
                    },
                    headers=_HEADERS,
                    timeout=5,
                )
                data = resp.json()
                existing = {r["ticker"] for r in results}
                for item in (data.get("quotes") or []):
                    sym = item.get("symbol", "")
                    if not sym:
                        continue
                    if item.get("typeDisp") not in ("Equity", "ETF"):
                        continue
                    if sym in existing:
                        continue
                    market = "IN" if (sym.endswith(".NS") or sym.endswith(".BO")) else "US"
                    results.append({
                        "ticker": sym,
                        "name": item.get("shortname") or item.get("longname") or sym,
                        "market": market,
                        "exchange": item.get("exchDisp", ""),
                    })
                    existing.add(sym)
                    if len(results) >= 8:
                        break
        except Exception:
            pass

    return results[:8]


# ── Live indices — MUST be before /{ticker} ───────────────────────────────────
@router.get("/indices/live", response_model=list[dict])
async def get_live_indices():
    """Fetch live index data for NIFTY50, SENSEX, S&P500, NASDAQ via Yahoo Finance."""
    symbols = [
        ("^NSEI",  "NIFTY 50"),
        ("^BSESN", "SENSEX"),
        ("^GSPC",  "S&P 500"),
        ("^IXIC",  "NASDAQ"),
    ]
    _url = "https://query1.finance.yahoo.com/v8/finance/chart/{sym}"
    results = []
    async with httpx.AsyncClient() as client:
        for sym, name in symbols:
            try:
                resp = await client.get(
                    _url.format(sym=sym),
                    params={"interval": "1d", "range": "5d"},
                    headers=_HEADERS,
                    timeout=10,
                )
                resp.raise_for_status()
                data = resp.json()
                result = (data.get("chart", {}).get("result") or [])
                if not result:
                    continue
                closes = result[0].get("indicators", {}).get("quote", [{}])[0].get("close", [])
                closes = [c for c in closes if c is not None]
                if len(closes) >= 2:
                    prev, close = closes[-2], closes[-1]
                    change_pct = round((close - prev) / prev * 100, 2)
                elif closes:
                    close, change_pct = closes[-1], 0.0
                else:
                    continue
                results.append({"name": name, "value": round(close, 2), "change_pct": change_pct})
            except Exception:
                continue
    return results


# ── Stock detail — dynamic lookup for any valid YF ticker ────────────────────
@router.get("/{ticker}", response_model=StockDetail)
async def get_stock(ticker: str, history_period: str = Query("1mo", description="1d|5d|1mo|3mo|6mo|1y")):
    ticker = ticker.upper()

    stock = None
    latest_price = None
    change_pct = None
    sig = None
    related_news: list[dict] = []

    async with AsyncSessionLocal() as session:
        # Exact match
        stock = (await session.execute(select(Stock).where(Stock.ticker == ticker))).scalar_one_or_none()

        # Smart suffix resolution: RELIANCE → RELIANCE.NS, TATAMOTORS → TATAMOTORS.NS
        if not stock:
            for candidate in [ticker + ".NS", ticker + ".BO"]:
                row = (await session.execute(select(Stock).where(Stock.ticker == candidate))).scalar_one_or_none()
                if row:
                    stock = row
                    ticker = row.ticker
                    break

        if stock:
            price_rows = (
                await session.execute(
                    select(Price)
                    .where(Price.ticker == ticker)
                    .order_by(desc(Price.timestamp))
                    .limit(2)
                )
            ).scalars().all()
            latest_price = price_rows[0].close if price_rows else None
            prev_price = price_rows[1].close if len(price_rows) > 1 else None
            change_pct = (
                round((latest_price - prev_price) / prev_price * 100, 2)
                if latest_price and prev_price else None
            )

            sig = (
                await session.execute(
                    select(Signal)
                    .where(Signal.ticker == ticker)
                    .order_by(desc(Signal.created_at))
                    .limit(1)
                )
            ).scalar_one_or_none()

            news_ids = [
                r[0] for r in (
                    await session.execute(
                        select(Signal.news_id)
                        .where(Signal.ticker == ticker, Signal.news_id.is_not(None))
                        .distinct()
                    )
                ).all()
            ]
            if news_ids:
                news_rows = (
                    await session.execute(
                        select(NewsArticle)
                        .where(NewsArticle.id.in_(news_ids[:5]))
                        .order_by(desc(NewsArticle.published))
                    )
                ).scalars().all()
                related_news = [
                    {"headline": n.headline, "source": n.source, "url": n.url, "published": n.published}
                    for n in news_rows
                ]

    # Price history from Yahoo Finance — works for ANY valid ticker worldwide
    history_data = await fetch_history(ticker, period=history_period)
    price_history = [
        PriceCandle(
            time=p["timestamp"].strftime("%Y-%m-%d"),
            open=p.get("open"),
            high=p.get("high"),
            low=p.get("low"),
            close=p["close"],
            volume=p.get("volume"),
        )
        for p in history_data
    ]

    # If not in DB, fetch metadata from Yahoo Finance on-demand
    if not stock:
        info = await fetch_ticker_info(ticker)
        if not info and not price_history:
            raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' not found on any exchange")

        if info:
            name = info["name"]
            exchange = info["exchange"]
            sector = None
            market = info["market"]
            currency = info["currency"]
            latest_price = latest_price or info.get("close")
        else:
            is_indian = ticker.endswith(".NS") or ticker.endswith(".BO")
            market = "IN" if is_indian else "US"
            currency = "INR" if is_indian else "USD"
            exchange = "NSE" if ticker.endswith(".NS") else ("BSE" if ticker.endswith(".BO") else "NYSE")
            name = ticker
            sector = None
    else:
        name = stock.name
        exchange = stock.exchange
        sector = stock.sector
        market = stock.market
        currency = stock.currency

    # Fall back to history price when no DB price stored yet
    if latest_price is None and price_history:
        latest_price = price_history[-1].close
        if len(price_history) >= 2:
            prev = price_history[-2].close
            change_pct = round((latest_price - prev) / prev * 100, 2) if prev else None

    return StockDetail(
        ticker=ticker,
        name=name,
        exchange=exchange,
        sector=sector,
        market=market,
        currency=currency,
        close=latest_price,
        change_pct=change_pct,
        signal=sig.signal if sig else "HOLD",
        score=sig.score if sig else None,
        reason=sig.reason if sig else None,
        price_history=price_history,
        related_news=related_news,
    )


@router.get("/{ticker}/prices", response_model=list[PriceOut])
async def get_price_history(
    ticker: str,
    period: str = Query("1mo", description="1d|5d|1mo|3mo|6mo|1y"),
):
    """OHLCV history for candlestick chart."""
    data = await fetch_history(ticker.upper(), period=period)
    if not data:
        raise HTTPException(status_code=404, detail=f"No price data for '{ticker}'")
    return [
        PriceOut(
            timestamp=p["timestamp"],
            open=p.get("open"),
            high=p.get("high"),
            low=p.get("low"),
            close=p["close"],
            volume=p.get("volume"),
        )
        for p in data
    ]
