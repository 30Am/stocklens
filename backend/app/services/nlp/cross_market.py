"""
Cross-market correlation engine — detects when US events cascade to Indian stocks
and vice versa. This is the KEY DIFFERENTIATING FEATURE of the app.

Examples:
  US Fed rate pause  → Positive for TCS, Infosys (IT exporters)
  Oil price surge    → Negative for HPCL, BPCL; Positive for XOM, CVX
  Tata Motors news   → Links Jaguar Land Rover / UK auto sales
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.core.universe import TICKER_MAP
from app.services.nlp.ticker_mapper import get_sector_tickers

# ── Types ─────────────────────────────────────────────────────────────────────

@dataclass
class CrossMarketAlert:
    in_ticker: str | None       # Indian stock ticker (or None if US-only)
    us_ticker: str | None       # US stock ticker (or None if IN-only)
    event: str                  # Human-readable description
    impact: str                 # POSITIVE | NEGATIVE | NEUTRAL
    trigger: str                # What triggered this (rule id)


# ── Linkage rules ──────────────────────────────────────────────────────────────

# Format: {trigger_pattern, us_tickers, in_tickers, impact, event_template}
_CROSS_MARKET_RULES = [
    {
        "id": "fed_pause_it",
        "patterns": [r"(fomc|fed|federal reserve).{0,40}(pause|hold|unchanged)"],
        "us_tickers": [],
        "in_sectors": ["IT"],
        "impact": "POSITIVE",
        "event": "Fed rate pause → positive for Indian IT exporters (revenue in USD, costs in INR)",
    },
    {
        "id": "fed_hike_it",
        "patterns": [r"(fomc|powell|fed).{0,40}(hike|raise|increase).{0,20}rate"],
        "us_tickers": [],
        "in_sectors": ["IT"],
        "impact": "NEGATIVE",
        "event": "Fed rate hike → strengthens USD/INR but hurts Indian IT sentiment",
    },
    {
        "id": "oil_surge_energy",
        "patterns": [r"oil.{0,30}(surge|spike|jump|soar)", r"crude.{0,30}(rally|surge)"],
        "us_tickers": ["XOM", "CVX"],
        "in_tickers": ["HINDPETRO.NS", "BPCL.NS", "ONGC.NS", "RELIANCE.NS"],
        "in_sectors": [],
        "impact": "MIXED",          # positive for producers, negative for refiners
        "event": "Oil price surge links Indian energy stocks (HPCL/BPCL/ONGC) with US energy (XOM/CVX)",
    },
    {
        "id": "tata_motors_jlr",
        "patterns": [r"tata motors", r"jaguar", r"land rover", r"jlr"],
        "us_tickers": [],
        "in_tickers": ["TATAMOTORS.NS"],
        "in_sectors": [],
        "us_tickers_cross": [],
        "impact": "NEUTRAL",
        "event": "Tata Motors linked to Jaguar Land Rover — UK/EU auto sales affect Indian stock",
    },
    {
        "id": "global_it_spending",
        "patterns": [r"(microsoft|google|amazon|meta).{0,40}(cloud|ai|capex|spending).{0,30}(increase|surge|boost)"],
        "us_tickers": ["MSFT", "GOOGL", "AMZN", "META"],
        "in_sectors": ["IT"],
        "impact": "POSITIVE",
        "event": "US tech giants' AI/cloud spending boost boosts Indian IT outsourcing demand",
    },
    {
        "id": "dollar_rupee_it",
        "patterns": [r"(dollar|usd).{0,20}(strengthen|strong|rise)", r"rupee.{0,20}(fall|weaken|depreciat)"],
        "us_tickers": [],
        "in_sectors": ["IT"],
        "impact": "POSITIVE",
        "event": "USD strengthening boosts Indian IT exporters (TCS, Infosys, Wipro) revenues",
    },
    {
        "id": "global_recession_fear",
        "patterns": [r"(recession|slowdown|contraction).{0,30}(fear|risk|concern|looming)"],
        "us_tickers": [],
        "in_sectors": ["IT", "Auto", "Metals"],
        "impact": "NEGATIVE",
        "event": "Global recession fears hit export-dependent Indian sectors (IT, Auto, Metals)",
    },
    {
        "id": "semiconductor_chip",
        "patterns": [r"(chip|semiconductor).{0,30}(shortage|supply chain|disruption)"],
        "us_tickers": ["NVDA", "AMD", "INTC", "QCOM", "AVGO"],
        "in_sectors": ["Auto", "IT"],
        "impact": "NEGATIVE",
        "event": "Chip shortage links US semiconductor stocks with Indian Auto & IT supply chains",
    },
    {
        "id": "pharma_fda",
        "patterns": [r"fda.{0,40}(approve|approval|reject|warning|letter|action)"],
        "us_tickers": ["LLY", "MRK", "ABBV", "AMGN"],
        "in_sectors": ["Pharma"],
        "impact": "NEUTRAL",
        "event": "FDA action creates cross-market signal for Indian pharma exporters (Dr Reddy, Cipla, Sun Pharma)",
    },
]


def detect_cross_market_events(text: str, base_tickers: list[str]) -> list[CrossMarketAlert]:
    """
    Given article text and already-identified tickers, detect cross-market cascades.
    Returns list of CrossMarketAlert events.
    """
    text_lower = text.lower()
    alerts: list[CrossMarketAlert] = []

    for rule in _CROSS_MARKET_RULES:
        matched = any(re.search(pat, text_lower) for pat in rule["patterns"])
        if not matched:
            continue

        # Resolve Indian tickers from sectors
        in_tickers: list[str] = list(rule.get("in_tickers", []))
        for sector in rule.get("in_sectors", []):
            in_tickers.extend(get_sector_tickers(sector))
        in_tickers = list(set(in_tickers))

        us_tickers: list[str] = list(rule.get("us_tickers", []))

        # Generate one alert per (IN, US) pairing
        if in_tickers and us_tickers:
            for in_t in in_tickers[:3]:   # cap to avoid explosion
                for us_t in us_tickers[:3]:
                    alerts.append(CrossMarketAlert(
                        in_ticker=in_t,
                        us_ticker=us_t,
                        event=rule["event"],
                        impact=rule["impact"],
                        trigger=rule["id"],
                    ))
        elif in_tickers:
            for in_t in in_tickers[:5]:
                alerts.append(CrossMarketAlert(
                    in_ticker=in_t,
                    us_ticker=None,
                    event=rule["event"],
                    impact=rule["impact"],
                    trigger=rule["id"],
                ))
        elif us_tickers:
            for us_t in us_tickers[:5]:
                alerts.append(CrossMarketAlert(
                    in_ticker=None,
                    us_ticker=us_t,
                    event=rule["event"],
                    impact=rule["impact"],
                    trigger=rule["id"],
                ))

    return alerts
