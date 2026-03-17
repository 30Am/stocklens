from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import desc, func, select

from app.models.db import CrossMarketEvent, Signal, Stock
from app.schemas.signal import CrossMarketEventOut, SignalOut
from app.utils.database import AsyncSessionLocal

router = APIRouter(tags=["signals"])


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
        return [
            SignalOut(ticker=s.ticker, name=st.name, signal=s.signal, score=s.score,
                      reason=s.reason, market=st.market, sector=st.sector, created_at=s.created_at)
            for s, st in rows
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
