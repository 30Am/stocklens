from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    tickers: list[str] | None = None


class ChatResponse(BaseModel):
    reply: str
    tickers_mentioned: list[str]
    signals: list[dict]


@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Ask StockLens AI a question about stocks or markets."""
    from app.services.ai_chat import answer
    result = await answer(req.message, req.tickers)
    return ChatResponse(**result)
