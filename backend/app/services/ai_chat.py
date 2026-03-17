"""
AI Chat service — answers stock/market questions with DB context.
Uses GPT-4o-mini when OPENAI_API_KEY is set; template fallback otherwise.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import desc, func, select

from app.models.db import NewsArticle, Signal, Stock
from app.utils.database import AsyncSessionLocal

log = logging.getLogger(__name__)

_TEMPLATE_REPLIES = {
    "buy": "Based on current signals, {tickers} show bullish momentum driven by recent positive sentiment. The AI score suggests accumulation at current levels, though always conduct your own due diligence.",
    "sell": "Recent signals for {tickers} indicate bearish pressure — negative sentiment from news flow and rule-based factors. Consider risk management if holding positions.",
    "hold": "Current signals for {tickers} are mixed or neutral. The market is awaiting clearer catalysts before a directional move.",
    "default": "StockLens is monitoring {tickers}. Latest signals and sentiment scores are reflected in the dashboard. Check the stock detail page for the most recent AI explanation.",
}


async def _fetch_context(tickers: list[str]) -> dict:
    """Pull latest signals + news from DB for given tickers."""
    async with AsyncSessionLocal() as session:
        signals: list[dict] = []
        news: list[dict] = []

        if tickers:
            # Latest signal per ticker
            latest_sq = (
                select(func.max(Signal.id).label("max_id"))
                .where(Signal.ticker.in_(tickers))
                .group_by(Signal.ticker)
                .subquery()
            )
            sig_rows = (
                await session.execute(
                    select(Signal, Stock)
                    .join(Stock, Signal.ticker == Stock.ticker, isouter=True)
                    .where(Signal.id.in_(select(latest_sq.c.max_id)))
                )
            ).all()
            for sig, stk in sig_rows:
                signals.append({
                    "ticker": sig.ticker,
                    "name": stk.name if stk else sig.ticker,
                    "signal": sig.signal,
                    "score": round(sig.score, 3),
                    "reason": sig.reason,
                })

        # Recent news (up to 6 headlines)
        news_rows = (
            await session.execute(
                select(NewsArticle)
                .order_by(desc(NewsArticle.fetched_at))
                .limit(6)
            )
        ).scalars().all()
        for a in news_rows:
            news.append({"headline": a.headline, "source": a.source or ""})

    return {"signals": signals, "news": news}


def _build_system_prompt(context: dict) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "You are StockLens AI, an expert financial assistant focused on India (NSE/BSE) and US (NYSE/NASDAQ) equity markets.",
        f"Current time: {now}",
        "Respond concisely (2-4 sentences). Do not give specific buy/sell advice — only provide analytical insight based on the data provided.",
        "",
    ]
    if context["signals"]:
        lines.append("## Current AI Signals:")
        for s in context["signals"]:
            lines.append(f"- {s['ticker']} ({s.get('name', '')}): {s['signal']} | score={s['score']} | {s['reason']}")
        lines.append("")
    if context["news"]:
        lines.append("## Recent Headlines:")
        for n in context["news"]:
            src = f" [{n['source']}]" if n["source"] else ""
            lines.append(f"- {n['headline']}{src}")
    return "\n".join(lines)


def _template_reply(signals: list[dict], tickers: list[str]) -> str:
    ticker_str = ", ".join(tickers) if tickers else "the stocks you mentioned"
    if not signals:
        return _TEMPLATE_REPLIES["default"].format(tickers=ticker_str)
    buys = [s for s in signals if s["signal"] == "BUY"]
    sells = [s for s in signals if s["signal"] == "SELL"]
    if buys and not sells:
        return _TEMPLATE_REPLIES["buy"].format(tickers=ticker_str)
    if sells and not buys:
        return _TEMPLATE_REPLIES["sell"].format(tickers=ticker_str)
    return _TEMPLATE_REPLIES["hold"].format(tickers=ticker_str)


async def answer(message: str, extra_tickers: list[str] | None = None) -> dict:
    """
    Main entry point. Returns { reply, tickers_mentioned, signals }.
    """
    from app.services.nlp.ticker_mapper import extract_tickers

    mentioned = list(extract_tickers(message))
    if extra_tickers:
        mentioned = list(set(mentioned) | set(extra_tickers))

    context = await _fetch_context(mentioned)

    # Try OpenAI
    try:
        import os
        from openai import AsyncOpenAI  # type: ignore[import-untyped]

        api_key = os.getenv("OPENAI_API_KEY", "")
        if not api_key:
            raise RuntimeError("No OPENAI_API_KEY")

        client = AsyncOpenAI(api_key=api_key)
        system_prompt = _build_system_prompt(context)
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message},
            ],
            max_tokens=200,
            temperature=0.4,
        )
        reply = resp.choices[0].message.content or ""
        log.info("[chat] GPT-4o-mini replied (%d chars)", len(reply))
    except Exception as e:
        log.warning("[chat] LLM unavailable (%s), using template", e)
        reply = _template_reply(context["signals"], mentioned)

    return {
        "reply": reply.strip(),
        "tickers_mentioned": mentioned,
        "signals": context["signals"],
    }
