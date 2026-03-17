"""Async SQLAlchemy session factory."""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.db import Base

engine = create_async_engine(
    settings.async_database_url,
    echo=False,
    future=True,
    pool_size=3,          # keep only 3 persistent connections (free-tier DB limit)
    max_overflow=2,       # allow 2 extra burst connections
    pool_pre_ping=True,   # discard stale connections automatically
    pool_recycle=300,     # recycle connections every 5 min (Supabase pooler idle timeout)
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def init_db() -> None:
    """Create all tables (dev only — use Alembic in production)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:  # FastAPI dependency
    async with AsyncSessionLocal() as session:
        yield session
