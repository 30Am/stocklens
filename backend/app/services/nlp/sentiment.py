"""
Sentiment analyser — FinBERT (HuggingFace) with VADER fallback.

FinBERT is lazy-loaded on first use (downloads ~440 MB once to HF cache).
If torch/transformers are not installed, falls back to VADER automatically.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

log = logging.getLogger(__name__)

# ── Data types ────────────────────────────────────────────────────────────────

@dataclass
class SentimentResult:
    label: str      # positive | negative | neutral
    score: float    # normalised to -1.0 (bearish) … +1.0 (bullish)
    source: str     # "finbert" | "vader"


# ── VADER (fallback, always available) ───────────────────────────────────────

_vader = None

def _get_vader():
    global _vader
    if _vader is None:
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
        _vader = SentimentIntensityAnalyzer()
    return _vader


def _vader_sentiment(text: str) -> SentimentResult:
    scores = _get_vader().polarity_scores(text)
    compound = scores["compound"]           # -1.0 to +1.0
    if compound >= 0.05:
        label = "positive"
    elif compound <= -0.05:
        label = "negative"
    else:
        label = "neutral"
    return SentimentResult(label=label, score=compound, source="vader")


# ── FinBERT (preferred, optional) ────────────────────────────────────────────

_finbert = None
_finbert_available: bool | None = None   # None = not yet checked


def _try_load_finbert():
    global _finbert, _finbert_available
    if _finbert_available is False:
        return False
    try:
        from transformers import pipeline as hf_pipeline
        _finbert = hf_pipeline(
            "text-classification",
            model="ProsusAI/finbert",
            truncation=True,
            max_length=512,
        )
        _finbert_available = True
        log.info("FinBERT loaded successfully")
        return True
    except Exception as e:
        log.info("FinBERT not available (%s) — using VADER fallback", type(e).__name__)
        _finbert_available = False
        return False


def _finbert_sentiment(text: str) -> SentimentResult:
    result = _finbert(text[:512])[0]          # [{label, score}]
    raw_label = result["label"].lower()        # positive / negative / neutral
    raw_conf = float(result["score"])

    # Map to -1..+1 scale
    if raw_label == "positive":
        score = raw_conf
    elif raw_label == "negative":
        score = -raw_conf
    else:
        score = 0.0

    return SentimentResult(label=raw_label, score=round(score, 4), source="finbert")


# ── Public API ────────────────────────────────────────────────────────────────

def analyse(text: str) -> SentimentResult:
    """
    Analyse financial sentiment of text.
    Tries FinBERT first; falls back to VADER if unavailable.
    """
    if not text or len(text.strip()) < 5:
        return SentimentResult(label="neutral", score=0.0, source="vader")

    # Lazy load FinBERT once
    if _finbert_available is None:
        _try_load_finbert()

    if _finbert_available and _finbert:
        try:
            return _finbert_sentiment(text)
        except Exception as e:
            log.warning("FinBERT inference failed: %s — falling back to VADER", e)

    return _vader_sentiment(text)


def score_to_signal(score: float, threshold: float = 0.15) -> str:
    """Convert -1..+1 score to BUY / HOLD / SELL."""
    if score >= threshold:
        return "BUY"
    if score <= -threshold:
        return "SELL"
    return "HOLD"
