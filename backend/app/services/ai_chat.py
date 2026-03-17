"""
AI Chat service — answers ANY investment question with real-time market context.

LLM priority: Groq (llama-3.3-70b-versatile) → OpenAI (gpt-4o-mini) → template fallback.
Context sources: DB signals, Yahoo Finance RSS news, Google News RSS.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

import feedparser  # type: ignore[import-untyped]
import httpx
from sqlalchemy import desc, func, select

from app.core.config import settings
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

    # ── Ticker-specific signal replies ────────────────────────────────────────
    if signals:
        buys = [s for s in signals if s["signal"] == "BUY"]
        sells = [s for s in signals if s["signal"] == "SELL"]
        holds = [s for s in signals if s["signal"] == "HOLD"]
        lines = ["**StockLens AI Signal Summary**\n"]
        for s in signals:
            emoji = "🟢" if s["signal"] == "BUY" else "🔴" if s["signal"] == "SELL" else "🟡"
            lines.append(f"{emoji} **{s['ticker']}** — {s['signal']} (score: {s['score']:.2f})")
            if s.get("reason"):
                lines.append(f"   _{s['reason']}_")
        if buys:
            lines.append(f"\n**Outlook**: {len(buys)} stock(s) showing bullish momentum — positive sentiment and technical strength suggest accumulation may be considered.")
        elif sells:
            lines.append(f"\n**Outlook**: {len(sells)} stock(s) under selling pressure — caution advised, review stop-losses.")
        else:
            lines.append("\n**Outlook**: Mixed/neutral signals — await a clearer catalyst before taking fresh positions.")
        lines.append("\n*Disclaimer: Algorithmic signals only — not financial advice. Always do your own research.*")
        return "\n".join(lines)

    # ── "What to buy today / best stocks" ─────────────────────────────────────
    if any(k in t for k in ["buy today", "buy now", "should i buy", "best stock", "which stock", "top stock",
                              "recommend", "market open", "opens", "good stock", "stock to buy"]):
        return (
            "**What to look for when the market opens:**\n"
            "- **Gap-up stocks** with volume > 2x average — potential momentum plays\n"
            "- **Nifty 50 leaders**: RELIANCE, HDFCBANK, TCS, INFY — large-caps tend to set the tone\n"
            "- **US overnight cues**: Check Dow/S&P futures — they heavily influence Nifty open\n"
            "- **Sector rotation**: If banking is strong, check HDFCBANK, ICICIBANK, SBIN; if IT is green, look at TCS, INFY, WIPRO\n"
            "- **SGX Nifty / Gift Nifty**: Indicates where Nifty 50 will open — positive = bullish bias\n\n"
            "**Stocks historically strong on opens** (India):\n"
            "- High-beta: TATAMOTORS, BAJFINANCE, ADANIENT — big moves both ways\n"
            "- Defensive: HDFCBANK, ITC, NESTLEIND — steady, lower risk\n\n"
            "**For US market open**:\n"
            "- Watch pre-market movers on earnings/news\n"
            "- NVDA, AAPL, MSFT, AMZN — set the NASDAQ tone\n\n"
            "*Disclaimer: Not financial advice. Market conditions change rapidly — always use stop-losses.*"
        )

    # ── Macro / rates ────────────────────────────────────────────────────────
    if any(k in t for k in ["fed", "rbi", "rate", "inflation", "gdp", "recession", "macro", "interest"]):
        return (
            "**Macro Market Context:**\n"
            "- **RBI repo rate**: Currently 6.25% (cut Feb 2025) — positive for banking, real estate, NBFCs\n"
            "- **US Fed**: Holding rates steady in 2025 — watching CPI/PCE data closely\n"
            "- **USD/INR**: ~83-84 range — strong dollar pressures FII outflows from India\n"
            "- **FII flows**: Net buyers/sellers directly move Nifty — track daily on NSE website\n"
            "- **Impact on sectors**:\n"
            "  - Rate cuts → bullish for Banking (HDFCBANK, SBIN), Real Estate (DLF), NBFCs (BAJFINANCE)\n"
            "  - Strong dollar → bullish for IT exporters (TCS, INFY, WIPRO) collecting USD revenue\n"
            "  - High inflation → defensive sectors (FMCG: HUL, ITC) outperform\n"
            "  - Rate hikes → bearish for growth stocks and real estate\n\n"
            "*Monitor RBI MPC meetings (every 6-8 weeks) and US FOMC meetings for policy direction.*"
        )

    # ── Portfolio / diversification ───────────────────────────────────────────
    if any(k in t for k in ["portfolio", "diversif", "allocat", "how to invest", "where to invest", "sip", "lump"]):
        return (
            "**Portfolio Construction Guide:**\n"
            "- **Equity split**: 60-70% India + 30-40% US for balanced growth\n"
            "- **India sector mix**: Banking (20%) + IT (20%) + Consumer (15%) + Healthcare (15%) + Others (30%)\n"
            "- **US holdings**: NVDA, AAPL, MSFT, AMZN, GOOGL as core; add sector ETFs (QQQ, SPY)\n"
            "- **Investment style**: SIP monthly for long-term wealth; lump sum only during 10%+ market dips\n"
            "- **Cash buffer**: Keep 10-15% cash for opportunistic buying during corrections\n"
            "- **Rebalancing**: Review quarterly, rebalance annually\n"
            "- **Risk tiers**:\n"
            "  - Conservative: Large-cap index funds (Nifty 50 ETF + S&P 500 ETF)\n"
            "  - Moderate: Mix of large + mid-caps with some sectoral ETFs\n"
            "  - Aggressive: Mid/small-caps + individual US growth stocks + thematic funds\n\n"
            "*Consult a SEBI-registered advisor for personalized advice.*"
        )

    # ── Technical analysis ────────────────────────────────────────────────────
    if any(k in t for k in ["technical", "chart", "rsi", "macd", "moving average", "support", "resistance",
                              "candlestick", "bollinger", "breakout", "trend"]):
        return (
            "**Technical Analysis Key Indicators:**\n"
            "- **RSI (Relative Strength Index)**: Below 30 = oversold (potential buy), Above 70 = overbought (potential sell)\n"
            "- **MACD**: Bullish when MACD line crosses above signal line; bearish when it crosses below\n"
            "- **Moving Averages**: Price above MA50 & MA200 = uptrend; death cross (MA50 < MA200) = bearish\n"
            "- **Bollinger Bands**: Price touching lower band = oversold; upper band = overbought\n"
            "- **Volume**: Rising price + rising volume = strong trend; rising price + falling volume = weak rally\n"
            "- **Support/Resistance**: Previous highs become resistance; previous lows become support\n"
            "- **Candlestick patterns**: Hammer/Doji at lows = reversal signal; Engulfing candle = strong momentum\n\n"
            "Use the MA20 and MA50 toggles on StockLens charts to visualize moving averages on any stock."
        )

    # ── Fundamental analysis ──────────────────────────────────────────────────
    if any(k in t for k in ["fundamental", "pe ratio", "p/e", "valuation", "earnings", "roe", "revenue",
                              "balance sheet", "debt", "eps", "book value"]):
        return (
            "**Fundamental Analysis Key Metrics:**\n"
            "- **P/E Ratio**: Price ÷ EPS. India IT fair value: 20-30x; Banking: 10-15x; FMCG: 40-60x\n"
            "- **P/B Ratio**: Price ÷ Book Value. Below 1 = potentially undervalued\n"
            "- **ROE**: Return on Equity. Above 15% is healthy; above 20% is excellent\n"
            "- **Debt-to-Equity**: Below 0.5 is safe for most sectors; banks are exceptions\n"
            "- **Revenue growth**: Consistent 15%+ YoY growth signals strong business momentum\n"
            "- **EPS growth**: Earnings Per Share growth is the core driver of stock price appreciation\n"
            "- **Operating Cash Flow**: Positive and growing OCF = healthy business fundamentals\n\n"
            "Check quarterly results (Q1-Q4) on BSE/NSE website or company investor relations pages."
        )

    # ── IPO questions ─────────────────────────────────────────────────────────
    if any(k in t for k in ["ipo", "listing", "grey market", "gmp", "subscribe"]):
        return (
            "**IPO Investment Guide:**\n"
            "- **GMP (Grey Market Premium)**: Positive GMP signals strong market demand pre-listing\n"
            "- **Subscription levels**: 10x+ retail subscription = strong demand; 100x+ = extremely hot IPO\n"
            "- **Apply via**: UPI-based ASBA on your broker app (Zerodha, Groww, Upstox, etc.)\n"
            "- **Allotment**: Check on registrar website (KFintech, Link Intime) post-closure\n"
            "- **Listing strategy**: If listed at 20%+ premium, consider booking profits; if flat, assess fundamentals\n"
            "- **Key things to check**: Company financials (P&L, cash flow), promoter stake post-IPO, use of IPO proceeds, industry tailwinds\n"
            "- **Red flags**: High promoter OFS (they're selling, not raising for growth), negative cash flow, overvalued vs peers\n\n"
            "*Past IPO performance is not a guarantee of future returns.*"
        )

    # ── Sector analysis ───────────────────────────────────────────────────────
    if any(k in t for k in ["sector", "industry", "it sector", "banking", "pharma", "fmcg", "auto", "energy",
                              "metal", "realty", "infrastructure", "defence"]):
        return (
            "**Indian Sector Outlook (2025):**\n"
            "- **IT/Technology** 💻: Cautious — US IT spending slowdown, AI disruption risk. TCS, INFY, WIPRO resilient on large deals\n"
            "- **Banking & Finance** 🏦: Positive — RBI rate cuts, strong credit growth, clean balance sheets. HDFCBANK, ICICIBANK, SBIN\n"
            "- **Defence** 🛡️: Strong tailwinds — govt capex, PLI scheme. HAL, BEL, BHEL\n"
            "- **FMCG** 🛒: Defensive, rural recovery. HUL, ITC, NESTLEIND for stability\n"
            "- **Auto** 🚗: EV transition story. TATAMOTORS (JLR), MARUTI, M&M\n"
            "- **Pharma** 💊: US FDA approvals key catalyst. SUNPHARMA, DRREDDY, CIPLA\n"
            "- **Real Estate** 🏢: Rate cut beneficiary. DLF, GODREJPROP, PRESTIGE\n"
            "- **Renewable Energy** ⚡: Long-term theme. ADANIGREEN, NTPC, TATAPOWER\n\n"
            "*Sector rotation is key — follow FII/DII activity for institutional money flow signals.*"
        )

    # ── Generic investment question (catch-all) ───────────────────────────────
    return (
        "**Investment Quick Guide:**\n"
        "- **For Indian stocks**: Check Nifty 50 / Sensex trend first — broad market direction matters most\n"
        "- **Top large-caps to track**: RELIANCE, HDFCBANK, TCS, INFY, ICICIBANK, BAJFINANCE, TATAMOTORS\n"
        "- **For US stocks**: NVDA, AAPL, MSFT, AMZN, GOOGL are the key market movers\n"
        "- **Risk management**: Never invest more than 5% of portfolio in a single stock\n"
        "- **Entry strategy**: Buy in 2-3 tranches — don't go all-in at once\n"
        "- **Track**: FII flows, global cues (Dow/Nasdaq futures), crude oil price, USD/INR daily\n\n"
        "Ask me about a **specific stock** (e.g. 'Tell me about RELIANCE'), a **sector** (e.g. 'How is banking sector doing?'), "
        "or a **concept** (e.g. 'Explain P/E ratio') for detailed analysis.\n\n"
        "*Not financial advice — always conduct your own research.*"
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
    groq_key = settings.groq_api_key
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
    openai_key = settings.openai_api_key
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
