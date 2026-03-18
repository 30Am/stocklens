from __future__ import annotations

from datetime import datetime
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/forex", tags=["forex"])


class ForexOut(BaseModel):
    pair: str
    rate: float
    change_pct: float | None
    updated_at: datetime | None


@router.get("", response_model=ForexOut)
async def get_forex():
    from app.services.forex_fetcher import get_cached_rate, get_cached_change_pct, _cached_at
    return ForexOut(
        pair="USD_INR",
        rate=get_cached_rate(),
        change_pct=get_cached_change_pct(),
        updated_at=_cached_at,
    )
