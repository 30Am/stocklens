from __future__ import annotations

import json
import logging
import re
from html.parser import HTMLParser

import httpx
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import desc, select

from app.core.config import settings
from app.models.db import NewsArticle
from app.schemas.news import NewsOut
from app.utils.database import AsyncSessionLocal

router = APIRouter(prefix="/news", tags=["news"])
log = logging.getLogger(__name__)

_SCRAPE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


# ── HTML → plain text ─────────────────────────────────────────────────────────

class _TextExtractor(HTMLParser):
    SKIP_TAGS = {"script", "style", "nav", "header", "footer", "aside", "noscript", "iframe", "form"}
    BLOCK_TAGS = {"p", "div", "br", "li", "h1", "h2", "h3", "h4", "article", "section"}

    def __init__(self):
        super().__init__()
        self._skip = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP_TAGS:
            self._skip += 1
        if tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self.SKIP_TAGS and self._skip > 0:
            self._skip -= 1
        if tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data):
        if self._skip == 0 and data.strip():
            self.parts.append(data.strip())

    def get_text(self) -> str:
        raw = " ".join(p for p in self.parts if p.strip())
        raw = re.sub(r"[ \t]{2,}", " ", raw)
        raw = re.sub(r"\n{3,}", "\n\n", raw)
        return raw.strip()


async def _scrape_article(url: str) -> str:
    if not url or url == "#":
        return ""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=_SCRAPE_HEADERS, timeout=8, follow_redirects=True)
        if resp.status_code != 200:
            return ""
        extractor = _TextExtractor()
        extractor.feed(resp.text)
        return extractor.get_text()[:5000]
    except Exception as e:
        log.debug("Scrape failed for %s: %s", url, e)
        return ""


# ── Stock impact analysis ─────────────────────────────────────────────────────

def _template_impacts(tickers: list[str], headline: str) -> list[dict]:
    hl = headline.lower()
    if any(w in hl for w in ["surge", "gain", "rise", "beat", "profit", "growth", "up", "record", "positive"]):
        impact, magnitude = "POSITIVE", "MEDIUM"
    elif any(w in hl for w in ["fall", "drop", "loss", "miss", "decline", "down", "cut", "concern", "risk"]):
        impact, magnitude = "NEGATIVE", "MEDIUM"
    else:
        impact, magnitude = "NEUTRAL", "LOW"
    return [
        {
            "ticker": t,
            "company_name": t.replace(".NS", "").replace(".BO", ""),
            "impact": impact,
            "magnitude": magnitude,
            "analysis": (
                f"This news signals {impact.lower()} sentiment for "
                f"{t.replace('.NS','').replace('.BO','')}. "
                "Monitor price action and volume at market open. "
                "Review the full article for specific business impact details."
            ),
        }
        for t in tickers[:6]
    ]


async def _analyze_impacts(headline: str, article_text: str, tickers: list[str]) -> list[dict]:
    groq_key = settings.groq_api_key
    if not groq_key:
        return _template_impacts(tickers, headline)

    ticker_hint = (
        f"Tickers identified: {', '.join(tickers)}" if tickers
        else "Identify ALL companies and stocks mentioned."
    )
    body = (article_text or headline)[:2500]

    prompt = f"""You are a senior equity research analyst. Analyze this news and explain exactly how it affects each company's stock price.

HEADLINE: {headline}

ARTICLE:
{body}

{ticker_hint}

For EVERY company/stock mentioned, provide analysis. Use NSE format for Indian stocks (e.g. RELIANCE.NS, TCS.NS) and standard tickers for US stocks (e.g. AAPL, NVDA).

Return ONLY valid JSON:
{{
  "impacts": [
    {{
      "ticker": "TICKER",
      "company_name": "Full Name",
      "impact": "POSITIVE",
      "magnitude": "HIGH",
      "analysis": "2-3 specific sentences on revenue, margins, competitive, or regulatory impact on this company's share price."
    }}
  ]
}}

impact: POSITIVE | NEGATIVE | NEUTRAL
magnitude: HIGH | MEDIUM | LOW"""

    try:
        from groq import AsyncGroq  # type: ignore[import-untyped]
        client = AsyncGroq(api_key=groq_key)
        resp = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1500,
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        data = json.loads(resp.choices[0].message.content or "{}")
        impacts = data.get("impacts", [])
        if impacts:
            log.info("[news] Groq generated %d stock impacts", len(impacts))
            return impacts
    except Exception as e:
        log.warning("[news] Groq impact analysis failed: %s", e)

    return _template_impacts(tickers, headline)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[NewsOut])
async def list_news(
    market: str | None = Query(None, description="IN or US"),
    limit: int = Query(60, le=100),
):
    async with AsyncSessionLocal() as session:
        q = select(NewsArticle).order_by(desc(NewsArticle.published)).limit(limit)
        if market:
            q = q.where(NewsArticle.market == market.upper())
        rows = (await session.execute(q)).scalars().all()
        return rows


@router.get("/{article_id}/analysis")
async def get_news_analysis(article_id: int):
    """
    Returns full article text (DB raw_text or scraped) + AI per-stock impact analysis.
    """
    async with AsyncSessionLocal() as session:
        article = (await session.execute(
            select(NewsArticle).where(NewsArticle.id == article_id)
        )).scalar_one_or_none()

    if not article:
        raise HTTPException(status_code=404, detail=f"Article {article_id} not found")

    full_text = (article.raw_text or "").strip()
    if not full_text and article.url:
        full_text = await _scrape_article(article.url)

    from app.services.nlp.ticker_mapper import extract_tickers
    tickers = list(extract_tickers(f"{article.headline} {full_text}"))
    stock_impacts = await _analyze_impacts(article.headline, full_text, tickers)

    return {
        "id": article.id,
        "headline": article.headline,
        "source": article.source,
        "url": article.url,
        "market": article.market,
        "published": article.published.isoformat() if article.published else None,
        "full_text": full_text,
        "tickers": tickers,
        "stock_impacts": stock_impacts,
    }
