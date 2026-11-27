"""Punto de entrada principal de FastAPI para Surtigas OptiTurnos."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timezone
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.engines.optimizer import weekday_from_date
from app.etl.digiturno_source import get_digiturno_source
from app.models.entities import AlertModel, DayPlanModel, SystemRulesModel
from app.realtime.manager import broadcaster
from app.routers import absences_ops, auth_catalog, digiturno, forecast_sim, plans_redist
from app.services.operations import serialize_alert
from seed.bootstrap import bootstrap_database

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger("surtigas.api")


async def _realtime_loop() -> None:
    settings = get_settings()
    while True:
        await asyncio.sleep(max(2, settings.realtime_interval_seconds))
        try:
            with SessionLocal() as db:
                rules = db.get(SystemRulesModel, 1)
                mode = rules.source_mode if rules else settings.digiturno_source_mode
                plan = db.execute(select(DayPlanModel).order_by(DayPlanModel.updated_at.desc())).scalars().first()
                is_fortnight = plan.is_fortnight if plan else True
                plan_fecha = plan.fecha if plan else settings.default_plan_date
                dow = weekday_from_date(plan_fecha)
                source = get_digiturno_source(mode)
                metrics = source.get_live_metrics(db, slot="10:00", day_of_week=dow, is_fortnight=is_fortnight)
                alerts = db.execute(
                    select(AlertModel).where(AlertModel.plan_fecha == plan_fecha, AlertModel.leida.is_(False))
                ).scalars().all()
                await broadcaster.broadcast(
                    "metrics_update",
                    {
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "currentSlotTime": "10:00",
                        "liveMetrics": [m.model_dump(by_alias=True) for m in metrics],
                        "alerts": [serialize_alert(a).model_dump(by_alias=True) for a in alerts],
                    },
                )
        except Exception as exc:  # pragma: no cover
            logger.warning("Error en ciclo de tiempo real: %s", exc)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    Base.metadata.create_all(bind=engine)
    if settings.seed_on_startup:
        with SessionLocal() as db:
            bootstrap_database(db)

    if os.environ.get("VERCEL"):
        yield
        return

    task = asyncio.create_task(_realtime_loop())
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="API de optimización de turnos, teoría de colas (Erlang C/A), simulación SimPy y tiempo real para Surtigas S.A. E.S.P.",
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(auth_catalog.router, prefix="/api/v1", tags=["Auth & Catálogos"])
    application.include_router(digiturno.router, prefix="/api/v1", tags=["Digiturno & Tiempo Real"])
    application.include_router(forecast_sim.router, prefix="/api/v1", tags=["Pronóstico & Simulación"])
    application.include_router(plans_redist.router, prefix="/api/v1", tags=["Planes & Redistribución"])
    application.include_router(absences_ops.router, prefix="/api/v1", tags=["Ausencias, Reportes & ETL"])
    return application


app = create_app()
