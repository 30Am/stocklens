from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel


class NewsOut(BaseModel):
    id: int
    headline: str
    source: str | None
    url: str | None
    market: str | None
    published: datetime | None

    class Config:
        from_attributes = True
