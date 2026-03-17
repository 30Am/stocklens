"""
LLM explainer — GPT-4o-mini one-line AI explanations.
Gracefully degrades to a template if OPENAI_API_KEY is not set.
"""
from __future__ import annotations

import logging

from app.core.config import settings

log = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is None and settings.openai_api_key:
        try:
            from openai import AsyncOpenAI
            _client = AsyncOpenAI(api_key=settings.openai_api_key)
        except Exception as e:
            log.warning("OpenAI client init failed: %s", e)
    return _client


async def explain(
    ticker: str,
    ticker_name: str,
    headline: str,
    signal: str,
    score: float,
    market: str,
) -> str:
    """
    Returns a 1-line AI explanation like:
    "Infosys up on Fed pause hopes — US rate hold boosts IT export margins"
    """
    client = _get_client()

    if client:
        try:
            market_ctx = "Indian (NSE/BSE)" if market == "IN" else "US (NYSE/NASDAQ)"
            prompt = (
                f"You are a financial analyst. In ONE concise sentence (max 20 words), "
                f"explain why {ticker_name} ({ticker}) is showing a {signal} signal "
                f"based on this news: '{headline}'. "
                f"Market: {market_ctx}. Sentiment score: {score:+.2f}. "
                f"Be specific, not generic. No disclaimers."
            )
            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=60,
                temperature=0.3,
            )
            explanation = resp.choices[0].message.content.strip().strip('"')
            log.debug("LLM explain [%s]: %s", ticker, explanation)
            return explanation
        except Exception as e:
            log.warning("LLM explain failed for %s: %s", ticker, e)

    # Fallback: rule-based template
    return _template_explain(ticker_name, signal, score, headline)


def _template_explain(name: str, signal: str, score: float, headline: str) -> str:
    """Deterministic fallback explanation without LLM."""
    direction = "positive" if score > 0 else "negative"
    short_news = headline[:60] + "..." if len(headline) > 60 else headline
    templates = {
        "BUY":  f"{name} bullish on {direction} sentiment: '{short_news}'",
        "SELL": f"{name} bearish on {direction} sentiment: '{short_news}'",
        "HOLD": f"{name} neutral — mixed signals from: '{short_news}'",
    }
    return templates.get(signal, f"{name}: {signal} signal based on recent news")
