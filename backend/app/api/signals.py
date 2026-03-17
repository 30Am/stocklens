from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import desc, func, select
import asyncio
import yfinance as yf

from app.models.db import CrossMarketEvent, Signal, Stock
from app.schemas.signal import CrossMarketEventOut, SignalOut
from app.utils.database import AsyncSessionLocal

router = APIRouter(tags=["signals"])


async def _fetch_price(ticker: str) -> tuple[float | None, float | None]:
    """Fetch latest close and change_pct from yfinance asynchronously."""
    try:
        loop = asyncio.get_event_loop()
        def _get():
            t = yf.Ticker(ticker)
            hist = t.history(period="2d")
            if len(hist) >= 2:
                prev = float(hist["Close"].iloc[-2])
                close = float(hist["Close"].iloc[-1])
                return round(close, 2), round((close - prev) / prev * 100, 2)
            elif len(hist) == 1:
                return round(float(hist["Close"].iloc[-1]), 2), 0.0
            return None, None
        return await loop.run_in_executor(None, _get)
    except Exception:
        return None, None


@router.get("/signal/{ticker}", response_model=SignalOut)
async def get_signal(ticker: str):
    ticker = ticker.upper()
    async with AsyncSessionLocal() as session:
        sig = (
            await session.execute(
                select(Signal, Stock)
                .join(Stock, Signal.ticker == Stock.ticker)
                .where(Signal.ticker == ticker)
                .order_by(desc(Signal.created_at))
                .limit(1)
            )
        ).first()
        if not sig:
            return SignalOut(ticker=ticker, name=None, signal="HOLD", score=0.0,
                             reason="No signal yet", market=None, sector=None, created_at=None)
        s, st = sig
        return SignalOut(ticker=s.ticker, name=st.name, signal=s.signal, score=s.score,
                         reason=s.reason, market=st.market, sector=st.sector, created_at=s.created_at)


@router.get("/trending", response_model=list[SignalOut])
async def get_trending(
    market: str | None = Query(None, description="IN or US"),
    limit: int = Query(10, le=50),
):
    """Top movers ranked by absolute sentiment score — deduplicated to one signal per ticker."""
    async with AsyncSessionLocal() as session:
        # Subquery: latest signal id per ticker
        latest_subq = (
            select(func.max(Signal.id).label("max_id"))
            .group_by(Signal.ticker)
            .subquery()
        )
        q = (
            select(Signal, Stock)
            .join(Stock, Signal.ticker == Stock.ticker)
            .where(Signal.id.in_(select(latest_subq.c.max_id)))
            .order_by(desc(func.abs(Signal.score)))
            .limit(limit)
        )
        if market:
            q = q.where(Stock.market == market.upper())
        rows = (await session.execute(q)).all()
        # Fetch live prices concurrently
        prices = await asyncio.gather(*[_fetch_price(s.ticker) for s, _ in rows])
        return [
            SignalOut(
                ticker=s.ticker, name=st.name, signal=s.signal, score=s.score,
                reason=s.reason, market=st.market, sector=st.sector,
                created_at=s.created_at,
                close=prices[i][0], change_pct=prices[i][1],
                currency="INR" if st.market == "IN" else "USD",
                exchange=st.exchange,
            )
            for i, (s, st) in enumerate(rows)
        ]


@router.get("/cross-market-events", response_model=list[CrossMarketEventOut])
async def get_cross_market_events(limit: int = Query(20, le=100)):
    async with AsyncSessionLocal() as session:
        rows = (
            await session.execute(
                select(CrossMarketEvent)
                .order_by(desc(CrossMarketEvent.created_at))
                .limit(limit)
            )
        ).scalars().all()
        return rows
