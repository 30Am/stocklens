from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import desc, select

from app.models.db import NewsArticle, Price, Signal, Stock
from app.schemas.stock import PriceCandle, PriceOut, StockDetail, StockOut
from app.services.price_fetcher import fetch_history
from app.utils.database import AsyncSessionLocal

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("", response_model=list[StockOut])
async def list_stocks(market: str | None = Query(None, description="IN or US")):
    async with AsyncSessionLocal() as session:
        q = select(Stock)
        if market:
            q = q.where(Stock.market == market.upper())
        rows = (await session.execute(q)).scalars().all()
        return rows


@router.get("/{ticker}", response_model=StockDetail)
async def get_stock(ticker: str, history_period: str = Query("1mo", description="1d|5d|1mo|3mo|6mo|1y")):
    ticker = ticker.upper()

    async with AsyncSessionLocal() as session:
        # Stock info
        stock = (await session.execute(select(Stock).where(Stock.ticker == ticker))).scalar_one_or_none()
        if not stock:
            raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' not found")

        # Latest 2 prices for % change calc
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
        change_pct = round((latest_price - prev_price) / prev_price * 100, 2) if latest_price and prev_price else None

        # Latest signal
        sig = (
            await session.execute(
                select(Signal)
                .where(Signal.ticker == ticker)
                .order_by(desc(Signal.created_at))
                .limit(1)
            )
        ).scalar_one_or_none()

        # Related news (via signals)
        news_ids_q = select(Signal.news_id).where(Signal.ticker == ticker, Signal.news_id.is_not(None)).distinct()
        news_ids = [r[0] for r in (await session.execute(news_ids_q)).all()]
        related_news = []
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

    # Fetch price history from yfinance (live — not stored in DB for space)
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

    return StockDetail(
        ticker=stock.ticker,
        name=stock.name,
        exchange=stock.exchange,
        sector=stock.sector,
        market=stock.market,
        currency=stock.currency,
        close=latest_price,
        change_pct=change_pct,
        signal=sig.signal if sig else "HOLD",
        score=sig.score if sig else None,
        reason=sig.reason if sig else None,
        price_history=price_history,
        related_news=related_news,
    )


@router.get("/indices/live", response_model=list[dict])
async def get_live_indices():
    """Fetch live index data for NIFTY50, SENSEX, S&P500, NASDAQ."""
    import yfinance as yf
    symbols = [
        ("^NSEI",  "NIFTY 50"),
        ("^BSESN", "SENSEX"),
        ("^GSPC",  "S&P 500"),
        ("^IXIC",  "NASDAQ"),
    ]
    results = []
    for sym, name in symbols:
        try:
            t = yf.Ticker(sym)
            hist = t.history(period="2d")
            if len(hist) >= 2:
                prev  = float(hist["Close"].iloc[-2])
                close = float(hist["Close"].iloc[-1])
                change_pct = round((close - prev) / prev * 100, 2)
            elif len(hist) == 1:
                close = float(hist["Close"].iloc[-1])
                change_pct = 0.0
            else:
                continue
            results.append({"name": name, "value": round(close, 2), "change_pct": change_pct})
        except Exception:
            continue
    return results


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
