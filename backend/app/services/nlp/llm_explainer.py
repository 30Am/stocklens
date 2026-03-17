"""
LLM explainer — Groq (Llama 3.3 70B) one-line AI explanations.
Falls back to OpenAI if GROQ_API_KEY not set, then to template.
"""
from __future__ import annotations

import logging

from app.core.config import settings

log = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client

    # Try Groq first (free, fast, OpenAI-compatible)
    if settings.groq_api_key:
        try:
            from openai import AsyncOpenAI
            _client = AsyncOpenAI(
                api_key=settings.groq_api_key,
                base_url="https://api.groq.com/openai/v1",
            )
            log.info("LLM explainer: using Groq (Llama 3.3 70B)")
            return _client
        except Exception as e:
            log.warning("Groq client init failed: %s", e)

    # Fallback to OpenAI
    if settings.openai_api_key:
        try:
            from openai import AsyncOpenAI
            _client = AsyncOpenAI(api_key=settings.openai_api_key)
            log.info("LLM explainer: using OpenAI")
            return _client
        except Exception as e:
            log.warning("OpenAI client init failed: %s", e)

    return None


def _get_model() -> str:
    if settings.groq_api_key:
        return "llama-3.3-70b-versatile"
    return "gpt-4o-mini"


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
                model=_get_model(),
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
