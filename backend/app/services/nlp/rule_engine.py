"""
Rule engine — domain-specific signal boosters for India and US markets.

Rules fire AFTER base sentiment and adjust the score and impacted tickers.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, timedelta

from app.services.nlp.ticker_mapper import get_sector_tickers

# ── Types ─────────────────────────────────────────────────────────────────────

@dataclass
class RuleMatch:
    rule_id: str
    description: str
    score_delta: float          # added to base sentiment score
    extra_tickers: list[str] = field(default_factory=list)
    volatility_flag: bool = False


# ── India-specific rules ──────────────────────────────────────────────────────

_INDIA_RULES: list[dict] = [
    {
        "id": "sebi_circular",
        "patterns": [r"sebi\s+circular", r"sebi\s+(order|directive|notice|ban|regulation)"],
        "description": "SEBI regulatory action detected — sector flagged",
        "delta": -0.2,
        "sectors": [],          # populated per-match from text
        "volatility": True,
    },
    {
        "id": "rbi_rate_hike",
        "patterns": [r"rbi.{0,30}(hike|raise|increase).{0,20}rate", r"repo rate.{0,30}(hike|rise|up)"],
        "description": "RBI rate hike — negative for banking & real estate",
        "delta": -0.25,
        "sectors": ["Banking", "Real Estate", "Finance"],
        "volatility": False,
    },
    {
        "id": "rbi_rate_cut",
        "patterns": [r"rbi.{0,30}(cut|reduce|lower).{0,20}rate", r"repo rate.{0,30}(cut|fall|down|reduce)"],
        "description": "RBI rate cut — positive for banking & real estate",
        "delta": 0.3,
        "sectors": ["Banking", "Real Estate", "Finance"],
        "volatility": False,
    },
    {
        "id": "union_budget",
        "patterns": [r"union budget", r"budget\s+2[0-9]{3}", r"finance minister.{0,30}budget"],
        "description": "Union Budget announcement — broad market impact",
        "delta": 0.15,
        "sectors": ["Infrastructure", "Auto", "FMCG"],
        "volatility": True,
    },
    {
        "id": "fo_expiry",
        "patterns": [r"f&o expiry", r"futures.{0,20}expir", r"options.{0,20}expir", r"derivative.{0,20}expir"],
        "description": "F&O expiry week — elevated volatility expected",
        "delta": 0.0,
        "sectors": [],
        "volatility": True,
    },
    {
        "id": "gst_change",
        "patterns": [r"gst.{0,30}(rate|hike|cut|change|revision)", r"gst council"],
        "description": "GST rate change — affects FMCG and consumer sectors",
        "delta": -0.1,
        "sectors": ["FMCG", "Consumer"],
        "volatility": False,
    },
    {
        "id": "india_gdp_strong",
        "patterns": [r"gdp.{0,30}(growth|beat|strong|surpass)", r"india gdp.{0,20}(rise|jump|high)"],
        "description": "Strong GDP data — broad market positive",
        "delta": 0.2,
        "sectors": [],
        "volatility": False,
    },
    {
        "id": "rupee_fall",
        "patterns": [r"rupee.{0,20}(fall|slide|weaken|hit.{0,10}low)", r"inr.{0,20}(depreciat|weaken)"],
        "description": "Rupee weakening — positive for IT exporters, negative for importers",
        "delta": 0.1,
        "sectors": ["IT"],   # IT benefits from weak rupee
        "volatility": False,
    },
]

_US_RULES: list[dict] = [
    {
        "id": "fomc_rate_pause",
        "patterns": [r"(fomc|fed).{0,40}(pause|hold|unchanged).{0,20}rate", r"federal reserve.{0,30}pause"],
        "description": "Fed rate pause — positive for growth stocks and Indian IT",
        "delta": 0.25,
        "sectors": ["Technology", "IT"],
        "volatility": False,
        "cross_market_in_sectors": ["IT"],   # cascade to Indian IT
    },
    {
        "id": "fomc_rate_hike",
        "patterns": [r"(fomc|powell|fed).{0,40}(hike|raise|increase).{0,20}rate", r"rate hike"],
        "description": "Fed rate hike — negative for tech, positive for financials",
        "delta": -0.2,
        "sectors": ["Technology", "Communication"],
        "volatility": True,
        "cross_market_in_sectors": ["IT", "Banking"],
    },
    {
        "id": "earnings_beat",
        "patterns": [r"(beat|beats|topped|surpass).{0,30}(earnings|estimate|expectation|consensus)",
                     r"(eps|earnings per share).{0,20}(beat|above|better)"],
        "description": "Earnings beat — strong positive signal",
        "delta": 0.35,
        "sectors": [],
        "volatility": False,
    },
    {
        "id": "earnings_miss",
        "patterns": [r"(miss|missed|below|disappoint).{0,30}(earnings|estimate|expectation)",
                     r"(eps|earnings per share).{0,20}(miss|below|worse)"],
        "description": "Earnings miss — negative signal",
        "delta": -0.35,
        "sectors": [],
        "volatility": True,
    },
    {
        "id": "cpi_high",
        "patterns": [r"cpi.{0,30}(high|rise|above|beat|hot|surge)", r"inflation.{0,20}(rise|higher|above)"],
        "description": "High CPI / inflation — negative for rate-sensitive stocks",
        "delta": -0.2,
        "sectors": ["Technology", "Real Estate"],
        "volatility": True,
    },
    {
        "id": "nfp_strong",
        "patterns": [r"(nfp|non.farm payroll|jobs report).{0,30}(strong|beat|above)", r"unemployment.{0,20}fall"],
        "description": "Strong jobs report — mixed signal, market-positive overall",
        "delta": 0.1,
        "sectors": [],
        "volatility": False,
    },
    {
        "id": "opex",
        "patterns": [r"options.{0,20}expir", r"op.?ex", r"(monthly|quarterly).{0,20}expir"],
        "description": "Options expiry (OpEx) — elevated volatility",
        "delta": 0.0,
        "sectors": [],
        "volatility": True,
    },
    {
        "id": "oil_surge",
        "patterns": [r"oil.{0,30}(surge|spike|jump|soar|rally)", r"crude.{0,20}(up|rise|jump)", r"brent.{0,20}(up|rise)"],
        "description": "Oil price surge — positive for energy, negative for airlines & Indian refiners",
        "delta": 0.3,
        "sectors": ["Energy"],
        "volatility": False,
        "cross_market_in_sectors": ["Energy"],   # flags HPCL/BPCL in India
    },
]


def _match_rules(text: str, rules: list[dict]) -> list[RuleMatch]:
    text_lower = text.lower()
    matches: list[RuleMatch] = []
    for rule in rules:
        for pat in rule["patterns"]:
            if re.search(pat, text_lower):
                extra_tickers: list[str] = []
                for sector in rule.get("sectors", []):
                    extra_tickers.extend(get_sector_tickers(sector))
                matches.append(RuleMatch(
                    rule_id=rule["id"],
                    description=rule["description"],
                    score_delta=rule["delta"],
                    extra_tickers=list(set(extra_tickers)),
                    volatility_flag=rule.get("volatility", False),
                ))
                break  # one match per rule is enough
    return matches


def apply_india_rules(text: str) -> list[RuleMatch]:
    return _match_rules(text, _INDIA_RULES)


def apply_us_rules(text: str) -> list[RuleMatch]:
    return _match_rules(text, _US_RULES)


def get_cross_market_in_sectors(text: str) -> list[str]:
    """Return Indian sectors that US events should cascade into."""
    text_lower = text.lower()
    sectors: list[str] = []
    for rule in _US_RULES:
        for pat in rule["patterns"]:
            if re.search(pat, text_lower) and "cross_market_in_sectors" in rule:
                sectors.extend(rule["cross_market_in_sectors"])
                break
    return list(set(sectors))


def is_fo_expiry_week() -> bool:
    """True if today is within 2 days of the last Thursday of the month (Indian F&O expiry)."""
    today = date.today()
    # Find last Thursday of current month
    last_day = date(today.year, today.month % 12 + 1, 1) - timedelta(days=1) if today.month < 12 \
        else date(today.year + 1, 1, 1) - timedelta(days=1)
    # Walk back to Thursday (weekday 3)
    delta = (last_day.weekday() - 3) % 7
    last_thursday = last_day - timedelta(days=delta)
    return abs((today - last_thursday).days) <= 2


def is_us_opex_week() -> bool:
    """True if today is within 2 days of the third Friday of the month (US OpEx)."""
    today = date.today()
    first = date(today.year, today.month, 1)
    # Third Friday
    days_to_friday = (4 - first.weekday()) % 7
    third_friday = first + timedelta(days=days_to_friday + 14)
    return abs((today - third_friday).days) <= 2
