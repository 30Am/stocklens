"""
APScheduler — IST-aware cron jobs for dual-market data pipeline.

Schedule (all times IST):
  06:00  — pre-market Indian news
  09:00–15:45 every 15 min — Indian stock prices
  18:30  — pre-market US news
  19:00–01:30 every 15 min — US stock prices
  every hour — forex rate refresh
  every hour (off-hours) — macro news
"""
from __future__ import annotations

import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.config import TZ_IST
from app.services.data_pipeline import (
    run_forex_update,
    run_indian_news,
    run_indian_prices,
    run_us_news,
    run_us_prices,
)
from app.services.nlp.pipeline import run_nlp_pipeline

log = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def create_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone=TZ_IST)

    # ── Forex (every hour) ────────────────────────────────────────────────────
    scheduler.add_job(
        run_forex_update,
        CronTrigger(minute=0, timezone=TZ_IST),
        id="forex",
        name="Forex USD/INR update",
        replace_existing=True,
        misfire_grace_time=120,
    )

    # ── Indian pre-market news (6:00 AM IST) ─────────────────────────────────
    scheduler.add_job(
        run_indian_news,
        CronTrigger(hour=6, minute=0, timezone=TZ_IST),
        id="indian_pre_market_news",
        name="Indian pre-market news",
        replace_existing=True,
        misfire_grace_time=300,
    )

    # ── Indian prices every 15 min during market hours (9:00–15:45 IST) ──────
    scheduler.add_job(
        run_indian_prices,
        CronTrigger(hour="9-15", minute="0,15,30,45", timezone=TZ_IST),
        id="indian_prices",
        name="Indian stock prices",
        replace_existing=True,
        misfire_grace_time=60,
    )

    # ── US pre-market news (6:30 PM IST) ─────────────────────────────────────
    scheduler.add_job(
        run_us_news,
        CronTrigger(hour=18, minute=30, timezone=TZ_IST),
        id="us_pre_market_news",
        name="US pre-market news",
        replace_existing=True,
        misfire_grace_time=300,
    )

    # ── US prices every 15 min (7:00 PM – 1:30 AM IST) ───────────────────────
    # APScheduler cron doesn't span midnight cleanly, so use two jobs
    scheduler.add_job(
        run_us_prices,
        CronTrigger(hour="19-23", minute="0,15,30,45", timezone=TZ_IST),
        id="us_prices_evening",
        name="US stock prices (evening)",
        replace_existing=True,
        misfire_grace_time=60,
    )
    scheduler.add_job(
        run_us_prices,
        CronTrigger(hour="0,1", minute="0,15,30,45", timezone=TZ_IST),
        id="us_prices_night",
        name="US stock prices (night)",
        replace_existing=True,
        misfire_grace_time=60,
    )

    # ── Off-hours macro news (every 2 hours) ─────────────────────────────────
    scheduler.add_job(
        run_indian_news,
        CronTrigger(hour="3,5,7,16,17,20,22", minute=0, timezone=TZ_IST),
        id="off_hours_news",
        name="Off-hours macro news",
        replace_existing=True,
        misfire_grace_time=600,
    )

    # ── NLP pipeline — 5 fixed daily runs (reduced from every-30-min to save RAM) ─
    scheduler.add_job(
        run_nlp_pipeline,
        CronTrigger(hour=6, minute=15, timezone=TZ_IST),
        id="nlp_indian_morning",
        name="NLP pipeline (Indian morning)",
        replace_existing=True,
        misfire_grace_time=300,
    )
    scheduler.add_job(
        run_nlp_pipeline,
        CronTrigger(hour=12, minute=0, timezone=TZ_IST),
        id="nlp_indian_midday",
        name="NLP pipeline (Indian midday)",
        replace_existing=True,
        misfire_grace_time=300,
    )
    scheduler.add_job(
        run_nlp_pipeline,
        CronTrigger(hour=16, minute=0, timezone=TZ_IST),
        id="nlp_indian_close",
        name="NLP pipeline (Indian close)",
        replace_existing=True,
        misfire_grace_time=300,
    )
    scheduler.add_job(
        run_nlp_pipeline,
        CronTrigger(hour=18, minute=45, timezone=TZ_IST),
        id="nlp_us_evening",
        name="NLP pipeline (US evening)",
        replace_existing=True,
        misfire_grace_time=300,
    )
    scheduler.add_job(
        run_nlp_pipeline,
        CronTrigger(hour=23, minute=0, timezone=TZ_IST),
        id="nlp_us_night",
        name="NLP pipeline (US night)",
        replace_existing=True,
        misfire_grace_time=300,
    )

    return scheduler


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = create_scheduler()
    return _scheduler


async def start_scheduler() -> None:
    scheduler = get_scheduler()
    if not scheduler.running:
        scheduler.start()
        log.info("scheduler started — %d jobs registered", len(scheduler.get_jobs()))
        for job in scheduler.get_jobs():
            log.info("  job: %-30s next=%s", job.name, job.next_run_time)


async def stop_scheduler() -> None:
    scheduler = get_scheduler()
    if scheduler.running:
        scheduler.shutdown(wait=False)
        log.info("scheduler stopped")
