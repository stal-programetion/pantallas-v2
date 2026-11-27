"""Entrypoint ASGI de Vercel para servir la API FastAPI bajo /api/*."""

from __future__ import annotations

import os
from pathlib import Path
import sys
import tempfile

ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("VERCEL", "1")
if not os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = f"sqlite:///{(Path(tempfile.gettempdir()) / 'surtigas_vercel.db').as_posix()}"

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from seed.bootstrap import bootstrap_database  # noqa: E402

# Inicialización idempotente garantizada incluso si el adaptador ASGI omite lifespan en frío
Base.metadata.create_all(bind=engine)
with SessionLocal() as _db:
    bootstrap_database(_db)

__all__ = ["app"]
