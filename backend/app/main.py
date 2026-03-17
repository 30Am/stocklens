from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.services.data_pipeline import run_forex_update, seed_stock_universe
from app.services.scheduler import start_scheduler, stop_scheduler
from app.utils.database import init_db

logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("investment-app starting [env=%s]", settings.environment)

    try:
        await init_db()
        await seed_stock_universe()
    except Exception as e:
        log.error("DB init failed (will retry on next request): %s", e)

    # Only fetch forex on startup — news + NLP handled by scheduler
    try:
        await run_forex_update()
    except Exception as e:
        log.warning("startup forex failed: %s", e)

    await start_scheduler()
    yield
    await stop_scheduler()
    log.info("investment-app stopped")


app = FastAPI(
    title="AI Investment Monitoring API",
    description="India (NSE/BSE) + USA (NYSE/NASDAQ) — dual-market AI signals",
    version="4.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
from app.api import chat, forex, news, signals, stocks, websocket  # noqa: E402

app.include_router(stocks.router)
app.include_router(news.router)
app.include_router(signals.router)
app.include_router(forex.router)
app.include_router(websocket.router)
app.include_router(chat.router)


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok", "version": "4.0.0"}


@app.post("/run-nlp", tags=["meta"])
async def trigger_nlp(market: str | None = None):
    """Manually trigger the NLP pipeline."""
    from app.services.nlp.pipeline import run_nlp_pipeline
    return await run_nlp_pipeline(market=market)
