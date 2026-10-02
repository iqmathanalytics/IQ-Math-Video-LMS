from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import StaticPool
import os
import ssl
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from dotenv import load_dotenv

# ✅ REMOVED: import redis.asyncio as redis (No longer needed)

load_dotenv()

def _unwrap_quoted_env() -> None:
    """Render pastes often keep the quotes from a .env file. Strip one matching pair."""
    for key, value in list(os.environ.items()):
        if not value:
            continue
        stripped = value.strip()
        if len(stripped) >= 2 and stripped[0] == stripped[-1] and stripped[0] in {'"', "'"}:
            os.environ[key] = stripped[1:-1]

_unwrap_quoted_env()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("❌ DATABASE_URL is missing in .env file!")

# Normalize DB URL to an async driver so one env var works for both
# PostgreSQL and TiDB/MySQL deployments.
if DATABASE_URL.startswith("postgresql+asyncpg://"):
    ASYNC_DATABASE_URL = DATABASE_URL
elif DATABASE_URL.startswith("postgresql://"):
    ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("mysql+aiomysql://"):
    ASYNC_DATABASE_URL = DATABASE_URL
elif DATABASE_URL.startswith("mysql://"):
    ASYNC_DATABASE_URL = DATABASE_URL.replace("mysql://", "mysql+aiomysql://", 1)
else:
    ASYNC_DATABASE_URL = DATABASE_URL

# TiDB examples often include mysql-connector style SSL flags that aiomysql
# does not accept as keyword arguments. Strip them to avoid startup failure.
if ASYNC_DATABASE_URL.startswith("mysql+aiomysql://"):
    parts = urlsplit(ASYNC_DATABASE_URL)
    query_pairs = parse_qsl(parts.query, keep_blank_values=True)
    filtered_pairs = [
        (k, v) for k, v in query_pairs
        if k not in {"ssl_verify_cert", "ssl_verify_identity", "ssl_ca"}
    ]
    ASYNC_DATABASE_URL = urlunsplit((
        parts.scheme,
        parts.netloc,
        parts.path,
        urlencode(filtered_pairs),
        parts.fragment,
    ))

CONNECT_ARGS = {}
if ASYNC_DATABASE_URL.startswith("mysql+aiomysql://"):
    # TiDB Cloud requires secure transport. Build SSL context for aiomysql.
    ca_path = os.getenv("DB_SSL_CA_PATH")
    ssl_ctx = ssl.create_default_context(cafile=ca_path) if ca_path else ssl.create_default_context()
    CONNECT_ARGS["ssl"] = ssl_ctx

# Local demo uses SQLite. Hosted MySQL/TiDB keeps a small pool for free-tier limits.
if ASYNC_DATABASE_URL.startswith("sqlite"):
    engine = create_async_engine(
        ASYNC_DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    engine = create_async_engine(
        ASYNC_DATABASE_URL,
        echo=False,
        connect_args=CONNECT_ARGS,
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=1800,
        pool_pre_ping=True,
    )

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

# ✅ REMOVED: Redis Client initialization