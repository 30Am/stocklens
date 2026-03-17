"""
NLP pipeline orchestrator.

For each news article:
  1. Clean text
  2. Detect language → translate if non-English
  3. Extract affected tickers
  4. Run sentiment (FinBERT / VADER)
  5. Apply domain rules (SEBI/RBI/FOMC/F&O)
  6. Compute final score → BUY/HOLD/SELL signal
  7. Generate LLM explanation
  8. Detect cross-market events
  9. Save signals + cross-market events to DB
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.models.db import CrossMarketEvent, NewsArticle, Signal
from app.services.nlp.cross_market import detect_cross_market_events
from app.services.nlp.lang_processor import clean_text, detect_and_translate
from app.services.nlp.llm_explainer import explain
from app.services.nlp.rule_engine import (
    apply_india_rules,
    apply_us_rules,
    is_fo_expiry_week,
    is_us_opex_week,
)
from app.services.nlp.sentiment import SentimentResult, analyse, score_to_signal
from app.services.nlp.ticker_mapper import extract_tickers
from app.utils.database import AsyncSessionLocal

log = logging.getLogger(__name__)


async def process_article(article: NewsArticle) -> int:
    """
    Run full NLP pipeline on one NewsArticle.
    Returns number of signals saved.
    """
    # 1. Clean
    text = clean_text(f"{article.headline} {article.raw_text or ''}")

    # 2. Translate if non-English
    text_en, lang = detect_and_translate(text)
    if lang != "en":
        log.debug("translated article %d from %s", article.id, lang)

    # 3. Extract tickers
    tickers = extract_tickers(text_en)
    if not tickers:
        log.debug("no tickers found in article %d", article.id)
        return 0

    # 4. Base sentiment
    sentiment: SentimentResult = analyse(text_en)

    # 5. Domain rules
    market = article.market or "IN"
    rule_matches = apply_india_rules(text_en) if market == "IN" else apply_us_rules(text_en)

    # F&O / OpEx volatility flags
    if market == "IN" and is_fo_expiry_week():
        log.debug("F&O expiry week — volatility flag set")
    if market == "US" and is_us_opex_week():
        log.debug("US OpEx week — volatility flag set")

    # Accumulate rule score deltas and extra tickers
    total_delta = sum(r.score_delta for r in rule_matches)
    for r in rule_matches:
        tickers = list(set(tickers + r.extra_tickers))

    # 6. Final score + signal
    final_score = max(-1.0, min(1.0, sentiment.score + total_delta))
    signal_str = score_to_signal(final_score)

    # 7. LLM explanation (one per article, for the first ticker)
    primary_ticker = tickers[0]
    ticker_info = __import__("app.core.universe", fromlist=["TICKER_MAP"]).TICKER_MAP.get(primary_ticker, {})
    ticker_name = ticker_info.get("name", primary_ticker)

    explanation = await explain(
        ticker=primary_ticker,
        ticker_name=ticker_name,
        headline=article.headline,
        signal=signal_str,
        score=final_score,
        market=market,
    )

    rule_descriptions = "; ".join(r.description for r in rule_matches) if rule_matches else None
    full_reason = explanation
    if rule_descriptions:
        full_reason = f"{explanation} [{rule_descriptions}]"

    # 8. Cross-market events
    cross_events = detect_cross_market_events(text_en, tickers)

    # 9. Save to DB
    saved = 0
    async with AsyncSessionLocal() as session:
        for ticker in tickers:
            row = Signal(
                ticker=ticker,
                signal=signal_str,
                score=round(final_score, 4),
                reason=full_reason[:500],
                news_id=article.id,
                created_at=datetime.now(timezone.utc),
            )
            session.add(row)
            saved += 1

        for ce in cross_events:
            row = CrossMarketEvent(
                in_ticker=ce.in_ticker,
                us_ticker=ce.us_ticker,
                event=ce.event,
                impact=ce.impact,
                created_at=datetime.now(timezone.utc),
            )
            session.add(row)

        await session.commit()

    if cross_events:
        log.info("article %d: %d tickers | signal=%s score=%.2f | %d cross-market events",
                 article.id, len(tickers), signal_str, final_score, len(cross_events))
    else:
        log.debug("article %d: %d tickers | signal=%s score=%.2f",
                  article.id, len(tickers), signal_str, final_score)

    return saved


async def run_nlp_pipeline(market: str | None = None, limit: int = 50) -> dict:
    """
    Process unprocessed news articles through the full NLP pipeline.
    Returns summary stats.
    """
    async with AsyncSessionLocal() as session:
        # Get articles that don't yet have signals
        subq = select(Signal.news_id).distinct()
        q = (
            select(NewsArticle)
            .where(NewsArticle.id.not_in(subq))
            .order_by(NewsArticle.published.desc())
            .limit(limit)
        )
        if market:
            q = q.where(NewsArticle.market == market.upper())

        articles = (await session.execute(q)).scalars().all()

    if not articles:
        log.info("[nlp] no new articles to process")
        return {"processed": 0, "signals": 0}

    log.info("[nlp] processing %d articles (market=%s)", len(articles), market or "ALL")

    total_signals = 0
    for article in articles:
        try:
            n = await process_article(article)
            total_signals += n
        except Exception as e:
            log.warning("[nlp] article %d failed: %s", article.id, e)

    log.info("[nlp] done — %d signals generated from %d articles", total_signals, len(articles))
    return {"processed": len(articles), "signals": total_signals}
