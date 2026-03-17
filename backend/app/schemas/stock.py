from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel


class StockOut(BaseModel):
    ticker: str
    name: str
    exchange: str
    sector: str | None
    market: str
    currency: str
    index: str | None

    class Config:
        from_attributes = True


class PriceOut(BaseModel):
    timestamp: datetime
    open: float | None
    high: float | None
    low: float | None
    close: float
    volume: int | None

    class Config:
        from_attributes = True


class PriceCandle(BaseModel):
    time: str  # YYYY-MM-DD string for lightweight-charts
    open: float | None
    high: float | None
    low: float | None
    close: float
    volume: int | None


class SignalOut(BaseModel):
    ticker: str
    signal: str
    score: float | None
    reason: str | None
    created_at: datetime | None

    class Config:
        from_attributes = True


class StockDetail(BaseModel):
    ticker: str
    name: str
    exchange: str
    sector: str | None
    market: str
    currency: str
    close: float | None          # latest price
    change_pct: float | None     # % change vs previous close
    open: float | None = None
    high: float | None = None
    low: float | None = None
    volume: int | None = None
    week52_high: float | None = None
    week52_low: float | None = None
    market_cap: float | None = None
    pe_ratio: float | None = None
    signal: str
    score: float | None
    reason: str | None
    price_history: list[PriceCandle]
    related_news: list[dict]
