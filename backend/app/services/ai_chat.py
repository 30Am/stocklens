"""
AI Chat service — answers ANY investment question with real-time market context.

LLM priority: Groq (llama-3.3-70b-versatile) → OpenAI (gpt-4o-mini) → template fallback.
Context sources: DB signals, Yahoo Finance RSS news, Google News RSS.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone

import feedparser  # type: ignore[import-untyped]
import httpx
from sqlalchemy import desc, func, select

from app.models.db import NewsArticle, Signal, Stock
from app.utils.database import AsyncSessionLocal

log = logging.getLogger(__name__)

_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; StockLens/4.0)"}
_YF_NEWS_RSS = "https://finance.yahoo.com/rss/headline?s={ticker}"
_GOOGLE_NEWS_RSS = "https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"


# ── Real-time news fetchers ──────────────────────────────────────────────────

async def _fetch_google_news(query: str, limit: int = 6) -> list[dict]:
    """Fetch real-time headlines from Google News RSS."""
    url = _GOOGLE_NEWS_RSS.format(query=query.replace(" ", "+"))
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=_HEADERS, timeout=6)
        feed = feedparser.parse(resp.text)
        articles = []
        for entry in feed.entries[:limit]:
            source = "Google News"
            if hasattr(entry.get("source", None), "get"):
                source = entry["source"].get("title", "Google News")
            articles.append({
                "headline": entry.get("title", "").strip(),
                "source": source,
                "url": entry.get("link", ""),
            })
        return articles
    except Exception as e:
        log.debug("[chat] Google News fetch failed: %s", e)
        return []


async def _fetch_yf_ticker_news(ticker: str, limit: int = 3) -> list[dict]:
    """Fetch Yahoo Finance RSS news for a specific ticker."""
    url = _YF_NEWS_RSS.format(ticker=ticker)
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=_HEADERS, timeout=5)
        feed = feedparser.parse(resp.text)
        articles = []
        for entry in feed.entries[:limit]:
            articles.append({
                "headline": entry.get("title", "").strip(),
                "source": "Yahoo Finance",
                "url": entry.get("link", ""),
            })
        return articles
    except Exception as e:
        log.debug("[chat] YF news fetch failed for %s: %s", ticker, e)
        return []


# ── DB context ───────────────────────────────────────────────────────────────

async def _fetch_db_context(tickers: list[str]) -> dict:
    """Pull latest signals + recent news from the local DB."""
    async with AsyncSessionLocal() as session:
        signals: list[dict] = []
        db_news: list[dict] = []

        if tickers:
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
                    "reason": sig.reason or "",
                })

        # Recent DB headlines (fallback when live news unavailable)
        news_rows = (
            await session.execute(
                select(NewsArticle)
                .order_by(desc(NewsArticle.fetched_at))
                .limit(5)
            )
        ).scalars().all()
        for a in news_rows:
            db_news.append({"headline": a.headline, "source": a.source or ""})

    return {"signals": signals, "db_news": db_news}


# ── Aggregate context ────────────────────────────────────────────────────────

async def _fetch_context(message: str, tickers: list[str]) -> dict:
    """Concurrently fetch DB signals, ticker-specific news, and Google News."""
    # Build a relevant query for Google News
    if tickers:
        google_query = " ".join(t.replace(".NS", "").replace(".BO", "") for t in tickers[:2]) + " stock investing"
    else:
        # Use keywords from the message (first 60 chars, cleaned)
        google_query = " ".join(message.split()[:8]) + " stock market"

    # Gather all async tasks concurrently
    coros: list = [_fetch_db_context(tickers)]
    for ticker in tickers[:3]:
        coros.append(_fetch_yf_ticker_news(ticker))
    coros.append(_fetch_google_news(google_query))

    results = await asyncio.gather(*coros, return_exceptions=True)

    db_ctx = results[0] if not isinstance(results[0], Exception) else {"signals": [], "db_news": []}

    # Collect live news from ticker RSS + Google News
    live_news: list[dict] = []
    for i in range(1, len(results)):
        r = results[i]
        if not isinstance(r, Exception):
            live_news.extend(r)  # type: ignore[arg-type]

    # Deduplicate by first 50 chars of headline
    seen: set[str] = set()
    unique_news: list[dict] = []
    for n in live_news:
        key = n["headline"][:50].lower()
        if key and key not in seen:
            seen.add(key)
            unique_news.append(n)

    return {
        "signals": db_ctx["signals"],
        "db_news": db_ctx["db_news"],
        "live_news": unique_news[:8],
    }


# ── Prompt builder ───────────────────────────────────────────────────────────

def _build_system_prompt(context: dict) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "You are StockLens AI, an expert financial analyst with comprehensive knowledge of:",
        "- **Indian equity markets**: NSE/BSE, Nifty 50/Next 50, Sensex, mid-caps, small-caps, sectoral indices",
        "- **US equity markets**: NYSE, NASDAQ, S&P 500, sector ETFs, Dow Jones",
        "- **Global macroeconomics**: Fed policy, RBI policy, inflation, interest rates, currency (USD/INR), FII/DII flows",
        "- **Technical analysis**: moving averages (MA20/50/200), RSI, MACD, Bollinger Bands, support/resistance, candlestick patterns",
        "- **Fundamental analysis**: P/E, P/B, EV/EBITDA, ROE, ROCE, debt ratios, earnings growth, DCF valuation",
        "- **Investment strategies**: value investing, growth investing, momentum trading, sector rotation, SIP/lump sum",
        "- **Portfolio management**: asset allocation, rebalancing, diversification, risk management, position sizing",
        "- **Special topics**: IPOs, QIPs, buybacks, dividends, F&O strategies, REIT, InvIT, mutual funds, ETFs",
        f"Current time: {now}",
        "",
        "**Response guidelines**:",
        "- Answer ANY investment or finance question thoroughly and directly",
        "- Use the real-time context below when available; supplement with your broad knowledge",
        "- For specific stock signals, reference the StockLens AI scores provided",
        "- Use **bold** for key terms, bullet points for lists, and clear structure",
        "- Be concise but complete — aim for 3-6 sentences or a well-structured list",
        "- Always add a brief risk disclaimer for specific trading advice",
        "- If asked about a stock not in context, use your knowledge of that company",
        "",
    ]

    if context["signals"]:
        lines.append("## StockLens AI Signals (live from DB):")
        for s in context["signals"]:
            lines.append(f"- **{s['ticker']}** ({s.get('name', '')}): **{s['signal']}** | score={s['score']} | {s['reason']}")
        lines.append("")

    news_to_show = context["live_news"] if context["live_news"] else context["db_news"]
    if news_to_show:
        label = "## Real-time Market News:" if context["live_news"] else "## Recent Headlines (DB):"
        lines.append(label)
        for n in news_to_show[:7]:
            src = f" [{n['source']}]" if n.get("source") else ""
            lines.append(f"- {n['headline']}{src}")
        lines.append("")

    return "\n".join(lines)


# ── Template fallback ────────────────────────────────────────────────────────

def _template_reply(signals: list[dict], tickers: list[str], message: str) -> str:
    """Rich fallback when all LLMs are unavailable."""
    t = message.lower()
    ticker_str = ", ".join(tickers) if tickers else "the market"

    if signals:
        buys = [s for s in signals if s["signal"] == "BUY"]
        sells = [s for s in signals if s["signal"] == "SELL"]
        if buys and not sells:
            stocks = ", ".join(f"**{s['ticker']}** (score: {s['score']:.2f})" for s in buys)
            return (
                f"**Bullish signals detected** for {stocks}.\n\n"
                "Positive sentiment and momentum indicators suggest potential accumulation opportunity. "
                "Validate with your own research and risk tolerance.\n\n"
                "*Disclaimer: Algorithmic signals only — not financial advice.*"
            )
        if sells and not buys:
            stocks = ", ".join(f"**{s['ticker']}** (score: {s['score']:.2f})" for s in sells)
            return (
                f"**Bearish signals detected** for {stocks}.\n\n"
                "Negative sentiment and momentum suggest caution. Review position sizing and stop-losses.\n\n"
                "*Disclaimer: Algorithmic signals only — not financial advice.*"
            )
        return (
            f"**Mixed signals** for {ticker_str}. The market is awaiting clearer catalysts. "
            "A **HOLD** stance is suggested — monitor for decisive breakout or breakdown.\n\n"
            "*Disclaimer: Algorithmic signals only — not financial advice.*"
        )

    if any(k in t for k in ["macro", "fed", "rbi", "rate", "inflation", "gdp", "recession"]):
        return (
            "**Macro context**: Global markets face central bank policy divergence. "
            "RBI's rate stance directly impacts Indian banking and NBFC stocks. "
            "Fed rate decisions drive USD/INR movement and FII flows into Indian equities — "
            "rising US rates typically trigger FII selling in Indian markets, while a dovish Fed supports rally. "
            "Monitor inflation data for policy signals."
        )

    if any(k in t for k in ["portfolio", "diversif", "allocat", "invest how"]):
        return (
            "**Portfolio construction framework**:\n"
            "- **Equity allocation**: 60-70% (split India/US based on risk appetite)\n"
            "- **Sector diversification**: IT + Banking + Consumer + Healthcare core\n"
            "- **Geographic split**: 60% India (growth), 40% US (stability + tech)\n"
            "- **Cash buffer**: Keep 10-15% for opportunities during corrections\n"
            "- **Rebalancing**: Quarterly review, annual rebalancing\n"
            "- Use SIP for equity; lump sum during market dips > 10%\n\n"
            "*Not financial advice — consult a SEBI-registered advisor.*"
        )

    if any(k in t for k in ["technical", "chart", "support", "resistance", "rsi", "macd", "moving average"]):
        return (
            "**Technical analysis basics**:\n"
            "- **MA crossover**: 20-day crossing above 50-day = bullish signal\n"
            "- **RSI**: Below 30 = oversold (buy signal), above 70 = overbought (sell signal)\n"
            "- **MACD**: Positive crossover signals momentum shift upward\n"
            "- **Support/Resistance**: Previous highs become resistance; lows become support\n"
            "- StockLens charts support MA20 and MA50 overlays — toggle via the chart controls."
        )

    return (
        f"StockLens AI is monitoring **{ticker_str}**. "
        "Check the dashboard for real-time signals and stock detail pages for AI explanations. "
        "You can ask me about specific stocks, sectors, macroeconomics, technical/fundamental analysis, "
        "portfolio strategies, or any other investment topic."
    )


# ── Main entry point ─────────────────────────────────────────────────────────

async def answer(message: str, extra_tickers: list[str] | None = None) -> dict:
    """
    Main entry point. Returns { reply, tickers_mentioned, signals }.
    LLM priority: Groq → OpenAI → template fallback.
    """
    from app.services.nlp.ticker_mapper import extract_tickers

    mentioned = list(extract_tickers(message))
    if extra_tickers:
        mentioned = list(set(mentioned) | set(t.upper() for t in extra_tickers))

    context = await _fetch_context(message, mentioned)
    system_prompt = _build_system_prompt(context)

    reply: str | None = None

    # 1. Try Groq (fast + free tier)
    groq_key = os.getenv("GROQ_API_KEY", "")
    if groq_key and not reply:
        try:
            from groq import AsyncGroq  # type: ignore[import-untyped]
            client = AsyncGroq(api_key=groq_key)
            resp = await client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message},
                ],
                max_tokens=700,
                temperature=0.5,
            )
            reply = (resp.choices[0].message.content or "").strip()
            log.info("[chat] Groq replied (%d chars)", len(reply))
        except Exception as e:
            log.warning("[chat] Groq unavailable: %s", e)

    # 2. Fallback to OpenAI
    openai_key = os.getenv("OPENAI_API_KEY", "")
    if openai_key and not reply:
        try:
            from openai import AsyncOpenAI  # type: ignore[import-untyped]
            client = AsyncOpenAI(api_key=openai_key)
            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message},
                ],
                max_tokens=700,
                temperature=0.5,
            )
            reply = (resp.choices[0].message.content or "").strip()
            log.info("[chat] OpenAI replied (%d chars)", len(reply))
        except Exception as e:
            log.warning("[chat] OpenAI unavailable: %s", e)

    # 3. Template fallback
    if not reply:
        log.warning("[chat] All LLMs unavailable, using template reply")
        reply = _template_reply(context["signals"], mentioned, message)

    return {
        "reply": reply,
        "tickers_mentioned": mentioned,
        "signals": context["signals"],
    }
