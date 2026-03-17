from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel


class SignalOut(BaseModel):
    ticker: str
    name: str | None
    signal: str
    score: float | None
    reason: str | None
    market: str | None
    sector: str | None
    created_at: datetime | None


class CrossMarketEventOut(BaseModel):
    id: int
    in_ticker: str | None
    us_ticker: str | None
    event: str
    impact: str | None
    created_at: datetime | None

    class Config:
        from_attributes = True
