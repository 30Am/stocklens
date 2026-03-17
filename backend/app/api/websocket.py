"""
WebSocket — live price push to connected frontend clients.

Usage (frontend):
    const ws = new WebSocket("ws://localhost:8001/ws/prices");
    ws.onmessage = (e) => {
        const prices = JSON.parse(e.data);  // [{ticker, close, change_pct, signal}, ...]
    };

    const wsNews = new WebSocket("ws://localhost:8001/ws/news");
    wsNews.onmessage = (e) => {
        const article = JSON.parse(e.data);  // {headline, source, market, tickers}
    };
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import TYPE_CHECKING

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

if TYPE_CHECKING:
    pass

log = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])


# ── Connection manager ────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self._price_connections: list[WebSocket] = []
        self._news_connections: list[WebSocket] = []

    async def connect_prices(self, ws: WebSocket):
        await ws.accept()
        self._price_connections.append(ws)
        log.info("WS prices: client connected (%d total)", len(self._price_connections))

    async def connect_news(self, ws: WebSocket):
        await ws.accept()
        self._news_connections.append(ws)
        log.info("WS news: client connected (%d total)", len(self._news_connections))

    def disconnect_prices(self, ws: WebSocket):
        self._price_connections = [c for c in self._price_connections if c is not ws]
        log.info("WS prices: client disconnected (%d remaining)", len(self._price_connections))

    def disconnect_news(self, ws: WebSocket):
        self._news_connections = [c for c in self._news_connections if c is not ws]

    async def broadcast_prices(self, data: list[dict]):
        """Called by the price pipeline after each fetch."""
        if not self._price_connections:
            return
        payload = json.dumps(data, default=str)
        dead: list[WebSocket] = []
        for ws in self._price_connections:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_prices(ws)

    async def broadcast_news(self, article: dict):
        """Called by the news pipeline when a new article + signal is saved."""
        if not self._news_connections:
            return
        payload = json.dumps(article, default=str)
        dead: list[WebSocket] = []
        for ws in self._news_connections:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_news(ws)


# Singleton — imported by data_pipeline to push updates
manager = ConnectionManager()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.websocket("/ws/prices")
async def ws_prices(websocket: WebSocket):
    """
    Streams live price + signal snapshots.
    Pushes a fresh batch immediately on connect, then on every scheduler tick.
    """
    await manager.connect_prices(websocket)
    try:
        # Send current snapshot on connect
        snapshot = await _build_price_snapshot()
        await websocket.send_text(json.dumps(snapshot, default=str))

        # Keep connection alive; updates pushed by broadcast_prices()
        while True:
            await asyncio.sleep(30)
            # Send a keepalive ping every 30 s
            await websocket.send_text(json.dumps({"type": "ping"}, default=str))
    except WebSocketDisconnect:
        manager.disconnect_prices(websocket)
    except Exception as e:
        log.warning("WS prices error: %s", e)
        manager.disconnect_prices(websocket)


@router.websocket("/ws/news")
async def ws_news(websocket: WebSocket):
    """Streams new news articles + their signals as they arrive."""
    await manager.connect_news(websocket)
    try:
        while True:
            await asyncio.sleep(60)
            await websocket.send_text(json.dumps({"type": "ping"}, default=str))
    except WebSocketDisconnect:
        manager.disconnect_news(websocket)
    except Exception as e:
        log.warning("WS news error: %s", e)
        manager.disconnect_news(websocket)


async def _build_price_snapshot() -> list[dict]:
    """Fetch latest price + signal for all stocks from DB."""
    from sqlalchemy import desc, select, func
    from app.models.db import Price, Signal, Stock
    from app.utils.database import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        # Latest price per ticker (subquery)
        latest_price_sq = (
            select(func.max(Price.id).label("max_id"))
            .group_by(Price.ticker)
            .subquery()
        )
        # Latest signal per ticker (subquery)
        latest_signal_sq = (
            select(func.max(Signal.id).label("max_id"))
            .group_by(Signal.ticker)
            .subquery()
        )

        price_rows = (
            await session.execute(
                select(Price).where(Price.id.in_(select(latest_price_sq.c.max_id)))
            )
        ).scalars().all()

        signal_rows = (
            await session.execute(
                select(Signal).where(Signal.id.in_(select(latest_signal_sq.c.max_id)))
            )
        ).scalars().all()

        signal_map = {s.ticker: s for s in signal_rows}

        result = []
        for p in price_rows:
            sig = signal_map.get(p.ticker)
            result.append({
                "ticker": p.ticker,
                "close": p.close,
                "open": p.open,
                "high": p.high,
                "low": p.low,
                "volume": p.volume,
                "signal": sig.signal if sig else "HOLD",
                "score": sig.score if sig else 0.0,
                "timestamp": p.timestamp,
            })

    return result
