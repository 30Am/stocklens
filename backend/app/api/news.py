from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import desc, select

from app.models.db import NewsArticle
from app.schemas.news import NewsOut
from app.utils.database import AsyncSessionLocal

router = APIRouter(prefix="/news", tags=["news"])


@router.get("", response_model=list[NewsOut])
async def list_news(
    market: str | None = Query(None, description="IN or US"),
    limit: int = Query(30, le=100),
):
    async with AsyncSessionLocal() as session:
        q = select(NewsArticle).order_by(desc(NewsArticle.published)).limit(limit)
        if market:
            q = q.where(NewsArticle.market == market.upper())
        rows = (await session.execute(q)).scalars().all()
        return rows
