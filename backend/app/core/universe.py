"""
Stock universe definition.
India: NIFTY 50 + NIFTY Next 50 (100 stocks)
USA:  Top 50 S&P 500 / NASDAQ 100 stocks
Total: ~150 stocks
"""

# ── NIFTY 50 ─────────────────────────────────────────────────────────────────
NIFTY_50: list[dict] = [
    {"ticker": "RELIANCE.NS",  "name": "Reliance Industries",        "sector": "Energy",        "index": "NIFTY50"},
    {"ticker": "TCS.NS",       "name": "Tata Consultancy Services",  "sector": "IT",            "index": "NIFTY50"},
    {"ticker": "HDFCBANK.NS",  "name": "HDFC Bank",                  "sector": "Banking",       "index": "NIFTY50"},
    {"ticker": "INFY.NS",      "name": "Infosys",                    "sector": "IT",            "index": "NIFTY50"},
    {"ticker": "ICICIBANK.NS", "name": "ICICI Bank",                 "sector": "Banking",       "index": "NIFTY50"},
    {"ticker": "HINDUNILVR.NS","name": "Hindustan Unilever",         "sector": "FMCG",          "index": "NIFTY50"},
    {"ticker": "SBIN.NS",      "name": "State Bank of India",        "sector": "Banking",       "index": "NIFTY50"},
    {"ticker": "BHARTIARTL.NS","name": "Bharti Airtel",              "sector": "Telecom",       "index": "NIFTY50"},
    {"ticker": "ITC.NS",       "name": "ITC Limited",                "sector": "FMCG",          "index": "NIFTY50"},
    {"ticker": "KOTAKBANK.NS", "name": "Kotak Mahindra Bank",        "sector": "Banking",       "index": "NIFTY50"},
    {"ticker": "LT.NS",        "name": "Larsen & Toubro",            "sector": "Infrastructure","index": "NIFTY50"},
    {"ticker": "HCLTECH.NS",   "name": "HCL Technologies",           "sector": "IT",            "index": "NIFTY50"},
    {"ticker": "AXISBANK.NS",  "name": "Axis Bank",                  "sector": "Banking",       "index": "NIFTY50"},
    {"ticker": "ASIANPAINT.NS","name": "Asian Paints",               "sector": "Materials",     "index": "NIFTY50"},
    {"ticker": "BAJFINANCE.NS","name": "Bajaj Finance",              "sector": "Finance",       "index": "NIFTY50"},
    {"ticker": "MARUTI.NS",    "name": "Maruti Suzuki",              "sector": "Auto",          "index": "NIFTY50"},
    {"ticker": "SUNPHARMA.NS", "name": "Sun Pharmaceutical",         "sector": "Pharma",        "index": "NIFTY50"},
    {"ticker": "TITAN.NS",     "name": "Titan Company",              "sector": "Consumer",      "index": "NIFTY50"},
    {"ticker": "WIPRO.NS",     "name": "Wipro",                      "sector": "IT",            "index": "NIFTY50"},
    {"ticker": "ULTRACEMCO.NS","name": "UltraTech Cement",           "sector": "Materials",     "index": "NIFTY50"},
    {"ticker": "NESTLEIND.NS", "name": "Nestle India",               "sector": "FMCG",          "index": "NIFTY50"},
    {"ticker": "POWERGRID.NS", "name": "Power Grid Corporation",     "sector": "Utilities",     "index": "NIFTY50"},
    {"ticker": "NTPC.NS",      "name": "NTPC Limited",               "sector": "Utilities",     "index": "NIFTY50"},
    {"ticker": "TECHM.NS",     "name": "Tech Mahindra",              "sector": "IT",            "index": "NIFTY50"},
    {"ticker": "ONGC.NS",      "name": "ONGC",                       "sector": "Energy",        "index": "NIFTY50"},
    {"ticker": "TATAMOTORS.NS","name": "Tata Motors",                "sector": "Auto",          "index": "NIFTY50"},
    {"ticker": "ADANIENT.NS",  "name": "Adani Enterprises",          "sector": "Conglomerate",  "index": "NIFTY50"},
    {"ticker": "JSWSTEEL.NS",  "name": "JSW Steel",                  "sector": "Metals",        "index": "NIFTY50"},
    {"ticker": "TATASTEEL.NS", "name": "Tata Steel",                 "sector": "Metals",        "index": "NIFTY50"},
    {"ticker": "COALINDIA.NS", "name": "Coal India",                 "sector": "Energy",        "index": "NIFTY50"},
    {"ticker": "BAJAJFINSV.NS","name": "Bajaj Finserv",              "sector": "Finance",       "index": "NIFTY50"},
    {"ticker": "HDFCLIFE.NS",  "name": "HDFC Life Insurance",        "sector": "Insurance",     "index": "NIFTY50"},
    {"ticker": "SBILIFE.NS",   "name": "SBI Life Insurance",         "sector": "Insurance",     "index": "NIFTY50"},
    {"ticker": "INDUSINDBK.NS","name": "IndusInd Bank",              "sector": "Banking",       "index": "NIFTY50"},
    {"ticker": "GRASIM.NS",    "name": "Grasim Industries",          "sector": "Materials",     "index": "NIFTY50"},
    {"ticker": "DRREDDY.NS",   "name": "Dr. Reddy's Laboratories",   "sector": "Pharma",        "index": "NIFTY50"},
    {"ticker": "CIPLA.NS",     "name": "Cipla",                      "sector": "Pharma",        "index": "NIFTY50"},
    {"ticker": "EICHERMOT.NS", "name": "Eicher Motors",              "sector": "Auto",          "index": "NIFTY50"},
    {"ticker": "HEROMOTOCO.NS","name": "Hero MotoCorp",              "sector": "Auto",          "index": "NIFTY50"},
    {"ticker": "APOLLOHOSP.NS","name": "Apollo Hospitals",           "sector": "Healthcare",    "index": "NIFTY50"},
    {"ticker": "TATACONSUM.NS","name": "Tata Consumer Products",     "sector": "FMCG",          "index": "NIFTY50"},
    {"ticker": "DIVISLAB.NS",  "name": "Divi's Laboratories",        "sector": "Pharma",        "index": "NIFTY50"},
    {"ticker": "BPCL.NS",      "name": "Bharat Petroleum",          "sector": "Energy",        "index": "NIFTY50"},
    {"ticker": "SHREECEM.NS",  "name": "Shree Cement",               "sector": "Materials",     "index": "NIFTY50"},
    {"ticker": "ADANIPORTS.NS","name": "Adani Ports",                "sector": "Infrastructure","index": "NIFTY50"},
    {"ticker": "M&M.NS",       "name": "Mahindra & Mahindra",        "sector": "Auto",          "index": "NIFTY50"},
    {"ticker": "BRITANNIA.NS", "name": "Britannia Industries",       "sector": "FMCG",          "index": "NIFTY50"},
    {"ticker": "BAJAJ-AUTO.NS","name": "Bajaj Auto",                 "sector": "Auto",          "index": "NIFTY50"},
    {"ticker": "UPL.NS",       "name": "UPL Limited",                "sector": "Chemicals",     "index": "NIFTY50"},
    {"ticker": "HINDALCO.NS",  "name": "Hindalco Industries",        "sector": "Metals",        "index": "NIFTY50"},
]

# ── NIFTY Next 50 ─────────────────────────────────────────────────────────────
NIFTY_NEXT_50: list[dict] = [
    {"ticker": "ABB.NS",        "name": "ABB India",                 "sector": "Industrials",   "index": "NIFTY_NEXT50"},
    {"ticker": "ADANIGREEN.NS", "name": "Adani Green Energy",        "sector": "Utilities",     "index": "NIFTY_NEXT50"},
    {"ticker": "ADANITRANS.NS", "name": "Adani Transmission",        "sector": "Utilities",     "index": "NIFTY_NEXT50"},
    {"ticker": "AMBUJACEM.NS",  "name": "Ambuja Cements",            "sector": "Materials",     "index": "NIFTY_NEXT50"},
    {"ticker": "AUROPHARMA.NS", "name": "Aurobindo Pharma",          "sector": "Pharma",        "index": "NIFTY_NEXT50"},
    {"ticker": "BANDHANBNK.NS", "name": "Bandhan Bank",              "sector": "Banking",       "index": "NIFTY_NEXT50"},
    {"ticker": "BANKBARODA.NS", "name": "Bank of Baroda",            "sector": "Banking",       "index": "NIFTY_NEXT50"},
    {"ticker": "BERGEPAINT.NS", "name": "Berger Paints",             "sector": "Materials",     "index": "NIFTY_NEXT50"},
    {"ticker": "BOSCHLTD.NS",   "name": "Bosch",                     "sector": "Auto",          "index": "NIFTY_NEXT50"},
    {"ticker": "CHOLAFIN.NS",   "name": "Cholamandalam Finance",     "sector": "Finance",       "index": "NIFTY_NEXT50"},
    {"ticker": "COLPAL.NS",     "name": "Colgate-Palmolive India",   "sector": "FMCG",          "index": "NIFTY_NEXT50"},
    {"ticker": "CUMMINSIND.NS", "name": "Cummins India",             "sector": "Industrials",   "index": "NIFTY_NEXT50"},
    {"ticker": "DABUR.NS",      "name": "Dabur India",               "sector": "FMCG",          "index": "NIFTY_NEXT50"},
    {"ticker": "DLF.NS",        "name": "DLF Limited",               "sector": "Real Estate",   "index": "NIFTY_NEXT50"},
    {"ticker": "FEDERALBNK.NS", "name": "Federal Bank",              "sector": "Banking",       "index": "NIFTY_NEXT50"},
    {"ticker": "GODREJCP.NS",   "name": "Godrej Consumer Products",  "sector": "FMCG",          "index": "NIFTY_NEXT50"},
    {"ticker": "HAVELLS.NS",    "name": "Havells India",             "sector": "Consumer",      "index": "NIFTY_NEXT50"},
    {"ticker": "HDFCAMC.NS",    "name": "HDFC AMC",                  "sector": "Finance",       "index": "NIFTY_NEXT50"},
    {"ticker": "HINDPETRO.NS",  "name": "Hindustan Petroleum (HPCL)","sector": "Energy",        "index": "NIFTY_NEXT50"},
    {"ticker": "ICICIGI.NS",    "name": "ICICI Lombard",             "sector": "Insurance",     "index": "NIFTY_NEXT50"},
    {"ticker": "ICICIPRULI.NS", "name": "ICICI Prudential Life",     "sector": "Insurance",     "index": "NIFTY_NEXT50"},
    {"ticker": "IDFCFIRSTB.NS", "name": "IDFC First Bank",           "sector": "Banking",       "index": "NIFTY_NEXT50"},
    {"ticker": "IGL.NS",        "name": "Indraprastha Gas",          "sector": "Utilities",     "index": "NIFTY_NEXT50"},
    {"ticker": "INDUSTOWER.NS", "name": "Indus Towers",              "sector": "Telecom",       "index": "NIFTY_NEXT50"},
    {"ticker": "LTIM.NS",       "name": "LTIMindtree",               "sector": "IT",            "index": "NIFTY_NEXT50"},
    {"ticker": "LTTS.NS",       "name": "L&T Technology Services",   "sector": "IT",            "index": "NIFTY_NEXT50"},
    {"ticker": "LUPIN.NS",      "name": "Lupin",                     "sector": "Pharma",        "index": "NIFTY_NEXT50"},
    {"ticker": "MARICO.NS",     "name": "Marico",                    "sector": "FMCG",          "index": "NIFTY_NEXT50"},
    {"ticker": "MCDOWELL-N.NS", "name": "United Spirits",            "sector": "Consumer",      "index": "NIFTY_NEXT50"},
    {"ticker": "MPHASIS.NS",    "name": "Mphasis",                   "sector": "IT",            "index": "NIFTY_NEXT50"},
    {"ticker": "MUTHOOTFIN.NS", "name": "Muthoot Finance",           "sector": "Finance",       "index": "NIFTY_NEXT50"},
    {"ticker": "NAUKRI.NS",     "name": "Info Edge (Naukri)",        "sector": "IT",            "index": "NIFTY_NEXT50"},
    {"ticker": "OBEROIRLTY.NS", "name": "Oberoi Realty",             "sector": "Real Estate",   "index": "NIFTY_NEXT50"},
    {"ticker": "OFSS.NS",       "name": "Oracle Financial Services", "sector": "IT",            "index": "NIFTY_NEXT50"},
    {"ticker": "PAGEIND.NS",    "name": "Page Industries",           "sector": "Consumer",      "index": "NIFTY_NEXT50"},
    {"ticker": "PERSISTENT.NS", "name": "Persistent Systems",        "sector": "IT",            "index": "NIFTY_NEXT50"},
    {"ticker": "PETRONET.NS",   "name": "Petronet LNG",              "sector": "Energy",        "index": "NIFTY_NEXT50"},
    {"ticker": "PIDILITIND.NS", "name": "Pidilite Industries",       "sector": "Chemicals",     "index": "NIFTY_NEXT50"},
    {"ticker": "PIIND.NS",      "name": "PI Industries",             "sector": "Chemicals",     "index": "NIFTY_NEXT50"},
    {"ticker": "PNBHOUSING.NS", "name": "PNB Housing Finance",       "sector": "Finance",       "index": "NIFTY_NEXT50"},
    {"ticker": "RECLTD.NS",     "name": "REC Limited",               "sector": "Finance",       "index": "NIFTY_NEXT50"},
    {"ticker": "SIEMENS.NS",    "name": "Siemens India",             "sector": "Industrials",   "index": "NIFTY_NEXT50"},
    {"ticker": "SRF.NS",        "name": "SRF Limited",               "sector": "Chemicals",     "index": "NIFTY_NEXT50"},
    {"ticker": "TATAPOWER.NS",  "name": "Tata Power",                "sector": "Utilities",     "index": "NIFTY_NEXT50"},
    {"ticker": "TORNTPHARM.NS", "name": "Torrent Pharmaceuticals",   "sector": "Pharma",        "index": "NIFTY_NEXT50"},
    {"ticker": "TRENT.NS",      "name": "Trent (Westside)",          "sector": "Retail",        "index": "NIFTY_NEXT50"},
    {"ticker": "VEDL.NS",       "name": "Vedanta",                   "sector": "Metals",        "index": "NIFTY_NEXT50"},
    {"ticker": "VOLTAS.NS",     "name": "Voltas",                    "sector": "Consumer",      "index": "NIFTY_NEXT50"},
    {"ticker": "ZYDUSLIFE.NS",  "name": "Zydus Lifesciences",        "sector": "Pharma",        "index": "NIFTY_NEXT50"},
    {"ticker": "POLYCAB.NS",    "name": "Polycab India",             "sector": "Industrials",   "index": "NIFTY_NEXT50"},
]

# ── US Top 50 (S&P 500 / NASDAQ 100) ─────────────────────────────────────────
US_TOP_50: list[dict] = [
    {"ticker": "AAPL",   "name": "Apple",                    "sector": "Technology",      "index": "SP500"},
    {"ticker": "MSFT",   "name": "Microsoft",                "sector": "Technology",      "index": "SP500"},
    {"ticker": "NVDA",   "name": "NVIDIA",                   "sector": "Technology",      "index": "SP500"},
    {"ticker": "GOOGL",  "name": "Alphabet (Google)",        "sector": "Communication",   "index": "SP500"},
    {"ticker": "AMZN",   "name": "Amazon",                   "sector": "Consumer Disc.",  "index": "SP500"},
    {"ticker": "META",   "name": "Meta Platforms",           "sector": "Communication",   "index": "SP500"},
    {"ticker": "TSLA",   "name": "Tesla",                    "sector": "Auto",            "index": "SP500"},
    {"ticker": "BRK-B",  "name": "Berkshire Hathaway B",     "sector": "Finance",         "index": "SP500"},
    {"ticker": "JPM",    "name": "JPMorgan Chase",           "sector": "Banking",         "index": "SP500"},
    {"ticker": "LLY",    "name": "Eli Lilly",                "sector": "Pharma",          "index": "SP500"},
    {"ticker": "V",      "name": "Visa",                     "sector": "Finance",         "index": "SP500"},
    {"ticker": "UNH",    "name": "UnitedHealth Group",       "sector": "Healthcare",      "index": "SP500"},
    {"ticker": "XOM",    "name": "ExxonMobil",               "sector": "Energy",          "index": "SP500"},
    {"ticker": "MA",     "name": "Mastercard",               "sector": "Finance",         "index": "SP500"},
    {"ticker": "AVGO",   "name": "Broadcom",                 "sector": "Technology",      "index": "SP500"},
    {"ticker": "PG",     "name": "Procter & Gamble",         "sector": "FMCG",            "index": "SP500"},
    {"ticker": "JNJ",    "name": "Johnson & Johnson",        "sector": "Healthcare",      "index": "SP500"},
    {"ticker": "COST",   "name": "Costco",                   "sector": "Retail",          "index": "SP500"},
    {"ticker": "HD",     "name": "Home Depot",               "sector": "Retail",          "index": "SP500"},
    {"ticker": "MRK",    "name": "Merck",                    "sector": "Pharma",          "index": "SP500"},
    {"ticker": "ABBV",   "name": "AbbVie",                   "sector": "Pharma",          "index": "SP500"},
    {"ticker": "BAC",    "name": "Bank of America",          "sector": "Banking",         "index": "SP500"},
    {"ticker": "CRM",    "name": "Salesforce",               "sector": "Technology",      "index": "SP500"},
    {"ticker": "AMD",    "name": "Advanced Micro Devices",   "sector": "Technology",      "index": "SP500"},
    {"ticker": "ORCL",   "name": "Oracle",                   "sector": "Technology",      "index": "SP500"},
    {"ticker": "CVX",    "name": "Chevron",                  "sector": "Energy",          "index": "SP500"},
    {"ticker": "PEP",    "name": "PepsiCo",                  "sector": "FMCG",            "index": "SP500"},
    {"ticker": "KO",     "name": "Coca-Cola",                "sector": "FMCG",            "index": "SP500"},
    {"ticker": "ADBE",   "name": "Adobe",                    "sector": "Technology",      "index": "SP500"},
    {"ticker": "TMO",    "name": "Thermo Fisher Scientific", "sector": "Healthcare",      "index": "SP500"},
    {"ticker": "WMT",    "name": "Walmart",                  "sector": "Retail",          "index": "SP500"},
    {"ticker": "MCD",    "name": "McDonald's",               "sector": "Consumer",        "index": "SP500"},
    {"ticker": "ACN",    "name": "Accenture",                "sector": "Technology",      "index": "SP500"},
    {"ticker": "NFLX",   "name": "Netflix",                  "sector": "Communication",   "index": "NASDAQ100"},
    {"ticker": "QCOM",   "name": "Qualcomm",                 "sector": "Technology",      "index": "NASDAQ100"},
    {"ticker": "TXN",    "name": "Texas Instruments",        "sector": "Technology",      "index": "SP500"},
    {"ticker": "INTC",   "name": "Intel",                    "sector": "Technology",      "index": "SP500"},
    {"ticker": "GS",     "name": "Goldman Sachs",            "sector": "Banking",         "index": "SP500"},
    {"ticker": "NEE",    "name": "NextEra Energy",           "sector": "Utilities",       "index": "SP500"},
    {"ticker": "PM",     "name": "Philip Morris",            "sector": "Consumer",        "index": "SP500"},
    {"ticker": "IBM",    "name": "IBM",                      "sector": "Technology",      "index": "SP500"},
    {"ticker": "NOW",    "name": "ServiceNow",               "sector": "Technology",      "index": "SP500"},
    {"ticker": "UBER",   "name": "Uber Technologies",        "sector": "Technology",      "index": "SP500"},
    {"ticker": "AMGN",   "name": "Amgen",                    "sector": "Pharma",          "index": "NASDAQ100"},
    {"ticker": "CAT",    "name": "Caterpillar",              "sector": "Industrials",     "index": "SP500"},
    {"ticker": "GE",     "name": "GE Aerospace",             "sector": "Industrials",     "index": "SP500"},
    {"ticker": "RTX",    "name": "RTX Corporation",          "sector": "Defense",         "index": "SP500"},
    {"ticker": "SPGI",   "name": "S&P Global",               "sector": "Finance",         "index": "SP500"},
    {"ticker": "MS",     "name": "Morgan Stanley",           "sector": "Banking",         "index": "SP500"},
    {"ticker": "ISRG",   "name": "Intuitive Surgical",       "sector": "Healthcare",      "index": "SP500"},
]

# ── Helpers ───────────────────────────────────────────────────────────────────
INDIA_STOCKS = NIFTY_50 + NIFTY_NEXT_50
ALL_STOCKS = INDIA_STOCKS + US_TOP_50

INDIA_TICKERS = [s["ticker"] for s in INDIA_STOCKS]
US_TICKERS    = [s["ticker"] for s in US_TOP_50]
ALL_TICKERS   = INDIA_TICKERS + US_TICKERS

TICKER_MAP: dict[str, dict] = {s["ticker"]: s for s in ALL_STOCKS}

def get_market(ticker: str) -> str:
    """Return 'IN' or 'US' for a given ticker."""
    if ticker in US_TICKERS:
        return "US"
    return "IN"


def get_currency(ticker: str) -> str:
    """Return 'INR' or 'USD' for a given ticker."""
    return "USD" if get_market(ticker) == "US" else "INR"
