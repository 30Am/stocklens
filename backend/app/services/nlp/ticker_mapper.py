"""
Ticker mapper — extracts company mentions from article text and maps to tickers.

Uses a two-pass approach:
  1. Direct ticker symbol match (RELIANCE, TCS, AAPL, etc.)
  2. Company name keyword match
"""
from __future__ import annotations

import re
from app.core.universe import ALL_STOCKS

# ── Build lookup tables ───────────────────────────────────────────────────────

# keyword → ticker (longest match wins)
_KEYWORD_MAP: dict[str, str] = {}

# Extra aliases not captured by the name field
_ALIASES: dict[str, str] = {
    # Indian aliases
    "reliance": "RELIANCE.NS",
    "ril": "RELIANCE.NS",
    "tcs": "TCS.NS",
    "tata consultancy": "TCS.NS",
    "infosys": "INFY.NS",
    "infy": "INFY.NS",
    "wipro": "WIPRO.NS",
    "hdfc bank": "HDFCBANK.NS",
    "hdfcbank": "HDFCBANK.NS",
    "icici bank": "ICICIBANK.NS",
    "sbi": "SBIN.NS",
    "state bank": "SBIN.NS",
    "airtel": "BHARTIARTL.NS",
    "bharti airtel": "BHARTIARTL.NS",
    "itc": "ITC.NS",
    "kotak": "KOTAKBANK.NS",
    "l&t": "LT.NS",
    "larsen": "LT.NS",
    "hcl": "HCLTECH.NS",
    "axis bank": "AXISBANK.NS",
    "asian paints": "ASIANPAINT.NS",
    "bajaj finance": "BAJFINANCE.NS",
    "maruti": "MARUTI.NS",
    "sun pharma": "SUNPHARMA.NS",
    "titan": "TITAN.NS",
    "tata motors": "TATAMOTORS.NS",
    "adani": "ADANIENT.NS",
    "jsw steel": "JSWSTEEL.NS",
    "tata steel": "TATASTEEL.NS",
    "coal india": "COALINDIA.NS",
    "ongc": "ONGC.NS",
    "dr reddy": "DRREDDY.NS",
    "drreddys": "DRREDDY.NS",
    "cipla": "CIPLA.NS",
    "hero": "HEROMOTOCO.NS",
    "apollo hospitals": "APOLLOHOSP.NS",
    "divi": "DIVISLAB.NS",
    "bpcl": "BPCL.NS",
    "bharat petroleum": "BPCL.NS",
    "hpcl": "HINDPETRO.NS",
    "hindustan petroleum": "HINDPETRO.NS",
    "mahindra": "M&M.NS",
    "m&m": "M&M.NS",
    "britannia": "BRITANNIA.NS",
    "bajaj auto": "BAJAJ-AUTO.NS",
    "hindalco": "HINDALCO.NS",
    "vedanta": "VEDL.NS",
    "tata power": "TATAPOWER.NS",
    "tata consumer": "TATACONSUM.NS",
    "ntpc": "NTPC.NS",
    "power grid": "POWERGRID.NS",
    "tech mahindra": "TECHM.NS",
    "naukri": "NAUKRI.NS",
    "info edge": "NAUKRI.NS",
    "dlf": "DLF.NS",
    "ultracemco": "ULTRACEMCO.NS",
    "ultratech cement": "ULTRACEMCO.NS",
    "grasim": "GRASIM.NS",
    "indusind": "INDUSINDBK.NS",
    "nestl": "NESTLEIND.NS",
    "nestle india": "NESTLEIND.NS",
    # US aliases
    "apple": "AAPL",
    "microsoft": "MSFT",
    "nvidia": "NVDA",
    "google": "GOOGL",
    "alphabet": "GOOGL",
    "amazon": "AMZN",
    "meta": "META",
    "facebook": "META",
    "tesla": "TSLA",
    "berkshire": "BRK-B",
    "jpmorgan": "JPM",
    "jp morgan": "JPM",
    "eli lilly": "LLY",
    "lilly": "LLY",
    "visa": "V",
    "unitedhealth": "UNH",
    "exxon": "XOM",
    "exxonmobil": "XOM",
    "mastercard": "MA",
    "broadcom": "AVGO",
    "procter": "PG",
    "p&g": "PG",
    "johnson": "JNJ",
    "j&j": "JNJ",
    "costco": "COST",
    "home depot": "HD",
    "merck": "MRK",
    "abbvie": "ABBV",
    "bank of america": "BAC",
    "bofa": "BAC",
    "salesforce": "CRM",
    "amd": "AMD",
    "advanced micro": "AMD",
    "oracle": "ORCL",
    "chevron": "CVX",
    "pepsi": "PEP",
    "coca cola": "KO",
    "coke": "KO",
    "adobe": "ADBE",
    "thermo fisher": "TMO",
    "walmart": "WMT",
    "mcdonald": "MCD",
    "accenture": "ACN",
    "netflix": "NFLX",
    "qualcomm": "QCOM",
    "texas instruments": "TXN",
    "intel": "INTC",
    "goldman": "GS",
    "goldman sachs": "GS",
    "nextera": "NEE",
    "ibm": "IBM",
    "servicenow": "NOW",
    "uber": "UBER",
    "amgen": "AMGN",
    "caterpillar": "CAT",
    "ge aerospace": "GE",
    "raytheon": "RTX",
    "rtx": "RTX",
    "morgan stanley": "MS",
    "intuitive surgical": "ISRG",
}

# Build from universe names too
for stock in ALL_STOCKS:
    name_lower = stock["name"].lower()
    _KEYWORD_MAP[name_lower] = stock["ticker"]
    # Also add first word if it's distinctive (>4 chars)
    first_word = name_lower.split()[0]
    if len(first_word) > 4 and first_word not in {"state", "bank", "first", "india", "united", "global"}:
        _KEYWORD_MAP.setdefault(first_word, stock["ticker"])

_KEYWORD_MAP.update(_ALIASES)

# Sorted by length descending so longer matches win
_SORTED_KEYWORDS = sorted(_KEYWORD_MAP.keys(), key=len, reverse=True)

# Plain ticker symbols to match (e.g. "AAPL", "TCS" in text)
_TICKER_SYMBOLS: set[str] = {
    s["ticker"].replace(".NS", "").replace(".BO", "")
    for s in ALL_STOCKS
}
_SYMBOL_TO_TICKER: dict[str, str] = {
    s["ticker"].replace(".NS", "").replace(".BO", ""): s["ticker"]
    for s in ALL_STOCKS
}


def extract_tickers(text: str) -> list[str]:
    """
    Given article text, return list of matched tickers.
    E.g. "Infosys beats Q3 earnings, TCS flat" → ["INFY.NS", "TCS.NS"]
    """
    if not text:
        return []

    text_lower = text.lower()
    found: set[str] = set()

    # Pass 1: keyword match (longer keywords first)
    for kw in _SORTED_KEYWORDS:
        if kw in text_lower:
            found.add(_KEYWORD_MAP[kw])

    # Pass 2: ticker symbol match in UPPERCASE words
    words = re.findall(r"\b[A-Z]{2,6}\b", text)
    for w in words:
        if w in _TICKER_SYMBOLS:
            found.add(_SYMBOL_TO_TICKER[w])

    return list(found)


def get_sector_tickers(sector_keyword: str) -> list[str]:
    """Return all tickers in a sector matching the keyword."""
    kw = sector_keyword.lower()
    return [s["ticker"] for s in ALL_STOCKS if kw in (s.get("sector") or "").lower()]
