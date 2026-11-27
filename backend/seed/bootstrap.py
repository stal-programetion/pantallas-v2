"""Inicialización de base de datos con catálogos, Excel histórico real y plan inicial."""

from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.etl.excel_importer import import_digiturno_excel
from app.models.entities import (
    AbsenceModel,
    DayPlanModel,
    HistoricalTurnModel,
    OfficeModel,
    StaffModel,
    SystemRulesModel,
)
from app.services.operations import regenerate_full_day_state
from seed.generate_synthetic_digiturno import generate_demo_excel
from seed.synthetic_catalogs import SYNTHETIC_ABSENCES, SYNTHETIC_OFFICES, SYNTHETIC_STAFF

logger = logging.getLogger("surtigas.bootstrap")


def resolve_real_excel_path(configured_path: str) -> Path | None:
    """Busca el archivo Excel real en las rutas esperadas (data/ o seed/)."""
    seed_dir = Path(__file__).resolve().parent
    candidates = [
        Path(configured_path),
        seed_dir / "Historicos Turnos MAY2026.xlsx",
        seed_dir / "Historicos_Turnos_MAY2026.xlsx",
        Path("/app/seed_data/Historicos Turnos MAY2026.xlsx"),
    ]
    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return candidate
    return None


def bootstrap_database(db: Session) -> None:
    """Puebla datos iniciales si la BD está vacía."""
    settings = get_settings()

    if db.get(SystemRulesModel, 1) is None:
        db.add(
            SystemRulesModel(
                id=1,
                target_sla=0.80,
                max_wait_min=10,
                max_presencial_km=45.0,
                lunch_duration_min=60,
                fortnight_multiplier=1.32,
                min_agents_open_office=1,
                source_mode=settings.digiturno_source_mode if settings.digiturno_source_mode in ("mock", "real") else "mock",
            )
        )
        db.commit()

    if db.execute(select(func.count(OfficeModel.id))).scalar_one() == 0:
        db.add_all([OfficeModel(**o) for o in SYNTHETIC_OFFICES])
        db.commit()

    if db.execute(select(func.count(StaffModel.id))).scalar_one() == 0:
        db.add_all([StaffModel(**s) for s in SYNTHETIC_STAFF])
        db.commit()

    if db.execute(select(func.count(AbsenceModel.id))).scalar_one() == 0:
        db.add_all([AbsenceModel(**a) for a in SYNTHETIC_ABSENCES])
        db.commit()

    if db.execute(select(func.count(HistoricalTurnModel.id_turno))).scalar_one() == 0:
        real_excel = resolve_real_excel_path(settings.excel_data_path)
        if real_excel is not None:
            logger.info("Importando Excel real de Digiturno desde %s", real_excel.name)
            import_digiturno_excel(db, real_excel, is_synthetic=False, source_type="excel")
        else:
            demo_excel = Path(__file__).resolve().parent / "demo_digiturno_may2026.xlsx"
            if not demo_excel.exists():
                logger.info("Generando Excel sintético calibrado de 22.611 turnos")
                generate_demo_excel(demo_excel)
            logger.info("Importando Excel sintético calibrado de demostración")
            import_digiturno_excel(db, demo_excel, is_synthetic=True, source_type="synthetic_demo")

    if db.execute(select(func.count(DayPlanModel.id))).scalar_one() == 0:
        regenerate_full_day_state(
            db,
            fecha=settings.default_plan_date,
            day_of_week=1,
            is_fortnight=True,
            current_slot="10:00",
        )
