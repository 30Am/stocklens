"""
SQLAlchemy ORM models — matches Phase 4 schema from roadmap.
"""
from datetime import datetime

from sqlalchemy import (
    BigInteger, Column, DateTime, Float, ForeignKey,
    Index, Integer, String, Text, func,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Stock(Base):
    __tablename__ = "stocks"

    id       = Column(Integer, primary_key=True)
    ticker   = Column(String(20), unique=True, nullable=False, index=True)
    name     = Column(String(120), nullable=False)
    exchange = Column(String(10), nullable=False)   # NSE | BSE | NYSE | NASDAQ
    sector   = Column(String(60))
    market   = Column(String(2), nullable=False)    # IN | US
    currency = Column(String(3), nullable=False)    # INR | USD
    index    = Column(String(30))                   # NIFTY50 | NIFTY_NEXT50 | SP500 | NASDAQ100

    prices   = relationship("Price", back_populates="stock", cascade="all, delete-orphan")
    signals  = relationship("Signal", back_populates="stock", cascade="all, delete-orphan")


class Price(Base):
    __tablename__ = "prices"

    id        = Column(Integer, primary_key=True)
    ticker    = Column(String(20), ForeignKey("stocks.ticker", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    open      = Column(Float)
    high      = Column(Float)
    low       = Column(Float)
    close     = Column(Float, nullable=False)
    volume    = Column(BigInteger)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    stock = relationship("Stock", back_populates="prices")

    __table_args__ = (
        Index("ix_prices_ticker_ts", "ticker", "timestamp"),
    )


class NewsArticle(Base):
    __tablename__ = "news"

    id         = Column(Integer, primary_key=True)
    headline   = Column(Text, nullable=False)
    source     = Column(String(80))
    url        = Column(Text, unique=True)
    market     = Column(String(2))                  # IN | US | GLOBAL
    published  = Column(DateTime(timezone=True))
    fetched_at = Column(DateTime(timezone=True), server_default=func.now())
    raw_text   = Column(Text)


class Signal(Base):
    __tablename__ = "signals"

    id         = Column(Integer, primary_key=True)
    ticker     = Column(String(20), ForeignKey("stocks.ticker", ondelete="CASCADE"), nullable=False)
    signal     = Column(String(10), nullable=False)   # BUY | HOLD | SELL
    score      = Column(Float)                        # -1.0 to +1.0 sentiment
    reason     = Column(Text)                         # 1-line AI explanation
    news_id    = Column(Integer, ForeignKey("news.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    stock = relationship("Stock", back_populates="signals")

    __table_args__ = (
        Index("ix_signals_ticker_ts", "ticker", "created_at"),
    )


class CrossMarketEvent(Base):
    __tablename__ = "cross_market_events"

    id         = Column(Integer, primary_key=True)
    in_ticker  = Column(String(20))                   # Indian stock (nullable if US-only)
    us_ticker  = Column(String(20))                   # US stock (nullable if IN-only)
    event      = Column(Text, nullable=False)          # Human-readable description
    impact     = Column(String(10))                    # POSITIVE | NEGATIVE | NEUTRAL
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ForexRate(Base):
    __tablename__ = "forex_rates"

    id         = Column(Integer, primary_key=True)
    pair       = Column(String(10), nullable=False)    # USD_INR
    rate       = Column(Float, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
