from pydantic_settings import BaseSettings, SettingsConfigDict
from zoneinfo import ZoneInfo


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database — SQLite for local dev, PostgreSQL+asyncpg for production
    database_url: str = "sqlite+aiosqlite:///./dev.db"

    # External APIs
    exchange_rate_api_key: str = ""
    news_api_key: str = ""
    alpha_vantage_key: str = ""
    openai_api_key: str = ""
    groq_api_key: str = ""
    polygon_api_key: str = ""

    # CORS — space-separated list of allowed origins for production
    # e.g. "https://stocklens.vercel.app https://www.stocklens.com"
    allowed_origins: str = "http://localhost:5173 http://localhost:3000"

    # App
    environment: str = "development"
    log_level: str = "INFO"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split() if o.strip()]

    @property
    def async_database_url(self) -> str:
        """Normalise Supabase/Railway postgres:// URLs to postgresql+asyncpg://"""
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url


settings = Settings()

# ── Timezone constants ─────────────────────────────────────────────────────────
TZ_IST = ZoneInfo("Asia/Kolkata")
TZ_EST = ZoneInfo("America/New_York")

# ── Market hours (local time strings for APScheduler cron) ────────────────────
MARKET_HOURS = {
    "IN": {
        "tz": TZ_IST,
        "open": "09:15",
        "close": "15:30",
        "pre_open": "09:00",
        "exchange": ["NSE", "BSE"],
    },
    "US": {
        "tz": TZ_EST,
        "open": "09:30",
        "close": "16:00",
        "exchange": ["NYSE", "NASDAQ"],
    },
}

# ── Scheduler cron rules (all in IST, server timezone) ────────────────────────
SCHEDULER_JOBS = {
    "indian_pre_market_news":    {"hour": 6,  "minute": 0},    # 6:00 AM IST
    "indian_market_prices":      {"hour": "9-15", "minute": "*/15"},  # 9–3:45 PM IST every 15 min
    "us_pre_market_news":        {"hour": 18, "minute": 30},   # 6:30 PM IST
    "us_market_prices":          {"hour": "19-23,0", "minute": "*/15"},  # 7 PM–1:30 AM IST every 15 min
    "off_hours_macro_news":      {"hour": "*/1"},               # Every hour off-hours
    "forex_update":              {"minute": "0"},               # Every hour
}
