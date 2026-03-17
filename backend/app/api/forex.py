from __future__ import annotations

from datetime import datetime
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/forex", tags=["forex"])


class ForexOut(BaseModel):
    pair: str
    rate: float
    updated_at: datetime | None


@router.get("", response_model=ForexOut)
async def get_forex():
    from app.services.forex_fetcher import get_cached_rate, _cached_at
    return ForexOut(pair="USD_INR", rate=get_cached_rate(), updated_at=_cached_at)
